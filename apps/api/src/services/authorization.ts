import type { UserRole } from "@mednova/types";

export interface UserContext {
    profileId: string;
    workspaceId: string;
    role: UserRole;
    email: string;
    mustChangePassword?: boolean;
    patientId?: string;
}

export interface PatientContext {
    id: string;
    workspaceId: string;
    profileId?: string | null;
}

export interface CareTeamAssignmentRecord {
    patientId: string;
    doctorProfileId: string;
    revokedAt?: string | null;
}

export interface CareGrantRecord {
    patientId: string;
    granteeProfileId: string;
    scope: string; // e.g. "all", "read_dose", "read_report"
    revokedAt?: string | null;
}

export interface ConsentRecord {
    patientId: string;
    shareWithCareTeam: boolean;
    allowReminders: boolean;
    allowAiAnalysis: boolean;
}

export interface AuthorizationParams {
    user: UserContext | null;
    patient: PatientContext;
    assignments?: CareTeamAssignmentRecord[];
    grants?: CareGrantRecord[];
    consent?: ConsentRecord | null;
    requiredScope?: string;
}

export interface AuthorizationResult {
    authorized: boolean;
    reason?: string;
}

/**
 * Evaluates whether a user is authorized to access a patient's protected clinical records.
 * Enforces workspace isolation, role boundaries, assignments, care grants, and consent.
 */
export function authorizePatientAccess(params: AuthorizationParams): AuthorizationResult {
    const { user, patient, assignments = [], grants = [], consent, requiredScope } = params;

    if (!user) {
        return { authorized: false, reason: "Unauthenticated: no user session provided" };
    }

    // Strict workspace boundary
    if (user.workspaceId !== patient.workspaceId) {
        return { authorized: false, reason: "Denied: patient belongs to another workspace" };
    }

    // 1. Patient self-access
    if (user.role === "patient") {
        if (patient.profileId && patient.profileId === user.profileId) {
            return { authorized: true };
        }
        return { authorized: false, reason: "Denied: patient accounts can only access their own records" };
    }

    // 2. Administrator workspace-wide access
    if (user.role === "admin") {
        return { authorized: true };
    }

    // 3. Doctor access — requires active, non-revoked assignment
    if (user.role === "doctor") {
        const isAssigned = assignments.some(
            (a) =>
                a.patientId === patient.id &&
                a.doctorProfileId === user.profileId &&
                !a.revokedAt,
        );

        if (isAssigned) {
            return { authorized: true };
        }
        return { authorized: false, reason: "Denied: doctor is not assigned to this patient" };
    }

    // 4. Care Team access — requires active care grant AND patient consent
    if (user.role === "care_team") {
        if (!consent || !consent.shareWithCareTeam) {
            return { authorized: false, reason: "Denied: patient has not consented to care team data sharing" };
        }

        const hasGrant = grants.some(
            (g) =>
                g.patientId === patient.id &&
                g.granteeProfileId === user.profileId &&
                !g.revokedAt &&
                (!requiredScope || g.scope === "all" || g.scope === requiredScope),
        );

        if (hasGrant) {
            return { authorized: true };
        }
        return { authorized: false, reason: "Denied: care team member lacks active care grant for this patient" };
    }

    return { authorized: false, reason: "Denied: unrecognized user role" };
}

/**
 * Checks whether a user has permission to read audit events.
 * Only administrators within their own workspace may query audit events.
 */
export function authorizeAuditRead(user: UserContext | null, targetWorkspaceId: string): AuthorizationResult {
    if (!user) {
        return { authorized: false, reason: "Unauthenticated: no user session provided" };
    }

    if (user.role !== "admin") {
        return { authorized: false, reason: "Denied: only administrators can query audit logs" };
    }

    if (user.workspaceId !== targetWorkspaceId) {
        return { authorized: false, reason: "Denied: cross-workspace audit queries are prohibited" };
    }

    return { authorized: true };
}

/**
 * Checks whether a user can approve prescriptions.
 * Only doctors actively assigned to the patient can approve prescriptions.
 */
export function authorizePrescriptionApproval(params: AuthorizationParams): AuthorizationResult {
    const { user } = params;
    if (!user || user.role !== "doctor") {
        return { authorized: false, reason: "Denied: only physicians can approve prescriptions" };
    }
    return authorizePatientAccess(params);
}
