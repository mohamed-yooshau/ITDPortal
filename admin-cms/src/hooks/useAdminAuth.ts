import { useEffect, useState } from "react";
import api from "../api";
import { normalizeRole } from "../permissions";
import { decryptUser, ensureHandshake, getHandshakeId, resetHandshake } from "../lib/cryptoPayload";

interface AdminUser {
  email: string;
  name: string;
  role: string;
}

let cachedUser: AdminUser | null = null;
let cachedLoaded = false;
let inFlight: Promise<AdminUser | null> | null = null;

export default function useAdminAuth() {
  const [user, setUser] = useState<AdminUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedLoaded);

  useEffect(() => {
    let active = true;
    if (cachedLoaded) {
      setLoading(false);
      setUser(cachedUser);
      return () => {
        active = false;
      };
    }
    const fetchUser = async () => {
      try {
        if (!inFlight) {
          inFlight = (async () => {
            try {
              await ensureHandshake(true);
              const headers = getHandshakeId()
                ? { "x-itd-handshake": getHandshakeId() as string }
                : undefined;
              const res = await api.get("/auth/admin-access", { headers });
              if (res.data?.encUser) {
                try {
                  const decrypted = (await decryptUser(res.data.encUser, "auth/admin-access")) as unknown as AdminUser;
                  return { ...decrypted, role: normalizeRole(decrypted.role) } as AdminUser;
                } catch {
                  resetHandshake();
                  await ensureHandshake(true);
                  const retryHeaders = getHandshakeId()
                    ? { "x-itd-handshake": getHandshakeId() as string }
                    : undefined;
                  const retryRes = await api.get("/auth/admin-access", { headers: retryHeaders });
                  if (retryRes.data?.encUser) {
                    const decryptedRetry = (await decryptUser(
                      retryRes.data.encUser,
                      "auth/admin-access"
                    )) as unknown as AdminUser;
                    return { ...decryptedRetry, role: normalizeRole(decryptedRetry.role) } as AdminUser;
                  }
                }
              }
              const apiUser = res.data.user;
              if (!apiUser) return null;
              return { ...apiUser, role: normalizeRole(apiUser.role) } as AdminUser;
            } catch (err: any) {
              if (err?.response?.status === 426) {
                resetHandshake();
                try {
                  await ensureHandshake(true);
                  const headers = getHandshakeId()
                    ? { "x-itd-handshake": getHandshakeId() as string }
                    : undefined;
                  const res = await api.get("/auth/admin-access", { headers });
                  if (res.data?.encUser) {
                    try {
                      const decrypted = (await decryptUser(res.data.encUser, "auth/admin-access")) as unknown as AdminUser;
                      return { ...decrypted, role: normalizeRole(decrypted.role) } as AdminUser;
                    } catch {
                      resetHandshake();
                      await ensureHandshake(true);
                      const retryHeaders = getHandshakeId()
                        ? { "x-itd-handshake": getHandshakeId() as string }
                        : undefined;
                      const retryRes = await api.get("/auth/admin-access", { headers: retryHeaders });
                      if (retryRes.data?.encUser) {
                        const decryptedRetry = (await decryptUser(
                          retryRes.data.encUser,
                          "auth/admin-access"
                        )) as unknown as AdminUser;
                        return { ...decryptedRetry, role: normalizeRole(decryptedRetry.role) } as AdminUser;
                      }
                    }
                  }
                  const apiUser = res.data.user;
                  if (!apiUser) return null;
                  return { ...apiUser, role: normalizeRole(apiUser.role) } as AdminUser;
                } catch {
                  return null;
                }
              }
              return null;
            } finally {
              inFlight = null;
            }
          })();
        }
        const result = await inFlight;
        cachedUser = result;
        cachedLoaded = true;
        if (active) {
          setUser(result);
          setLoading(false);
        }
      } catch {
        cachedUser = null;
        cachedLoaded = true;
        if (active) {
          setUser(null);
          setLoading(false);
        }
      }
    };
    fetchUser();
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
