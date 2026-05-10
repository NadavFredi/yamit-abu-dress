import { Routes, Route, Navigate } from "react-router-dom";
import { RequestPage } from "@/pages/RequestPage";
import { ThankYouPage } from "@/pages/ThankYouPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RequestPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
