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
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const navigate = useNavigate();
  const logoutKey = "itportal_logout_admin";

  useEffect(() => {
    const checkSession = async () => {
      try {
        await ensureHandshake(true);
        const headers: Record<string, string> = {};
        const handshake = getHandshakeId();
        if (handshake) headers["x-itd-handshake"] = handshake;
        await api.get("/auth/admin-access", { headers });
        sessionStorage.removeItem(logoutKey);
        setSessionValid(true);
        setSessionChecked(true);
        navigate("/", { replace: true });
      } catch {
        setSessionValid(false);
        setSessionChecked(true);
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
        if (!sessionChecked) return;
        if (!hasLogoutFlag && !sessionValid && !enabled && sso) {
          setAutoSigningIn(true);
          window.location.href = "/api/auth/login?app=admin&redirect=1";
        }
      })
      .catch(() => setLocalEnabled(true));
  }, [sessionChecked, sessionValid]);

  const handleAzureLogin = async () => {
    if (!ssoEnabled) {
      setError("Office login is disabled during local setup.");
      return;
    }
    sessionStorage.removeItem(logoutKey);
    window.location.href = "/api/auth/login?app=admin&redirect=1";
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      sessionStorage.removeItem(logoutKey);
      await ensureHandshake(true);
      const headers: Record<string, string> = {};
      const handshake = getHandshakeId();
      if (handshake) headers["x-itd-handshake"] = handshake;
      await api.post("/auth/local-login", { username, password }, { headers });
      navigate("/");
    } catch {
      setError("Login failed. Check credentials.");
    }
  };

  return (
    <div className="login admin-login">
      <div className="login-card">
        <div className="login-intro">
          <h1>Admin Console</h1>
          <p>Secure access for managing IT services and portal content.</p>
        </div>
        <div className="login-panel">
          <div className="login-panel-header">
            <h2>Sign in</h2>
            <ThemeToggle />
          </div>
          {autoSigningIn && <p className="note">Signing you in...</p>}
          {ssoEnabled && (
            <button className="btn btn-microsoft" onClick={handleAzureLogin}>
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
                  placeholder="Local admin username"
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
