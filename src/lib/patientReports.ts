import type { PatientUploadedReport } from "./types";

const STORAGE_KEY = "patient_uploaded_medical_reports";

export const REPORT_CATEGORY_LABELS: Record<PatientUploadedReport["category"], string> = {
  blood_test: "Blood test",
  imaging: "Scan or imaging",
  prescription: "Prescription",
  discharge_summary: "Discharge summary",
  other: "Other",
};

export function getPatientUploadedReports(patientId?: string): PatientUploadedReport[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const reports = stored ? JSON.parse(stored) as PatientUploadedReport[] : [];
    return patientId ? reports.filter((report) => report.patientId === patientId) : reports;
  } catch {
    return [];
  }
}

export function addPatientUploadedReport(report: PatientUploadedReport): PatientUploadedReport[] {
  const reports = [report, ...getPatientUploadedReports()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return reports;
}

export function markPatientReportReviewed(reportId: string): PatientUploadedReport[] {
  const reports = getPatientUploadedReports().map((report) =>
    report.id === reportId
      ? { ...report, status: "reviewed" as const, reviewedAt: new Date().toISOString() }
      : report
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return reports;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
