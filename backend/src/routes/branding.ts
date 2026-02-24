import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();
const BRANDING_DIR = "/uploads/branding";

const ensureDir = () => {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
};

const sendFile = (res: any, filename: string, contentType?: string) => {
  ensureDir();
  const filePath = path.join(BRANDING_DIR, filename);
  res.setHeader("Cache-Control", "no-store");
  if (contentType) {
    res.setHeader("Content-Type", contentType);
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
    return;
  }
  res.status(404).end();
};

router.get("/branding/favicon-16.png", (_req, res) => {
  sendFile(res, "favicon-16.png", "image/png");
});

router.get("/branding/favicon-32.png", (_req, res) => {
  sendFile(res, "favicon-32.png", "image/png");
});

router.get("/branding/favicon-48.png", (_req, res) => {
  sendFile(res, "favicon-48.png", "image/png");
});

router.get("/branding/app-192.png", (_req, res) => {
  sendFile(res, "app-192.png", "image/png");
});

router.get("/branding/app-256.png", (_req, res) => {
  sendFile(res, "app-256.png", "image/png");
});

router.get("/branding/app-512.png", (_req, res) => {
  sendFile(res, "app-512.png", "image/png");
});

router.get("/branding/favicon.svg", (_req, res) => {
  sendFile(res, "favicon.svg", "image/svg+xml");
});

router.get("/branding/manifest.webmanifest", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/manifest+json");
  res.json({
    name: "ITD Portal",
    short_name: "ITD Portal",
    start_url: "/",
    display: "standalone",
    background_color: "#0d2445",
    theme_color: "#0d2445",
    icons: [
      { src: "/api/branding/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/api/branding/app-256.png", sizes: "256x256", type: "image/png" },
      { src: "/api/branding/app-512.png", sizes: "512x512", type: "image/png" }
    ]
  });
});

export default router;
