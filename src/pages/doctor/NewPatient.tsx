import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input, { Select } from "../../components/ui/Input";
import Card from "../../components/ui/Card";

export default function NewPatient() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    dob: "", gender: "", address: "", guardianName: "",
    guardianPhone: "", guardianEmail: "", conditions: "",
    assignedDoctor: "Dr. Sarah Chen", careTeamNotes: "", consent: false,
  });

  const generatedId = "PT-00268";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("confirm");
    }, 1000);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(generatedId).catch(() => {});
  };

  if (step === "confirm") {
    return (
      <div className="p-6 max-w-lg mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="fill-emerald-600" width={32} height={32}>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Patient Registered</h2>
          <p className="text-slate-500 text-sm">
            {form.firstName} {form.lastName} has been added. An activation email has been queued.
          </p>
        </div>

        <Card padding="lg" className="mb-5 border-teal-200 bg-teal-50">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Generated Patient ID</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-mono font-bold text-teal-800 tracking-wider">{generatedId}</span>
            <button
              onClick={handleCopyId}
              className="text-teal-600 hover:text-teal-800 border border-teal-300 hover:border-teal-500 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-teal-600 mt-2">This ID was system-generated and cannot be changed. Share it with the patient for their reference.</p>
        </Card>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Name</span>
            <span className="font-medium text-slate-800">{form.firstName} {form.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-800">{form.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className="text-amber-700 font-medium">Invited / Pending Activation</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Assigned to</span>
            <span className="font-medium text-slate-800">{form.assignedDoctor}</span>
          </div>
          {form.guardianName && (
            <div className="flex justify-between">
              <span className="text-slate-500">Guardian</span>
              <span className="font-medium text-slate-800">{form.guardianName}</span>
            </div>
          )}
          {form.guardianPhone && (
            <div className="flex justify-between">
              <span className="text-slate-500">Guardian phone</span>
              <span className="font-medium text-slate-800">{form.guardianPhone}</span>
            </div>
          )}
          {form.guardianEmail && (
            <div className="flex justify-between">
              <span className="text-slate-500">Guardian email</span>
              <span className="font-medium text-slate-800">{form.guardianEmail}</span>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-700">
          Activation email has been queued. The patient will appear as "Invited/Pending" until they complete account setup.
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => navigate("/doctor")}>
            Back to Dashboard
          </Button>
          <Button fullWidth onClick={() => { setStep("form"); setForm({ firstName: "", lastName: "", email: "", phone: "", dob: "", gender: "", address: "", guardianName: "", guardianPhone: "", guardianEmail: "", conditions: "", assignedDoctor: "Dr. Sarah Chen", careTeamNotes: "", consent: false }); }}>
            Add Another Patient
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Add New Patient</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          A Patient ID will be auto-generated. The patient will receive an activation email to set their password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Demographics</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Marcus"
            />
            <Input
              label="Last Name"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Rivera"
            />
            <Input
              label="Date of Birth"
              type="date"
              required
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <Select
              label="Gender"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              options={[
                { value: "", label: "Select…" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "non-binary", label: "Non-binary" },
                { value: "prefer-not-to-say", label: "Prefer not to say" },
              ]}
            />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Contact Information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="patient@email.com"
              hint="Activation email will be sent here."
            />
            <Input
              label="Phone Number"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main Street, City, State ZIP"
              />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Guardian Information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Guardian Name"
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <Input
              label="Guardian Phone Number"
              type="tel"
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
            <Input
              label="Guardian Email Address"
              type="email"
              value={form.guardianEmail}
              onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
              placeholder="guardian@email.com"
            />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Clinical Details</h2>
          <div className="space-y-4">
            <Input
              label="Initial Conditions"
              value={form.conditions}
              onChange={(e) => setForm({ ...form, conditions: e.target.value })}
              placeholder="Type 2 Diabetes, Hypertension…"
              hint="Comma-separated list"
            />
            <Select
              label="Assigned Doctor"
              value={form.assignedDoctor}
              onChange={(e) => setForm({ ...form, assignedDoctor: e.target.value })}
              options={[
                { value: "Dr. Sarah Chen", label: "Dr. Sarah Chen — Internal Medicine" },
              ]}
            />
          </div>
        </Card>

        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Consent & Data Sharing</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-teal-600"
            />
            <span className="text-sm text-slate-700">
              I confirm that the patient has consented to care-team data sharing, AI-assisted decision support (advisory only), and email-based reminders and reports.
            </span>
          </label>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate("/doctor")} fullWidth>
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={loading}>
            Register Patient & Send Activation Email
          </Button>
        </div>
      </form>
    </div>
  );
}
