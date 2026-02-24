import { useEffect, useState } from "react";
import api from "../api";
import { decryptPayload, ensureHandshake, getHandshakeId, resetHandshake } from "../lib/cryptoPayload";

export interface AdminSettings {
  [key: string]: string | undefined;
}

export default function useAdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>({});

  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        await ensureHandshake(true);
        const headers: Record<string, string> = {};
        const handshake = getHandshakeId();
        if (handshake) headers["x-itd-handshake"] = handshake;
        const res = await api.get("/settings", { headers });
        if (!active) return;
        if (res.data?.encSettings) {
          const decrypted = (await decryptPayload(res.data.encSettings, "settings")) as { settings?: AdminSettings };
          setSettings(decrypted.settings || {});
          return;
        }
        setSettings(res.data.settings || {});
      } catch (err: any) {
        if (err?.response?.status === 426) {
          try {
            resetHandshake();
            await ensureHandshake(true);
            const headers: Record<string, string> = {};
            const handshake = getHandshakeId();
            if (handshake) headers["x-itd-handshake"] = handshake;
            const res = await api.get("/settings", { headers });
            if (!active) return;
            if (res.data?.encSettings) {
              const decrypted = (await decryptPayload(res.data.encSettings, "settings")) as { settings?: AdminSettings };
              setSettings(decrypted.settings || {});
              return;
            }
            setSettings(res.data.settings || {});
            return;
          } catch {
            if (active) setSettings({});
            return;
          }
        }
        if (active) setSettings({});
      }
    };
    fetchSettings();
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
