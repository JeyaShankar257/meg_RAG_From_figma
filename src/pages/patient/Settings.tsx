import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input, { Select } from "../../components/ui/Input";

export default function PatientSettings() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your preferences and contact details.</p>
      </div>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">MR</div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Marcus Rivera</p>
            <p className="text-xs text-slate-500 font-mono">PT-00231</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Email" type="email" defaultValue="m.rivera@email.com" />
          <Input label="Phone" type="tel" defaultValue="+1 (555) 204-3817" />
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Reminder Preferences</h2>
        <div className="space-y-4">
          <Select
            label="Time Zone"
            defaultValue="America/Chicago"
            options={[
              { value: "America/Chicago", label: "Central Time (CT)" },
              { value: "America/New_York", label: "Eastern Time (ET)" },
              { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
            ]}
          />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Quiet Hours</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="time" defaultValue="21:00" />
              <Input label="End" type="time" defaultValue="07:00" />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Communication</h2>
        <div className="space-y-3">
          {[
            { label: "Email dose reminders", checked: true },
            { label: "Weekly report emails", checked: true },
            { label: "Monthly report emails", checked: true },
            { label: "Care team messages", checked: true },
          ].map((item) => (
            <label key={item.label} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700">{item.label}</span>
              <input type="checkbox" defaultChecked={item.checked} className="rounded border-slate-300 text-teal-600" />
            </label>
          ))}
        </div>
      </Card>

      <Card padding="md">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Accessibility</h2>
        <div className="space-y-3">
          {[
            { label: "High contrast mode", checked: false },
            { label: "Large text mode", checked: false },
            { label: "Reduced motion", checked: false },
          ].map((item) => (
            <label key={item.label} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700">{item.label}</span>
              <input type="checkbox" defaultChecked={item.checked} className="rounded border-slate-300 text-teal-600" />
            </label>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3 pb-4">
        <Button onClick={handleSave} variant={saved ? "success" : "primary"}>
          {saved ? "✓ Saved" : "Save Changes"}
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </div>
  );
}
