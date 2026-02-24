import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ThemeToggle from "../components/ThemeToggle";
import { ensureHandshake, getAuthConfig, getHandshakeId } from "../lib/cryptoPayload";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [autoSigningIn, setAutoSigningIn] = useState(false);
  const navigate = useNavigate();
  const logoutKey = "itportal_logout_user";

  useEffect(() => {
    const checkSession = async () => {
      try {
        await ensureHandshake();
        const headers: Record<string, string> = {};
        const handshake = getHandshakeId();
        if (handshake) headers["x-itd-handshake"] = handshake;
        await api.get("/auth/me", { headers });
        sessionStorage.removeItem(logoutKey);
        navigate("/", { replace: true });
      } catch {
        return;
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    getAuthConfig()
      .then((config) => {
        const enabled = config.localLoginEnabled !== false;
        const sso = config.ssoLoginEnabled !== false;
        setLocalEnabled(enabled);
        setSsoEnabled(sso);
        const hasLogoutFlag = sessionStorage.getItem(logoutKey) === "1";
        if (!hasLogoutFlag && sso) {
          setAutoSigningIn(true);
          window.location.href = "/api/auth/login?app=user&redirect=1";
        }
      })
      .catch(() => setLocalEnabled(true));
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!ssoEnabled) {
      setError("Office login is disabled during local setup.");
      return;
    }
    try {
      sessionStorage.removeItem(logoutKey);
      window.location.href = "/api/auth/login?app=user&redirect=1";
    } catch {
      setError("Azure login failed. Check configuration.");
    }
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      sessionStorage.removeItem(logoutKey);
      await ensureHandshake();
      const headers: Record<string, string> = {};
      const handshake = getHandshakeId();
      if (handshake) headers["x-itd-handshake"] = handshake;
      await api.post("/auth/local-login", { username, password }, { headers });
      window.dispatchEvent(new Event("itportal-auth-changed"));
      navigate("/");
    } catch {
      setError("Login failed. Check credentials.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-hero">
          <h1>ITD Portal</h1>
          <p>One place for service requests, guides, and support updates.</p>
          <ul>
            <li>Browse ITD services and forms</li>
            <li>Explore step-by-step guides</li>
            <li>Track service health</li>
          </ul>
        </div>
        <div className="login-panel">
          <div className="login-panel-header">
            <h2>Sign in</h2>
            <ThemeToggle />
          </div>
          <p>Please sign in with your MTCC account to access the IT portal.</p>
          {autoSigningIn && <p className="note">Signing you in...</p>}
          {ssoEnabled && (
            <button className="btn btn-microsoft" onClick={handleLogin}>
              <span className="ms-logo" aria-hidden="true" />
              <span>Use Office account</span>
            </button>
          )}
          {localEnabled && (
            <>
              {ssoEnabled && <div className="divider">or</div>}
              <form onSubmit={handleLocalLogin} className="form login-form">
                <input
                  type="text"
                  placeholder="Local username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" className="btn">Login</button>
                {error && <p className="error">{error}</p>}
              </form>
            </>
          )}
          {!ssoEnabled && !localEnabled && <p className="error">No login method is currently enabled.</p>}
        </div>
      </div>
    </div>
  );
}
