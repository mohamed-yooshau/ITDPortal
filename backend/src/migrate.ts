import fs from "fs";
import path from "path";
import pool from "./db.js";

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  );
}

function getMigrationFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve("/app/migrations");
  await ensureMigrationsTable();
  const files = getMigrationFiles(migrationsDir);
  for (const file of files) {
    const existing = await pool.query("SELECT filename FROM schema_migrations WHERE filename = $1", [file]);
    if (existing.rowCount && existing.rows[0]) continue;
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    if (sql.trim().length === 0) continue;
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await pool.query("COMMIT");
      console.log(`Applied migration ${file}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }
}
