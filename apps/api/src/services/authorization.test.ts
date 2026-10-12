import { describe, it, expect } from "vitest";
import {
    authorizePatientAccess,
    authorizeAuditRead,
    authorizePrescriptionApproval,
    type UserContext,
    type PatientContext,
    type CareTeamAssignmentRecord,
    type CareGrantRecord,
    type ConsentRecord,
} from "./authorization";

describe("Authorization Matrix (Task 2.3)", () => {
    const ws1 = "workspace-1";
    const ws2 = "workspace-2";

    const patient1: PatientContext = {
        id: "p-001",
        workspaceId: ws1,
        profileId: "profile-patient-1",
    };

    const assignedDoctor: UserContext = {
        profileId: "profile-doc-1",
        workspaceId: ws1,
        role: "doctor",
        email: "doc1@mednova.clinic",
    };

    const unassignedDoctor: UserContext = {
        profileId: "profile-doc-2",
        workspaceId: ws1,
        role: "doctor",
        email: "doc2@mednova.clinic",
    };

    const crossWorkspaceDoctor: UserContext = {
        profileId: "profile-doc-3",
        workspaceId: ws2,
        role: "doctor",
        email: "doc3@other.clinic",
    };

    const patientSelf: UserContext = {
        profileId: "profile-patient-1",
        workspaceId: ws1,
        role: "patient",
        email: "patient1@email.com",
    };

    const patientOther: UserContext = {
        profileId: "profile-patient-2",
        workspaceId: ws1,
        role: "patient",
        email: "patient2@email.com",
    };

    const careTeamMember: UserContext = {
        profileId: "profile-ct-1",
        workspaceId: ws1,
        role: "care_team",
        email: "ct1@mednova.clinic",
    };

    const adminUser: UserContext = {
        profileId: "profile-admin-1",
        workspaceId: ws1,
        role: "admin",
        email: "admin@mednova.clinic",
    };

    const activeAssignments: CareTeamAssignmentRecord[] = [
        { patientId: "p-001", doctorProfileId: "profile-doc-1" },
        { patientId: "p-001", doctorProfileId: "profile-doc-revoked", revokedAt: "2026-01-01T00:00:00Z" },
    ];

    const activeGrants: CareGrantRecord[] = [
        { patientId: "p-001", granteeProfileId: "profile-ct-1", scope: "all" },
        { patientId: "p-001", granteeProfileId: "profile-ct-revoked", scope: "all", revokedAt: "2026-01-01T00:00:00Z" },
    ];

    const consentGranted: ConsentRecord = {
        patientId: "p-001",
        shareWithCareTeam: true,
        allowReminders: true,
        allowAiAnalysis: true,
    };

    const consentDenied: ConsentRecord = {
        patientId: "p-001",
        shareWithCareTeam: false,
        allowReminders: true,
        allowAiAnalysis: true,
    };

    it("authorizes assigned doctor in same workspace", () => {
        const result = authorizePatientAccess({
            user: assignedDoctor,
            patient: patient1,
            assignments: activeAssignments,
        });
        expect(result.authorized).toBe(true);
    });

    it("denies unassigned doctor", () => {
        const result = authorizePatientAccess({
            user: unassignedDoctor,
            patient: patient1,
            assignments: activeAssignments,
        });
        expect(result.authorized).toBe(false);
        expect(result.reason).toContain("not assigned");
    });

    it("denies doctor with revoked assignment", () => {
        const revokedDoctor: UserContext = {
            profileId: "profile-doc-revoked",
            workspaceId: ws1,
            role: "doctor",
            email: "revoked@mednova.clinic",
        };
        const result = authorizePatientAccess({
            user: revokedDoctor,
            patient: patient1,
            assignments: activeAssignments,
        });
        expect(result.authorized).toBe(false);
    });

    it("denies cross-workspace doctor access", () => {
        const result = authorizePatientAccess({
            user: crossWorkspaceDoctor,
            patient: patient1,
            assignments: [{ patientId: "p-001", doctorProfileId: "profile-doc-3" }],
        });
        expect(result.authorized).toBe(false);
        expect(result.reason).toContain("another workspace");
    });

    it("authorizes patient self-access", () => {
        const result = authorizePatientAccess({
            user: patientSelf,
            patient: patient1,
        });
        expect(result.authorized).toBe(true);
    });

    it("denies patient accessing another patient's records", () => {
        const result = authorizePatientAccess({
            user: patientOther,
            patient: patient1,
        });
        expect(result.authorized).toBe(false);
    });

    it("authorizes care team member when grant and consent are active", () => {
        const result = authorizePatientAccess({
            user: careTeamMember,
            patient: patient1,
            grants: activeGrants,
            consent: consentGranted,
        });
        expect(result.authorized).toBe(true);
    });

    it("denies care team member when patient has not consented", () => {
        const result = authorizePatientAccess({
            user: careTeamMember,
            patient: patient1,
            grants: activeGrants,
            consent: consentDenied,
        });
        expect(result.authorized).toBe(false);
        expect(result.reason).toContain("not consented");
    });

    it("denies care team member when grant is revoked", () => {
        const revokedCareTeam: UserContext = {
            profileId: "profile-ct-revoked",
            workspaceId: ws1,
            role: "care_team",
            email: "ctrevoked@mednova.clinic",
        };
        const result = authorizePatientAccess({
            user: revokedCareTeam,
            patient: patient1,
            grants: activeGrants,
            consent: consentGranted,
        });
        expect(result.authorized).toBe(false);
    });

    it("authorizes workspace administrator", () => {
        const result = authorizePatientAccess({
            user: adminUser,
            patient: patient1,
        });
        expect(result.authorized).toBe(true);
    });

    it("denies unauthenticated requests", () => {
        const result = authorizePatientAccess({
            user: null,
            patient: patient1,
        });
        expect(result.authorized).toBe(false);
        expect(result.reason).toContain("Unauthenticated");
    });

    it("enforces audit read scopes", () => {
        expect(authorizeAuditRead(adminUser, ws1).authorized).toBe(true);
        expect(authorizeAuditRead(adminUser, ws2).authorized).toBe(false);
        expect(authorizeAuditRead(assignedDoctor, ws1).authorized).toBe(false);
        expect(authorizeAuditRead(patientSelf, ws1).authorized).toBe(false);
        expect(authorizeAuditRead(null, ws1).authorized).toBe(false);
    });

    it("enforces prescription approval to assigned doctors only", () => {
        expect(
            authorizePrescriptionApproval({
                user: assignedDoctor,
                patient: patient1,
                assignments: activeAssignments,
            }).authorized,
        ).toBe(true);

        expect(
            authorizePrescriptionApproval({
                user: unassignedDoctor,
                patient: patient1,
                assignments: activeAssignments,
            }).authorized,
        ).toBe(false);

        expect(
            authorizePrescriptionApproval({
                user: careTeamMember,
                patient: patient1,
                grants: activeGrants,
                consent: consentGranted,
            }).authorized,
        ).toBe(false);

        expect(
            authorizePrescriptionApproval({
                user: patientSelf,
                patient: patient1,
            }).authorized,
        ).toBe(false);
    });
});
