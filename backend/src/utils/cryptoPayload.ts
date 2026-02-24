import crypto from "crypto";

export type EncBundle = {
  kid: string;
  alg: "A256GCM";
  iv: string;
  ct: string;
  tag: string;
  ts: number;
};

export function getEncryptionKey(kid?: string): { key: Buffer; kid: string } {
  const keyB64 = process.env.AUTH_PAYLOAD_ENC_KEY || "";
  const selectedKid = kid || process.env.AUTH_PAYLOAD_ENC_KID || "v1";
  if (!keyB64) {
    throw new Error("AUTH_PAYLOAD_ENC_KEY missing");
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("AUTH_PAYLOAD_ENC_KEY must be 32 bytes base64");
  }
  return { key, kid: selectedKid };
}

export function buildAad(parts: Array<string | undefined | null>): Buffer {
  const normalized = parts.map((p) => String(p || "")).join("|");
  return Buffer.from(normalized, "utf8");
}

export function encryptPayload(
  payload: Record<string, unknown>,
  key: Buffer,
  kid: string,
  aadParts: Array<string | undefined | null>
): EncBundle {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(buildAad(aadParts));
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    kid,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
    ts: Date.now()
  };
}

export function decryptPayload(
  bundle: EncBundle,
  key: Buffer,
  aadParts: Array<string | undefined | null>
): Record<string, unknown> {
  const iv = Buffer.from(bundle.iv, "base64");
  const ct = Buffer.from(bundle.ct, "base64");
  const tag = Buffer.from(bundle.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(buildAad(aadParts));
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as Record<string, unknown>;
}
