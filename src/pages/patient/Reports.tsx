import { useState } from "react";
import { DEMO_REPORTS } from "../../lib/mockData";
import type { PatientUploadedReport } from "../../lib/types";
import {
  addPatientUploadedReport,
  formatFileSize,
  getPatientUploadedReports,
  REPORT_CATEGORY_LABELS,
} from "../../lib/patientReports";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Input, { Select, Textarea } from "../../components/ui/Input";
import StatusPill from "../../components/ui/StatusPill";
import AdherenceRing from "../../components/charts/AdherenceRing";

const PATIENT_ID = "p-001";
const PATIENT_NAME = "Marcus Rivera";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const TREND_EMOJIS: Record<string, string> = {
  improving: "↑",
  stable: "→",
  declining: "↓",
};

const ENCOURAGEMENTS: Record<string, string> = {
  improving: "You're making real progress. Keep building the habit!",
  stable: "Staying consistent — that's the foundation of good adherence.",
  declining: "This week was tougher, but tomorrow is a new start.",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

function openReport(report: PatientUploadedReport) {
  window.open(report.fileDataUrl, "_blank", "noopener,noreferrer");
}

export default function Reports() {
  const [uploadedReports, setUploadedReports] = useState(() =>
    getPatientUploadedReports(PATIENT_ID)
  );
  const [form, setForm] = useState({
    title: "",
    category: "blood_test" as PatientUploadedReport["category"],
    reportDate: "",
    note: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.title.trim() || !form.reportDate || !file) {
      setError("Add a report title, report date, and file before uploading.");
      return;
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setError("Upload a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("The report must be 2 MB or smaller for this demo.");
      return;
    }

    setUploading(true);
    try {
      const fileDataUrl = await readFileAsDataUrl(file);
      const report: PatientUploadedReport = {
        id: `patient-report-${Date.now()}`,
        patientId: PATIENT_ID,
        patientName: PATIENT_NAME,
        title: form.title.trim(),
        category: form.category,
        reportDate: form.reportDate,
        note: form.note.trim() || undefined,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileDataUrl,
        uploadedAt: new Date().toISOString(),
        status: "shared",
      };
      const reports = addPatientUploadedReport(report);
      setUploadedReports(reports.filter((item) => item.patientId === PATIENT_ID));
      setForm({ title: "", category: "blood_test", reportDate: "", note: "" });
      setFile(null);
      setFileInputKey((key) => key + 1);
      setSuccessMessage("Report uploaded and shared with Dr. Sarah Chen.");
    } catch {
      setError("The report could not be saved. Try a smaller file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm">Upload medical documents and review your adherence reports.</p>
      </div>

      <Card padding="md" className="border-teal-200 bg-gradient-to-br from-white to-teal-50/50">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18}>
                  <path d="M12 16V4m0 0L7 9m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Upload a medical report</h2>
                <p className="text-xs text-slate-500">The report will be shared with your assigned doctor.</p>
              </div>
            </div>
          </div>
          <Badge variant="info">Demo upload</Badge>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Report title"
              required
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="e.g. HbA1c blood test"
            />
            <Select
              label="Report type"
              value={form.category}
              onChange={(event) => setForm({
                ...form,
                category: event.target.value as PatientUploadedReport["category"],
              })}
              options={Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label="Report date"
              type="date"
              required
              value={form.reportDate}
              onChange={(event) => setForm({ ...form, reportDate: event.target.value })}
            />
            <Input
              key={fileInputKey}
              label="Choose report"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              hint="PDF, JPG, or PNG up to 2 MB"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <Textarea
            label="Note for your doctor"
            rows={3}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Add context or a question about this report (optional)"
          />

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-500">This prototype stores the report in this browser for your linked doctor view.</p>
            <Button type="submit" loading={uploading}>Upload &amp; Share with Doctor</Button>
          </div>
        </form>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">My Medical Reports</h2>
            <p className="text-xs text-slate-500">Documents you have shared with your care team.</p>
          </div>
          <Badge variant="default">{uploadedReports.length} uploaded</Badge>
        </div>

        {uploadedReports.length === 0 ? (
          <Card padding="md" className="text-center border-dashed border-slate-200 bg-slate-50">
            <p className="text-sm font-medium text-slate-700">No medical reports uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1">Your first uploaded report will appear here.</p>
          </Card>
        ) : (
          uploadedReports.map((report) => (
            <Card key={report.id} padding="md">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18}>
                      <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
                      <path d="M14 3v5h5M10 13h5M10 17h5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">{report.title}</h3>
                      <Badge variant={report.status === "reviewed" ? "success" : "info"}>
                        {report.status === "reviewed" ? "Reviewed by doctor" : "Shared with doctor"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {REPORT_CATEGORY_LABELS[report.category]} · Report date {new Date(`${report.reportDate}T00:00:00`).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{report.fileName} · {formatFileSize(report.fileSize)}</p>
                    {report.note && <p className="text-sm text-slate-600 mt-2">{report.note}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openReport(report)}>View Report</Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Adherence Reports</h2>
          <p className="text-xs text-slate-500">Your automatically generated weekly and monthly summaries.</p>
        </div>

        {DEMO_REPORTS.map((report, index) => (
          <Card key={report.id} padding="md" className="animate-slide-in-up" style={{ animationDelay: `${index * 80}ms` } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={report.period === "monthly" ? "info" : "default"} size="sm">
                    {report.period === "weekly" ? "Weekly Report" : "Monthly Report"}
                  </Badge>
                  <StatusPill status={report.trend} />
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {report.startDate} → {report.endDate}
                </p>
              </div>
              <AdherenceRing score={report.adherencePercent} size={70} strokeWidth={8} animate={index === 0} />
            </div>

            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-bold text-teal-700">{report.adherencePercent}%</span>
                  <span className="text-teal-500 ml-2 text-sm font-medium">{TREND_EMOJIS[report.trend]} {report.trend}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">{report.missedDays} missed day{report.missedDays !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-slate-500">this period</p>
                </div>
              </div>
              <p className="text-sm text-teal-700 mt-2 italic">{ENCOURAGEMENTS[report.trend]}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Highlights</p>
              {report.insights.map((insight, insightIndex) => (
                <div key={insightIndex} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="text-teal-500 mt-0.5 flex-shrink-0">·</span>
                  {insight}
                </div>
              ))}
            </div>

            {report.deliveredAt && (
              <p className="text-[10px] text-slate-400 mt-3 border-t border-slate-50 pt-3">
                Delivered {new Date(report.deliveredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} via email
              </p>
            )}
          </Card>
        ))}

        <Card padding="md" className="text-center bg-slate-50 border-dashed border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Next weekly report</p>
          <p className="text-sm font-medium text-slate-700">September 15 — September 21, 2026</p>
          <p className="text-xs text-slate-400 mt-1">Will be delivered by email on Sep 22</p>
        </Card>
      </section>
    </div>
  );
}
