import pool from "./db.js";

let cached: { data: Record<string, string>; loadedAt: number } | null = null;
const TTL_MS = 30_000;

export async function getSettingsMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) {
    return cached.data;
  }
  const result = await pool.query("SELECT key, value FROM settings");
  const settings = result.rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  cached = { data: settings, loadedAt: now };
  return settings;
}

export function clearSettingsCache(): void {
  cached = null;
}
