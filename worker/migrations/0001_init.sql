-- =====================================================================
-- EscalaFácil — Schema canônico para Cloudflare D1 (SQLite)
-- Port das 9 tabelas Supabase + tabelas de auth custom.
--
-- Diferenças em relação ao Postgres/Supabase:
--   * uuid            -> TEXT (gerado em app ou via randomblob)
--   * timestamptz     -> TEXT ISO-8601 (strftime '%Y-%m-%dT%H:%M:%fZ')
--   * date            -> TEXT 'YYYY-MM-DD'
--   * jsonb           -> TEXT (serializado como JSON)
--   * boolean         -> INTEGER 0/1 (a API converte para true/false no JSON)
--   * RLS / triggers  -> camada de autorização no Worker
--   * auth.users      -> auth_users (credenciais) + profiles (dados do app)
-- =====================================================================

-- ---------------------------------------------------------------------
-- AUTH
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,                    -- normalizado: minúsculas
  password_hash   TEXT,                             -- 'pbkdf2$iter$salt$hash'; NULL se só-google
  provider        TEXT NOT NULL DEFAULT 'email' CHECK (provider IN ('email','google')),
  google_sub      TEXT,                             -- sub do Google (único quando presente)
  email_verified  INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_key ON auth_users (email);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_google_sub_key
  ON auth_users (google_sub) WHERE google_sub IS NOT NULL;

-- Refresh tokens rotativos (hash SHA-256 do token guardado como id)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id           TEXT PRIMARY KEY,                    -- sha256(refresh_token)
  user_id      TEXT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
  expires_at   TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions (expires_at);

-- Tokens de redefinição de senha (hash SHA-256)
CREATE TABLE IF NOT EXISTS auth_password_resets (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
  expires_at   TEXT NOT NULL,
  used_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS auth_password_resets_user_idx ON auth_password_resets (user_id);

-- ---------------------------------------------------------------------
-- PROFILES (dados públicos do usuário; id == auth_users.id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id             TEXT PRIMARY KEY,
  email          TEXT,
  name           TEXT,
  is_super_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_super_admin IN (0,1)),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Índice parcial usado por findProfileByEmail (mesma regra do Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key
  ON profiles (email) WHERE email IS NOT NULL AND email <> '';

-- ---------------------------------------------------------------------
-- EVENTOS (eventos sazonais, multi-tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id          TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  tipo        TEXT NOT NULL,
  estado      TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  circuito    TEXT NOT NULL,
  ano         INTEGER NOT NULL,
  slug        TEXT NOT NULL,
  data_evento TEXT,                                 -- 'YYYY-MM-DD'
  criado_por  TEXT,                                 -- profiles.id (sem FK p/ robustez do import)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS eventos_slug_key ON eventos (slug);
CREATE INDEX IF NOT EXISTS eventos_ano_idx ON eventos (ano DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS eventos_criado_por_idx ON eventos (criado_por);

-- ---------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id             TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  features       TEXT,                              -- JSON, ex.: {"lostItems":true}
  coordenador_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,  -- coluna legada
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS departments_slug_key ON departments (slug);
CREATE INDEX IF NOT EXISTS departments_coordenador_idx ON departments (coordenador_id)
  WHERE coordenador_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- EVENTO_DEPARTAMENTS (junction evento <-> departamento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_departamentos (
  id            TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  evento_id     TEXT NOT NULL REFERENCES eventos (id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS evento_departamentos_evento_department_key
  ON evento_departamentos (evento_id, department_id);
CREATE INDEX IF NOT EXISTS evento_departamentos_department_idx
  ON evento_departamentos (department_id);

-- ---------------------------------------------------------------------
-- DEPARTMENT_MEMBERS (membership + coordenação por evento)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS department_members (
  id            TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('coordenador','assistente')),
  evento_id     TEXT REFERENCES eventos (id) ON DELETE CASCADE,      -- NULL = vínculo legado
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Único (evento_id, department_id) — NULLs são distintos (igual ao Postgres),
-- então vínculos legados (evento_id NULL) não colidem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS department_members_evento_department_key
  ON department_members (evento_id, department_id);

-- Único coordenador por departamento DENTRO de um evento
CREATE UNIQUE INDEX IF NOT EXISTS department_members_one_coordinator_per_event_idx
  ON department_members (department_id, evento_id) WHERE role = 'coordenador';

-- Único coordenador legado (evento_id IS NULL) por departamento
CREATE UNIQUE INDEX IF NOT EXISTS department_members_one_coordinator_no_event_idx
  ON department_members (department_id) WHERE role = 'coordenador' AND evento_id IS NULL;

-- Regra legada: um usuário só pode ter UM vínculo por departamento sem evento
CREATE UNIQUE INDEX IF NOT EXISTS department_members_department_user_legacy_key
  ON department_members (department_id, user_id) WHERE evento_id IS NULL;

CREATE INDEX IF NOT EXISTS department_members_user_idx ON department_members (user_id);
CREATE INDEX IF NOT EXISTS department_members_evento_idx ON department_members (evento_id)
  WHERE evento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS department_members_department_idx ON department_members (department_id);

-- ---------------------------------------------------------------------
-- VOLUNTEERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteers (
  id            TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  congregation  TEXT,
  phone         TEXT,
  availability  TEXT,                               -- JSON (array de slots)
  active        INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS volunteers_department_idx ON volunteers (department_id, created_at DESC);

-- ---------------------------------------------------------------------
-- ESCALA: schedule_blocks -> shifts -> shift_volunteers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id            TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  day           TEXT NOT NULL,                      -- Sexta-feira/Sábado/Domingo/Dia do Evento
  period        TEXT NOT NULL,
  responsible   TEXT,
  accent        TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS schedule_blocks_department_idx
  ON schedule_blocks (department_id, created_at DESC);

CREATE TABLE IF NOT EXISTS shifts (
  id            TEXT PRIMARY KEY,
  block_id      TEXT NOT NULL REFERENCES schedule_blocks (id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  description   TEXT,
  vagas         INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS shifts_block_idx ON shifts (block_id);
CREATE INDEX IF NOT EXISTS shifts_department_idx ON shifts (department_id);

CREATE TABLE IF NOT EXISTS shift_volunteers (
  id            TEXT PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4'
    || substr(hex(randomblob(2)),2) || '-' || lower(hex(randomblob(2)))
    || '-' || hex(randomblob(6))
  ),
  shift_id      TEXT NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
  volunteer_id  TEXT REFERENCES volunteers (id) ON DELETE CASCADE,   -- NULL = nome avulso
  department_id TEXT NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  manual_name   TEXT
);
CREATE INDEX IF NOT EXISTS shift_volunteers_shift_idx ON shift_volunteers (shift_id);
CREATE INDEX IF NOT EXISTS shift_volunteers_department_idx ON shift_volunteers (department_id);
CREATE INDEX IF NOT EXISTS shift_volunteers_volunteer_idx ON shift_volunteers (volunteer_id);
