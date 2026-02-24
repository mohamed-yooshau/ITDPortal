type EncBundle = {
  kid: string;
  alg: "A256GCM";
  iv: string;
  ct: string;
  tag: string;
  ts: number;
};

type AuthConfig = {
  localLoginEnabled: boolean;
  ssoLoginEnabled: boolean;
  authEncryptionEnabled: boolean;
};

let handshakeId: string | null = null;
let aesKey: CryptoKey | null = null;
let inFlight: Promise<void> | null = null;
let encryptionEnabled: boolean | null = null;

const textEncoder = new TextEncoder();

const b64ToBytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

const buildAad = (parts: string[]) => textEncoder.encode(parts.join("|"));

async function deriveKey(secret: ArrayBuffer, handshake: string) {
  const hkdfKey = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode(handshake),
      info: textEncoder.encode("itd-auth-payload-v1")
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function isEncryptionEnabled() {
  if (encryptionEnabled !== null) return encryptionEnabled;
  try {
    const config = await getAuthConfig();
    encryptionEnabled = config.authEncryptionEnabled === true;
    return encryptionEnabled;
  } catch {
    encryptionEnabled = false;
    return encryptionEnabled;
  }
}

export async function getAuthConfig() {
  await ensureHandshake(true);
  const headers: Record<string, string> = {};
  const handshake = getHandshakeId();
  if (handshake) headers["x-itd-handshake"] = handshake;
  const res = await fetch("/api/auth/config", { credentials: "include", headers });
  if (res.status === 426) {
    resetHandshake();
    await ensureHandshake(true);
    const retryHeaders: Record<string, string> = {};
    const retryHandshake = getHandshakeId();
    if (retryHandshake) retryHeaders["x-itd-handshake"] = retryHandshake;
    const retry = await fetch("/api/auth/config", { credentials: "include", headers: retryHeaders });
    if (!retry.ok) throw new Error("Auth config failed");
    const retryData = (await retry.json()) as {
      encConfig?: EncBundle;
      localLoginEnabled?: boolean;
      ssoLoginEnabled?: boolean;
      authEncryptionEnabled?: boolean;
    };
    if (retryData.encConfig) {
      const decrypted = await decryptPayload(retryData.encConfig, "auth/config");
      return decrypted as AuthConfig;
    }
    return {
      localLoginEnabled: retryData.localLoginEnabled !== false,
      ssoLoginEnabled: retryData.ssoLoginEnabled !== false,
      authEncryptionEnabled: retryData.authEncryptionEnabled === true
    };
  }
  if (!res.ok) throw new Error("Auth config failed");
  const data = (await res.json()) as {
    encConfig?: EncBundle;
    localLoginEnabled?: boolean;
    ssoLoginEnabled?: boolean;
    authEncryptionEnabled?: boolean;
  };
  if (data.encConfig) {
    const decrypted = await decryptPayload(data.encConfig, "auth/config");
    return decrypted as AuthConfig;
  }
  return {
    localLoginEnabled: data.localLoginEnabled !== false,
    ssoLoginEnabled: data.ssoLoginEnabled !== false,
    authEncryptionEnabled: data.authEncryptionEnabled === true
  };
}

export async function ensureHandshake(force = false): Promise<void> {
  if (!force && !(await isEncryptionEnabled())) return;
  if (aesKey && handshakeId) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const clientKeys = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const clientPublic = await crypto.subtle.exportKey("spki", clientKeys.publicKey);
    const clientPublicB64 = btoa(String.fromCharCode(...new Uint8Array(clientPublic)));
    const response = await fetch("/api/auth/handshake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ clientPublicKey: clientPublicB64 })
    });
    if (response.status === 400) {
      encryptionEnabled = false;
      return;
    }
    if (!response.ok) {
      throw new Error("Handshake failed");
    }
    const data = (await response.json()) as { handshakeId: string; serverPublicKey: string };
    const serverPublic = b64ToBytes(data.serverPublicKey).buffer;
    const serverKey = await crypto.subtle.importKey(
      "spki",
      serverPublic,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    const secret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverKey },
      clientKeys.privateKey,
      256
    );
    aesKey = await deriveKey(secret, data.handshakeId);
    handshakeId = data.handshakeId;
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getHandshakeId() {
  return handshakeId;
}

export async function decryptUser(bundle: EncBundle, endpoint: string) {
  if (!aesKey || !handshakeId) {
    await ensureHandshake(true);
  }
  if (!aesKey || !handshakeId) throw new Error("Handshake missing");
  const iv = b64ToBytes(bundle.iv);
  const ct = b64ToBytes(bundle.ct);
  const tag = b64ToBytes(bundle.tag);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);
  const aad = buildAad([handshakeId, window.location.origin, endpoint]);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      aesKey,
      combined
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
  } catch {
    const fallbackAad = buildAad([handshakeId, window.location.origin]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: fallbackAad },
      aesKey,
      combined
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
  }
}

export function resetHandshake() {
  handshakeId = null;
  aesKey = null;
}

export async function decryptPayload(bundle: EncBundle, endpoint = "") {
  return decryptUser(bundle, endpoint);
}
