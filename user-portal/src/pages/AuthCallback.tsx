import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hashParams.get("token");
    const finalize = () => {
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      sessionStorage.removeItem("itportal_logout_user");
      window.dispatchEvent(new Event("itportal-auth-changed"));
      navigate("/", { replace: true });
    };
    if (token) {
      api
        .post("/auth/session", { token })
        .then(finalize)
        .catch(() => navigate("/login", { replace: true }));
      return;
    }
    api
      .get("/auth/me")
      .then(finalize)
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return <div className="card">Signing in...</div>;
}
