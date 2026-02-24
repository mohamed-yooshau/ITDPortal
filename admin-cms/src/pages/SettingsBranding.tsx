import { useState } from "react";
import api from "../api";
import SettingsNav from "../components/SettingsNav";

export default function SettingsBranding() {
  const [brandingFile, setBrandingFile] = useState<File | null>(null);
  const [brandingMessage, setBrandingMessage] = useState<string | null>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const renderImageToBlob = (image: HTMLImageElement, size: number) =>
    new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

  const uploadBrandingBlob = async (key: string, blob: Blob) => {
    const formData = new FormData();
    formData.append("file", new File([blob], `${key}.png`, { type: "image/png" }));
    await api.post(`/admin/branding/favicon?name=${encodeURIComponent(key)}`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  };

  const handleBrandingUploadAll = async () => {
    if (!brandingFile) {
      setBrandingMessage("Select an image first.");
      return;
    }
    try {
      setBrandingMessage("Processing icon...");
      const dataUrl = await readFileAsDataUrl(brandingFile);
      const img = new Image();
      img.decoding = "async";
      const isSvg = brandingFile.type === "image/svg+xml";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Invalid image"));
        img.src = dataUrl;
      });

      if (isSvg) {
        const svgFormData = new FormData();
        svgFormData.append("file", brandingFile);
        await api.post("/admin/branding/favicon?name=favicon-svg", svgFormData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      const sizes: Array<{ key: string; size: number }> = [
        { key: "favicon-16", size: 16 },
        { key: "favicon-32", size: 32 },
        { key: "favicon-48", size: 48 },
        { key: "app-192", size: 192 },
        { key: "app-256", size: 256 },
        { key: "app-512", size: 512 }
      ];

      for (const item of sizes) {
        const blob = await renderImageToBlob(img, item.size);
        await uploadBrandingBlob(item.key, blob);
      }

      setBrandingMessage("Branding icons updated.");
      setBrandingFile(null);
    } catch (error) {
      setBrandingMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  return (
    <section className="card">
      <SettingsNav />
      <div className="panel">
        <h2>Branding Icons</h2>
        <p className="muted">Upload one square image and we will generate favicon/app sizes.</p>
        <div className="form">
          <input
            type="file"
            accept="image/png,image/svg+xml"
            onChange={(event) => setBrandingFile(event.target.files?.[0] || null)}
          />
          <button className="btn primary" onClick={handleBrandingUploadAll}>
            Upload Branding Icons
          </button>
          {brandingMessage && <p className="muted">{brandingMessage}</p>}
        </div>
      </div>
    </section>
  );
}
