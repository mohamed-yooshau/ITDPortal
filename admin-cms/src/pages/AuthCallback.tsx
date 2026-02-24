import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { ensureHandshake, getHandshakeId } from "../lib/cryptoPayload";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hashParams.get("token");
    const finalize = () => {
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      sessionStorage.removeItem("itportal_logout_admin");
      navigate("/", { replace: true });
    };
    if (token) {
      api
        .post("/auth/session", { token })
        .then(finalize)
        .catch(() => navigate("/login", { replace: true }));
      return;
    }
    ensureHandshake(true)
      .then(() => {
        const headers: Record<string, string> = {};
        const handshake = getHandshakeId();
        if (handshake) headers["x-itd-handshake"] = handshake;
        return api.get("/auth/admin-access", { headers });
      })
      .then(finalize)
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return <div className="card">Signing in...</div>;
}
