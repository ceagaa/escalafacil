/**
 * Gera o SQL de importação a partir de worker/export/*.json e aplica na D1.
 *
 * Uso:
 *   node worker/scripts/import-d1.mjs           # gera worker/export/import.sql
 *   npx wrangler d1 execute escalafacil-db --remote --file worker/export/import.sql
 *
 * Regras de conversão Supabase -> D1:
 *   - boolean true/false -> 1/0
 *   - JSON (features, availability) -> texto JSON
 *   - timestamps -> mantidos (ISO 8601)
 *   - auth_users: usa auth_users_hashes.json se existir (bcrypt legado),
 *     senão cria linhas com password_hash NULL (login só via Google/reset).
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, "../export");

function sqlLit(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function loadJson(name) {
  const p = path.join(EXPORT_DIR, name);
  if (!existsSync(p)) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

// ------------------------------------------------------- tabelas de dados

/** ordem respeita as FKs */
const TABLE_COLUMNS = {
  profiles: ["id", "email", "name", "is_super_admin", "created_at"],
  departments: ["id", "name", "slug", "active", "features", "coordenador_id", "created_at"],
  eventos: ["id", "tipo", "estado", "cidade", "circuito", "ano", "slug", "data_evento", "criado_por", "created_at"],
  evento_departamentos: ["id", "evento_id", "department_id", "created_at"],
  department_members: ["id", "department_id", "user_id", "role", "evento_id", "created_at"],
  volunteers: ["id", "department_id", "name", "congregation", "phone", "availability", "active", "created_at"],
  schedule_blocks: ["id", "department_id", "day", "period", "responsible", "accent", "created_at"],
  shifts: ["id", "block_id", "department_id", "start_time", "end_time", "description", "vagas", "active", "created_at"],
  shift_volunteers: ["id", "shift_id", "volunteer_id", "department_id", "manual_name"],
};

// ------------------------------------------------------------------ main

const files = await readdir(EXPORT_DIR).catch(() => []);
if (files.length === 0) {
  console.error("Nenhum arquivo de exportação encontrado. Rode export-supabase.mjs antes.");
  process.exit(1);
}

const lines = [];
lines.push("-- Importação gerada por worker/scripts/import-d1.mjs");
lines.push("PRAGMA foreign_keys = OFF;");
lines.push("BEGIN TRANSACTION;");
lines.push("");

let total = 0;

for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
  const rows = await loadJson(`${table}.json`);
  if (!rows) {
    console.warn(`⚠ ${table}.json ausente — pulando`);
    continue;
  }
  if (rows.length === 0) {
    console.log(`· ${table}: vazio`);
    continue;
  }
  lines.push(`-- ${table} (${rows.length})`);
  const colList = cols.join(", ");
  for (const row of rows) {
    const vals = cols.map((c) => sqlLit(row[c]));
    lines.push(`INSERT OR IGNORE INTO ${table} (${colList}) VALUES (${vals.join(", ")});`);
    total++;
  }
  lines.push("");
  console.log(`✔ ${table}: ${rows.length}`);
}

// ------------------------------------------------------------- auth_users

const nohash = (await loadJson("auth_users_nohash.json")) ?? [];
const hashes = (await loadJson("auth_users_hashes.json")) ?? [];
const hashById = new Map(hashes.map((h) => [h.id, h]));

if (nohash.length > 0 || hashes.length > 0) {
  lines.push(`-- auth_users (${Math.max(nohash.length, hashes.length)})`);
  // Prefere a lista com hash; completa com a sem hash (usuários sem senha).
  const source = hashes.length > 0 ? hashes : nohash;
  for (const u of source) {
    const h = hashById.get(u.id);
    const passwordHash = h?.encrypted_password ?? null; // bcrypt legado do Supabase
    const provider = h?.raw_app_meta_data?.provider || u.app_metadata?.provider || "email";
    const emailVerified = h
      ? Boolean(h.email_verified)
      : Boolean(u.email_confirmed_at || u.confirmed_at);
    lines.push(
      `INSERT OR IGNORE INTO auth_users (id, email, password_hash, provider, google_sub, email_verified, created_at, updated_at) VALUES (` +
        `${sqlLit(u.id)}, ${sqlLit((u.email ?? "").toLowerCase())}, ${sqlLit(passwordHash)}, ` +
        `${sqlLit(provider === "google" ? "google" : "email")}, ${sqlLit(u.user_metadata?.sub ?? null)}, ` +
        `${emailVerified ? 1 : 0}, ${sqlLit(u.created_at ?? null)}, ${sqlLit(u.updated_at ?? null)});`
    );
    total++;
  }
  // Usuários presentes só na lista sem hash (se houver).
  for (const u of nohash) {
    if (hashById.has(u.id) || source.some((s) => s.id === u.id)) continue;
    lines.push(
      `INSERT OR IGNORE INTO auth_users (id, email, password_hash, provider, google_sub, email_verified, created_at, updated_at) VALUES (` +
        `${sqlLit(u.id)}, ${sqlLit((u.email ?? "").toLowerCase())}, NULL, ` +
        `${sqlLit(u.app_metadata?.provider === "google" ? "google" : "email")}, ${sqlLit(u.user_metadata?.sub ?? null)}, ` +
        `${u.email_confirmed_at || u.confirmed_at ? 1 : 0}, ${sqlLit(u.created_at ?? null)}, ${sqlLit(u.updated_at ?? null)});`
    );
    total++;
  }
  lines.push("");
  console.log(`✔ auth_users: ${source.length}`);
}

lines.push("COMMIT;");
lines.push("PRAGMA foreign_keys = ON;");

const out = path.join(EXPORT_DIR, "import.sql");
await writeFile(out, lines.join("\n"), "utf8");
console.log(`\nSQL gerado: ${out}`);
console.log(`Total de INSERTs: ${total}`);
console.log("\nPara aplicar:");
console.log("  npx wrangler d1 execute escalafacil-db --remote --file worker/export/import.sql");
