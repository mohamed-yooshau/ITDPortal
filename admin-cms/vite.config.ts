import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const adminPath = process.env.VITE_ADMIN_PATH || "secure-admin";
const normalized = adminPath.replace(/^\/|\/$/g, "");
const base = `/${normalized}/`;

export default defineConfig({
  base,
  plugins: [react()]
});
