import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Guides from "./pages/Guides";
import GuideDetail from "./pages/GuideDetail";
import About from "./pages/About";
import Policies from "./pages/Policies";
import Status from "./pages/Status";
import Profile from "./pages/Profile";
import ActionPlan from "./pages/ActionPlan";
import Search from "./pages/Search";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import useAuth from "./hooks/useAuth";
import TopographicBackground from "./components/TopographicBackground";
import useSettings from "./hooks/useSettings";
import PageDisabled from "./pages/PageDisabled";
import TourProvider from "./components/tour/TourProvider";

export default function App() {
  const { user, loading } = useAuth();
  const settings = useSettings();
  const isPageEnabled = (key: keyof typeof settings) => settings[key] !== "false";
  if (loading) {
    return <div className="card">Loading...</div>;
  }
  return (
    <TourProvider user={user} settings={settings}>
      <TopographicBackground />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<Layout user={user} />}>
          {!user ? (
            <Route path="*" element={<Navigate to="/login" replace />} />
          ) : (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/guides" element={isPageEnabled("page_guides_enabled") ? <Guides /> : <PageDisabled />} />
              <Route
                path="/guides/:id"
                element={isPageEnabled("page_guides_enabled") ? <GuideDetail /> : <PageDisabled />}
              />
              <Route path="/about" element={isPageEnabled("page_about_enabled") ? <About /> : <PageDisabled />} />
              <Route path="/policies" element={isPageEnabled("page_policies_enabled") ? <Policies /> : <PageDisabled />} />
              <Route
                path="/action-plan"
                element={isPageEnabled("page_action_plan_enabled") ? <ActionPlan /> : <PageDisabled />}
              />
              <Route path="/profile" element={isPageEnabled("page_profile_enabled") ? <Profile /> : <PageDisabled />} />
              <Route path="/status" element={isPageEnabled("page_status_enabled") ? <Status /> : <PageDisabled />} />
              <Route path="/services" element={isPageEnabled("page_services_enabled") ? <Services /> : <PageDisabled />} />
              <Route
                path="/services/:id"
                element={isPageEnabled("page_services_enabled") ? <ServiceDetail /> : <PageDisabled />}
              />
              <Route path="/search" element={<Search />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>
      </Routes>
    </TourProvider>
  );
}
