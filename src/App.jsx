import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import GenerateInvitation from "./pages/GenerateInvitation.jsx";
import InvitationDetails from "./pages/InvitationDetails.jsx";
import ScannerPage from "./pages/ScannerPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/invitation" element={<GenerateInvitation />} />
      <Route path="/i/:token" element={<InvitationDetails />} />
      <Route path="/scan" element={<ScannerPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/invitation" replace />} />
    </Routes>
  );
}
