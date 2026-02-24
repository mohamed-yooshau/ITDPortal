import { Request, Response } from "express";

const HANDSHAKE_TTL_MS = 10 * 60 * 1000;
const handshakeStore = new Map<string, { key: Buffer; kid: string; expiresAt: number }>();

const isEncryptionEnabled = () => process.env.AUTH_ENCRYPTION_ENABLED === "true";

const buildOrigin = (req: Request) => {
  const origin = req.headers.origin;
  if (origin) return origin.toString();
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").toString();
  const host =
    (req.headers["x-forwarded-host"] || req.headers.host || req.get("host") || "").toString();
  return host ? `${proto}://${host}` : `${proto}://localhost`;
};

const requireHandshake = (req: Request, res: Response, force = false) => {
  if (!isEncryptionEnabled() && !force) return null;
  const handshakeId = String(req.headers["x-itd-handshake"] || "");
  if (!handshakeId) {
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.skipEncrypt = true;
    res.status(426).json({ error: "Handshake required" });
    return null;
  }
  const entry = handshakeStore.get(handshakeId);
  if (!entry || entry.expiresAt < Date.now()) {
    handshakeStore.delete(handshakeId);
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.skipEncrypt = true;
    res.status(426).json({ error: "Handshake required" });
    return null;
  }
  return { handshakeId, ...entry };
};

const storeHandshake = (handshakeId: string, key: Buffer, kid: string) => {
  handshakeStore.set(handshakeId, { key, kid, expiresAt: Date.now() + HANDSHAKE_TTL_MS });
};

export { HANDSHAKE_TTL_MS, buildOrigin, requireHandshake, storeHandshake };
