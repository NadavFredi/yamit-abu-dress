import { Routes, Route, Navigate } from "react-router-dom";
import { RequestPage } from "@/pages/RequestPage";
import { ThankYouPage } from "@/pages/ThankYouPage";
import { LoginPage } from "@/pages/LoginPage";
import { RequireAuth } from "@/components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequestPage />
          </RequireAuth>
        }
      />
      <Route
        path="/thank-you"
        element={
          <RequireAuth>
            <ThankYouPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
