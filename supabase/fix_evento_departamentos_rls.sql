-- =====================================================================
-- Correção: RLS de evento_departamentos (INSERT)
-- O INSERT original exigia is_department_coordinator, mas ao criar um
-- departamento novo o usuário ainda não é coordenador (catch-22).
-- Execute no Supabase Dashboard > SQL Editor.
-- =====================================================================

-- Substituir a política de INSERT para permitir qualquer autenticado
-- (a validação de coordenação é feita pela aplicação)
DROP POLICY IF EXISTS "evento_departamentos_insert_coordinator" ON public.evento_departamentos;
CREATE POLICY "evento_departamentos_insert_auth"
  ON public.evento_departamentos FOR INSERT TO authenticated
  WITH CHECK (true);

-- Garantir que a coluna department_id exista (caso não tenha rodado antes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evento_departamentos'
      AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.evento_departamentos
      ADD COLUMN department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE;

    ALTER TABLE public.evento_departamentos
      DROP CONSTRAINT IF EXISTS evento_departamentos_evento_id_department_id_key;

    ALTER TABLE public.evento_departamentos
      ADD CONSTRAINT evento_departamentos_evento_id_department_id_key
      UNIQUE (evento_id, department_id);
  END IF;
END $$;
