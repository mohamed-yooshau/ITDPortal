import { Router } from "express";
import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/ip", requireAuth, async (req, res) => {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const forwardedList = forwardedValue
    ? forwardedValue.split(",").map((value) => value.trim())
    : [];
  const isPrivateIp = (value: string) => {
    if (value.startsWith("::ffff:")) {
      value = value.slice(7);
    }
    return (
      value.startsWith("10.") ||
      value.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) ||
      value === "127.0.0.1" ||
      value === "::1"
    );
  };
  const localFromForwarded = forwardedList.find((ip) => isPrivateIp(ip)) || null;
  const socketIp = req.socket.remoteAddress || null;
  const localIp =
    localFromForwarded ||
    (socketIp && isPrivateIp(socketIp) ? socketIp : null) ||
    socketIp ||
    (req.headers["x-real-ip"] as string | undefined) ||
    null;
  let publicIp: string | null = null;
  let isp: string | null = null;
  const providers: Array<() => Promise<{ ip?: string; isp?: string } | null>> = [
    async () => {
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) return null;
      const data = (await response.json()) as { ip?: string; org?: string; isp?: string };
      return { ip: data.ip, isp: data.org || data.isp };
    },
    async () => {
      const response = await fetch("https://ipinfo.io/json");
      if (!response.ok) return null;
      const data = (await response.json()) as { ip?: string; org?: string };
      return { ip: data.ip, isp: data.org };
    },
    async () => {
      const response = await fetch("https://ipwho.is/");
      if (!response.ok) return null;
      const data = (await response.json()) as { ip?: string; connection?: { isp?: string } };
      return { ip: data.ip, isp: data.connection?.isp };
    }
  ];
  for (const provider of providers) {
    try {
      const result = await provider();
      if (result?.ip || result?.isp) {
        publicIp = result.ip || null;
        isp = result.isp || null;
        break;
      }
    } catch {
      // try next provider
    }
  }
  res.json({ ip: localIp, localIp, publicIp, isp });
});


router.get("/speed/download", requireAuth, (req, res) => {
  const sizeMb = Math.min(Math.max(Number(req.query.size || 5), 1), 25);
  const size = Math.floor(sizeMb * 1024 * 1024);
  const buffer = Buffer.alloc(size, "a");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", buffer.length.toString());
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
});

router.get("/speed/download/stream", requireAuth, (req, res) => {
  const sizeMb = Math.min(Math.max(Number(req.query.size || 20), 1), 50);
  const delayMs = Math.min(Math.max(Number(req.query.delay || 8), 0), 50);
  const totalBytes = Math.floor(sizeMb * 1024 * 1024);
  const chunkSize = 64 * 1024;
  let sent = 0;

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const chunk = Buffer.alloc(chunkSize, "a");
  const writeChunk = () => {
    if (sent >= totalBytes) {
      res.end();
      return;
    }
    const remaining = totalBytes - sent;
    const size = remaining < chunkSize ? remaining : chunkSize;
    res.write(chunk.subarray(0, size));
    sent += size;
    if (delayMs > 0) {
      setTimeout(writeChunk, delayMs);
    } else {
      setImmediate(writeChunk);
    }
  };
  writeChunk();
});

router.get("/speed/external-download", requireAuth, async (_req, res) => {
  const target =
    process.env.SPEEDTEST_DOWNLOAD_URL ||
    "https://speed.cloudflare.com/__down?bytes=10000000";
  try {
    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "External speed test unavailable." });
      return;
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }
    upstream.body.pipeTo(
      new WritableStream({
        write(chunk) {
          res.write(Buffer.from(chunk));
        },
        close() {
          res.end();
        },
        abort() {
          res.end();
        }
      })
    );
  } catch {
    res.status(502).json({ error: "External speed test unavailable." });
  }
});

router.post(
  "/speed/external-upload",
  requireAuth,
  express.raw({ type: "*/*", limit: "25mb" }),
  async (req, res) => {
    const target = process.env.SPEEDTEST_UPLOAD_URL || "https://speed.cloudflare.com/__up";
    try {
      const upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: req.body
      });
      if (!upstream.ok) {
        res.status(502).json({ error: "External speed test unavailable." });
        return;
      }
      res.json({ ok: true });
    } catch {
      res.status(502).json({ error: "External speed test unavailable." });
    }
  }
);

router.post(
  "/speed/upload",
  requireAuth,
  express.raw({ type: "*/*", limit: "25mb" }),
  (_req, res) => {
    res.json({ ok: true });
  }
);

export default router;
