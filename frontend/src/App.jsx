import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { PublicLayout } from "./components/PublicLayout.jsx";
import { RequireAuth } from "./components/RequireAuth.jsx";
import { PersonaProvider } from "./context/PersonaContext.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { ReviewQueue } from "./pages/ReviewQueue.jsx";
import { PostedArchive } from "./pages/PostedArchive.jsx";
import { PostEdit } from "./pages/PostEdit.jsx";
import { AccountsPage } from "./pages/AccountsPage.jsx";
import { CalendarPage } from "./pages/CalendarPage.jsx";
import { PersonasPage } from "./pages/PersonasPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SignupPage } from "./pages/SignupPage.jsx";
import { AiSettingsPage } from "./pages/AiSettingsPage.jsx";
import { GuidePage } from "./pages/GuidePage.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<PublicLayout />}>
        <Route path="/about" element={<AboutPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<PersonaProvider />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/posted" element={<PostedArchive />} />
            <Route path="/posts/:id" element={<PostEdit />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/personas" element={<PersonasPage />} />
            <Route path="/settings/ai" element={<AiSettingsPage />} />
            <Route path="/guide" element={<GuidePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
