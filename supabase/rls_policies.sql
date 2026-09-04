-- =====================================================================
-- App Achados e Perdidos - Migração multi-tenant + RLS (v6)
-- Execute no Supabase Dashboard > SQL Editor.
-- Re-executável. Rode e cole QUALQUER erro que aparecer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Limpeza de dados duplicados (para os índices únicos não falharem)
-- ---------------------------------------------------------------------
-- Mantém apenas UMA linha por (department_id, user_id)
DELETE FROM public.department_members a
USING public.department_members b
WHERE a.ctid < b.ctid
  AND a.department_id = b.department_id
  AND a.user_id = b.user_id;

-- Mantém apenas UM coordenador por departamento
DELETE FROM public.department_members a
USING public.department_members b
WHERE a.role = 'coordenador'
  AND b.role = 'coordenador'
  AND a.department_id = b.department_id
  AND a.ctid < b.ctid;

-- ---------------------------------------------------------------------
-- 1. Colunas que faltam no esquema (multi-tenant)
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.volunteers
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS availability text;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS department_id uuid;

ALTER TABLE public.shift_volunteers
  ADD COLUMN IF NOT EXISTS department_id uuid;

-- Chaves únicas para os ids referenciados pelas FKs
CREATE UNIQUE INDEX IF NOT EXISTS schedule_blocks_id_key ON public.schedule_blocks (id);
CREATE UNIQUE INDEX IF NOT EXISTS shifts_id_key ON public.shifts (id);

-- Índice de e-mail (usado por findProfileByEmail)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key
  ON public.profiles (email)
  WHERE email IS NOT NULL AND email <> '';

-- ---------------------------------------------------------------------
-- 2. Foreign Keys (o PostgREST precisa delas para resolver os joins)
-- ---------------------------------------------------------------------
ALTER TABLE public.department_members
  DROP CONSTRAINT IF EXISTS department_members_department_id_fkey;
ALTER TABLE public.department_members
  ADD CONSTRAINT department_members_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.department_members
  DROP CONSTRAINT IF EXISTS department_members_user_id_fkey;
ALTER TABLE public.department_members
  ADD CONSTRAINT department_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.volunteers
  DROP CONSTRAINT IF EXISTS volunteers_department_id_fkey;
ALTER TABLE public.volunteers
  ADD CONSTRAINT volunteers_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.lost_items
  DROP CONSTRAINT IF EXISTS lost_items_department_id_fkey;
ALTER TABLE public.lost_items
  ADD CONSTRAINT lost_items_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.schedule_blocks
  DROP CONSTRAINT IF EXISTS schedule_blocks_department_id_fkey;
ALTER TABLE public.schedule_blocks
  ADD CONSTRAINT schedule_blocks_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_department_id_fkey;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_block_id_fkey;
ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_block_id_fkey
  FOREIGN KEY (block_id) REFERENCES public.schedule_blocks (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.shift_volunteers
  DROP CONSTRAINT IF EXISTS shift_volunteers_department_id_fkey;
ALTER TABLE public.shift_volunteers
  ADD CONSTRAINT shift_volunteers_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.shift_volunteers
  DROP CONSTRAINT IF EXISTS shift_volunteers_shift_id_fkey;
ALTER TABLE public.shift_volunteers
  ADD CONSTRAINT shift_volunteers_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES public.shifts (id)
  ON DELETE CASCADE NOT VALID;

ALTER TABLE public.shift_volunteers
  DROP CONSTRAINT IF EXISTS shift_volunteers_volunteer_id_fkey;
ALTER TABLE public.shift_volunteers
  ADD CONSTRAINT shift_volunteers_volunteer_id_fkey
  FOREIGN KEY (volunteer_id) REFERENCES public.volunteers (id)
  ON DELETE CASCADE NOT VALID;

-- ---------------------------------------------------------------------
-- 3. Backfill de dados existentes
-- ---------------------------------------------------------------------
INSERT INTO public.profiles (id, email, name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email <> u.email);

DO $$
DECLARE dept_id uuid;
BEGIN
  SELECT id INTO dept_id
  FROM public.departments
  WHERE slug = 'achados-perdidos-guarda-volumes'
  LIMIT 1;

  IF dept_id IS NOT NULL THEN
    UPDATE public.volunteers SET department_id = dept_id WHERE department_id IS NULL;
    UPDATE public.schedule_blocks SET department_id = dept_id WHERE department_id IS NULL;
    UPDATE public.shifts SET department_id = dept_id WHERE department_id IS NULL;
    UPDATE public.shift_volunteers SET department_id = dept_id WHERE department_id IS NULL;
    UPDATE public.lost_items SET department_id = dept_id WHERE department_id IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Trigger: cria a linha em profiles no cadastro
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email),
        name = CASE
          WHEN public.profiles.name IS NULL OR public.profiles.name = ''
            THEN EXCLUDED.name
          ELSE public.profiles.name
        END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5. Funções auxiliares (evitam recursão infinita de RLS)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_department_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_department_coordinator(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.department_has_coordinator(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_department_member(p_department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members dm
    WHERE dm.department_id = p_department_id
      AND dm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_department_coordinator(p_department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members dm
    WHERE dm.department_id = p_department_id
      AND dm.user_id = auth.uid()
      AND dm.role = 'coordenador'
  );
$$;

CREATE OR REPLACE FUNCTION public.department_has_coordinator(p_department_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members dm
    WHERE dm.department_id = p_department_id
      AND dm.role = 'coordenador'
  );
$$;

-- ---------------------------------------------------------------------
-- 6. Habilitar RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_volunteers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 7. profiles
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. departments
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "departments_select_public" ON public.departments;
CREATE POLICY "departments_select_public"
  ON public.departments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "departments_insert_auth" ON public.departments;
CREATE POLICY "departments_insert_auth"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "departments_update_coordinator" ON public.departments;
CREATE POLICY "departments_update_coordinator"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.is_department_coordinator(id));

-- ---------------------------------------------------------------------
-- 9. department_members
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS department_members_department_user_key
  ON public.department_members (department_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS department_members_one_coordinator_idx
  ON public.department_members (department_id)
  WHERE role = 'coordenador';

DROP POLICY IF EXISTS "department_members_select" ON public.department_members;
CREATE POLICY "department_members_select"
  ON public.department_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_department_coordinator(department_id)
  );

DROP POLICY IF EXISTS "department_members_select_coordinator_public" ON public.department_members;
CREATE POLICY "department_members_select_coordinator_public"
  ON public.department_members FOR SELECT TO authenticated
  USING (role = 'coordenador');

DROP POLICY IF EXISTS "department_members_claim_coordinator" ON public.department_members;
CREATE POLICY "department_members_claim_coordinator"
  ON public.department_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'coordenador'
    AND NOT public.department_has_coordinator(department_id)
  );

DROP POLICY IF EXISTS "department_members_add_assistant" ON public.department_members;
CREATE POLICY "department_members_add_assistant"
  ON public.department_members FOR INSERT TO authenticated
  WITH CHECK (
    role = 'assistente'
    AND public.is_department_coordinator(department_id)
  );

DROP POLICY IF EXISTS "department_members_delete_by_coordinator" ON public.department_members;
CREATE POLICY "department_members_delete_by_coordinator"
  ON public.department_members FOR DELETE TO authenticated
  USING (
    public.is_department_coordinator(department_id)
    AND role <> 'coordenador'
  );

-- ---------------------------------------------------------------------
-- 10. volunteers
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "volunteers_public_insert" ON public.volunteers;
CREATE POLICY "volunteers_public_insert"
  ON public.volunteers FOR INSERT
  WITH CHECK (active = false);

DROP POLICY IF EXISTS "volunteers_public_select_active" ON public.volunteers;
CREATE POLICY "volunteers_public_select_active"
  ON public.volunteers FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "volunteers_member_select" ON public.volunteers;
CREATE POLICY "volunteers_member_select"
  ON public.volunteers FOR SELECT TO authenticated
  USING (public.is_department_member(department_id));

DROP POLICY IF EXISTS "volunteers_member_update" ON public.volunteers;
CREATE POLICY "volunteers_member_update"
  ON public.volunteers FOR UPDATE TO authenticated
  USING (public.is_department_member(department_id))
  WITH CHECK (public.is_department_member(department_id));

DROP POLICY IF EXISTS "volunteers_member_delete" ON public.volunteers;
CREATE POLICY "volunteers_member_delete"
  ON public.volunteers FOR DELETE TO authenticated
  USING (public.is_department_member(department_id));

-- ---------------------------------------------------------------------
-- 11. lost_items
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "lost_items_member_select" ON public.lost_items;
CREATE POLICY "lost_items_member_select"
  ON public.lost_items FOR SELECT TO authenticated
  USING (public.is_department_member(department_id));

DROP POLICY IF EXISTS "lost_items_member_insert" ON public.lost_items;
CREATE POLICY "lost_items_member_insert"
  ON public.lost_items FOR INSERT TO authenticated
  WITH CHECK (public.is_department_member(department_id));

DROP POLICY IF EXISTS "lost_items_member_update" ON public.lost_items;
CREATE POLICY "lost_items_member_update"
  ON public.lost_items FOR UPDATE TO authenticated
  USING (public.is_department_member(department_id))
  WITH CHECK (public.is_department_member(department_id));

DROP POLICY IF EXISTS "lost_items_member_delete" ON public.lost_items;
CREATE POLICY "lost_items_member_delete"
  ON public.lost_items FOR DELETE TO authenticated
  USING (public.is_department_member(department_id));

-- ---------------------------------------------------------------------
-- 12. Escala
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_blocks_public_select" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks_public_select"
  ON public.schedule_blocks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shifts_public_select" ON public.shifts;
CREATE POLICY "shifts_public_select"
  ON public.shifts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shift_volunteers_public_select" ON public.shift_volunteers;
CREATE POLICY "shift_volunteers_public_select"
  ON public.shift_volunteers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "schedule_blocks_member_all" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks_member_all"
  ON public.schedule_blocks FOR ALL TO authenticated
  USING (public.is_department_member(department_id))
  WITH CHECK (public.is_department_member(department_id));

DROP POLICY IF EXISTS "shifts_member_all" ON public.shifts;
CREATE POLICY "shifts_member_all"
  ON public.shifts FOR ALL TO authenticated
  USING (public.is_department_member(department_id))
  WITH CHECK (public.is_department_member(department_id));

DROP POLICY IF EXISTS "shift_volunteers_member_all" ON public.shift_volunteers;
CREATE POLICY "shift_volunteers_member_all"
  ON public.shift_volunteers FOR ALL TO authenticated
  USING (public.is_department_member(department_id))
  WITH CHECK (public.is_department_member(department_id));
