-- =====================================================================
-- Correção: Adicionar coluna department_id em evento_departamentos
-- Execute no Supabase Dashboard > SQL Editor.
-- =====================================================================

-- 1. Adicionar department_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'evento_departamentos'
      AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.evento_departamentos
      ADD COLUMN department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE;

    -- Recriar a constraint UNIQUE caso não exista
    ALTER TABLE public.evento_departamentos
      DROP CONSTRAINT IF EXISTS evento_departamentos_evento_id_department_id_key;

    ALTER TABLE public.evento_departamentos
      ADD CONSTRAINT evento_departamentos_evento_id_department_id_key
      UNIQUE (evento_id, department_id);

    RAISE NOTICE 'Coluna department_id adicionada com sucesso.';
  ELSE
    RAISE NOTICE 'Coluna department_id já existe.';
  END IF;
END $$;
