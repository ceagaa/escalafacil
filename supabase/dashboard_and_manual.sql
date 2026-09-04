-- =====================================================================
-- Dashboard + Escala com nome avulso
-- Execute no Supabase Dashboard > SQL Editor (re-executável).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
-- Nome avulso no vínculo voluntário <-> turno
ALTER TABLE public.shift_volunteers
  ADD COLUMN IF NOT EXISTS manual_name text;

-- Descrição/local do turno
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS description text;

-- ---------------------------------------------------------------------
-- 2. RPC: get_dashboard_stats (requer autenticação)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_stats() CASCADE;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_departments', (SELECT count(*)::int FROM public.departments),
    'total_volunteers', (SELECT count(*)::int FROM public.volunteers WHERE active = true),
    'total_coordinators', (
      SELECT count(DISTINCT user_id)::int
      FROM public.department_members
      WHERE role = 'coordenador'
    ),
    'top_department', (
      SELECT d.name
      FROM public.departments d
      LEFT JOIN public.volunteers v ON v.department_id = d.id
      GROUP BY d.id, d.name
      ORDER BY count(v.id) DESC, d.name ASC
      LIMIT 1
    )
  );
$$;

-- ---------------------------------------------------------------------
-- 3. RPC: get_department_owner_by_slug (requer autenticação)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_department_owner_by_slug(text) CASCADE;

CREATE OR REPLACE FUNCTION public.get_department_owner_by_slug(p_slug text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT p.name
  FROM public.departments d
  JOIN public.department_members dm
    ON dm.department_id = d.id
   AND dm.role = 'coordenador'
  JOIN public.profiles p
    ON p.id = dm.user_id
  WHERE d.slug = p_slug
    AND auth.uid() IS NOT NULL
  LIMIT 1;
$$;
