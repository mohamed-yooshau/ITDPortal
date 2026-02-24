import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { decryptUser, ensureHandshake, getHandshakeId, resetHandshake } from "../lib/cryptoPayload";
interface UserInfo {
  email: string;
  name: string;
}

export default function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useMemo(
    () => () => {
      setLoading(true);
      const fetchUser = async () => {
        const headers: Record<string, string> = {};
        const handshake = getHandshakeId();
        if (handshake) headers["x-itd-handshake"] = handshake;
        return api.get("/auth/me", { headers });
      };
      fetchUser()
        .then(async (res) => {
          if (res.data?.encUser) {
            const decrypted = (await decryptUser(res.data.encUser, "auth/me")) as unknown as UserInfo;
            setUser(decrypted);
            return;
          }
          const nextUser = res.data.user as UserInfo;
          setUser(nextUser);
        })
        .catch(async (err) => {
          if (err?.response?.status === 426) {
            try {
              resetHandshake();
              await ensureHandshake();
              const retry = await fetchUser();
              if (retry.data?.encUser) {
                const decrypted = (await decryptUser(retry.data.encUser, "auth/me")) as unknown as UserInfo;
                setUser(decrypted);
              } else {
                setUser(retry.data.user as UserInfo);
              }
              return;
            } catch {
              setUser(null);
              return;
            }
          }
          setUser(null);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    refreshUser();
    const handleAuthChange = () => refreshUser();
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("itportal-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("itportal-auth-changed", handleAuthChange);
    };
  }, [refreshUser]);

  return { user, loading };
}
