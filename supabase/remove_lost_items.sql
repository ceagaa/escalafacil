-- =====================================================================
-- Migração: Desativar módulo 'Itens Perdidos' (mantém dados históricos)
-- Execute no Supabase Dashboard > SQL Editor.
-- =====================================================================

-- 1. Desativar departamento (mantém dados para auditoria futura)
UPDATE public.departments
SET active = false
WHERE slug = 'achados-perdidos-guarda-volumes'
   OR name ILIKE '%achados%'
   OR name ILIKE '%perdidos%'
   OR name ILIKE '%guarda volumes%'
   OR name ILIKE '%guarda-volumes%'
   OR name ILIKE '%item%perdido%';

-- 2. Remover membros vinculados ao departamento desativado
DELETE FROM public.department_members
WHERE department_id IN (
  SELECT id FROM public.departments
  WHERE slug = 'achados-perdidos-guarda-volumes'
     OR name ILIKE '%achados%'
     OR name ILIKE '%perdidos%'
     OR name ILIKE '%guarda volumes%'
     OR name ILIKE '%guarda-volumes%'
     OR name ILIKE '%item%perdido%'
);

-- 3. Limpar coluna features (remover chave lostItems)
UPDATE public.departments
SET features = features - 'lostItems'
WHERE features ? 'lostItems';

-- 4. (Opcional) Marcar shifts/histórico como inativo para auditoria
-- Descomente as linhas abaixo se quiser desativar turnos do módulo
-- UPDATE public.shifts
-- SET active = false
-- WHERE department_id IN (
--   SELECT id FROM public.departments
--   WHERE slug = 'achados-perdidos-guarda-volumes'
--      OR name ILIKE '%achados%'
--      OR name ILIKE '%perdidos%'
-- );
