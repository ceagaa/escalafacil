/**
 * Exporta os dados do Supabase para JSON (Etapa 6 da migração para D1).
 *
 * Uso:
 *   node worker/scripts/export-supabase.mjs
 *
 * Variáveis de ambiente (ou .env na raiz):
 *   SUPABASE_URL          — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE — chave service_role (Settings → API)
 *   SUPABASE_PAT          — personal access token do Supabase (opcional,
 *                           mas necessário para exportar os hashes de senha
 *                           de auth.users via Management API)
 *
 * Saída: worker/export/*.json (um arquivo por tabela + users.json)
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(__dirname, "../export");

// ------------------------------------------------------------- env helpers

async function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(ROOT, ".env");
  if (existsSync(envPath)) {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2];
    }
  }
  return env;
}

const env = await loadEnv();
const URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE || "";
const PAT = env.SUPABASE_PAT || "";

if (!URL || !SERVICE_KEY) {
  console.error("Falta SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE no .env.");
  process.exit(1);
}

// ------------------------------------------------------------- REST export

const TABLES = [
  "profiles",
  "departments",
  "department_members",
  "eventos",
  "evento_departamentos",
  "volunteers",
  "schedule_blocks",
  "shifts",
  "shift_volunteers",
];

async function restAll(table) {
  const rows = [];
  const pageSize = 1000;
  // Ordena por id (PK em todas as tabelas) para paginação consistente.
  let offset = 0;
  for (;;) {
    const url = `${URL}/rest/v1/${table}?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

// --------------------------------------------------- auth users (GoTrue)

async function exportAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const res = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`admin/users: HTTP ${res.status} ${await res.text()}`);
    const body = await res.json();
    const batch = body.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return users;
}

// ------------------------------------- auth.users direto (Management API)

/**
 * Consulta auth.users com os hashes de senha (bcrypt) via Management API.
 * Requer SUPABASE_PAT (personal access token).
 */
async function exportAuthUsersWithHashes(ref) {
  const query = `
    SELECT id, email, encrypted_password, confirmation_token,
           email_confirmed_at IS NOT NULL AS email_verified,
           created_at, updated_at, raw_app_meta_data
    FROM auth.users
    ORDER BY created_at ASC`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`Management API: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json(); // array de objetos { id, email, encrypted_password, ... }
}

// ------------------------------------------------------------------ main

await mkdir(OUT_DIR, { recursive: true });
const summary = [];

for (const table of TABLES) {
  const rows = await restAll(table);
  await writeFile(path.join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
  summary.push(`${table}: ${rows.length}`);
  console.log(`✔ ${table}: ${rows.length} linhas`);
}

// Usuários via admin API (sem hash de senha — fallback).
const authUsers = await exportAuthUsers();
await writeFile(path.join(OUT_DIR, "auth_users_nohash.json"), JSON.stringify(authUsers, null, 2), "utf8");
console.log(`✔ auth users (admin API): ${authUsers.length}`);

// Tenta os hashes de senha via Management API.
const ref = URL.replace(/^https?:\/\//, "").split(".")[0];
if (PAT) {
  try {
    const hashes = await exportAuthUsersWithHashes(ref);
    await writeFile(path.join(OUT_DIR, "auth_users_hashes.json"), JSON.stringify(hashes, null, 2), "utf8");
    console.log(`✔ auth users (hashes): ${hashes.length}`);
  } catch (err) {
    console.warn(`⚠ não consegui os hashes de senha: ${err.message}`);
    console.warn("  (usuários existentes precisarão redefinir a senha sem o PAT)");
  }
} else {
  console.warn("⚠ SUPABASE_PAT ausente — hashes de senha NÃO exportados.");
}

console.log(`\nExportação em: ${OUT_DIR}`);
console.log(summary.join("\n"));
