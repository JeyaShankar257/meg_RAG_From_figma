import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import DoctorLogin from "./pages/doctor/Login";
import DoctorShell from "./components/doctor/DoctorShell";
import DoctorDashboard from "./pages/doctor/Dashboard";
import PatientPage from "./pages/doctor/PatientPage";
import CareTeamPage from "./pages/doctor/CareTeamPage";
import NewPatient from "./pages/doctor/NewPatient";
import DoctorSettings from "./pages/doctor/Settings";
import PatientLogin from "./pages/patient/Login";
import PatientShell from "./components/patient/PatientShell";
import PatientDashboard from "./pages/patient/Dashboard";
import DoseCenter from "./pages/patient/DoseCenter";
import PatientVisits from "./pages/patient/Visits";
import Transparency from "./pages/patient/Transparency";
import Reports from "./pages/patient/Reports";
import PatientSettings from "./pages/patient/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Landing />} />

        {/* Doctor auth */}
        <Route path="/doctor/login" element={<DoctorLogin />} />

        {/* Doctor portal */}
        <Route path="/doctor" element={<DoctorShell />}>
          <Route index element={<DoctorDashboard />} />
          <Route path="patients/new" element={<NewPatient />} />
          <Route path="patients/:patientId" element={<PatientPage />} />
          <Route path="patients/:patientId/care-team" element={<CareTeamPage />} />
          <Route path="settings" element={<DoctorSettings />} />
        </Route>

        {/* Patient auth */}
        <Route path="/patient/login" element={<PatientLogin />} />

        {/* Patient portal */}
        <Route path="/patient" element={<PatientShell />}>
          <Route index element={<PatientDashboard />} />
          <Route path="doses" element={<DoseCenter />} />
          <Route path="visits" element={<PatientVisits />} />
          <Route path="transparency" element={<Transparency />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<PatientSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
