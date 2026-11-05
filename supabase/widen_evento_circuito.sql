-- Permite armazenar a lista completa de circuitos de um evento conjunto.
ALTER TABLE public.eventos
  ALTER COLUMN circuito TYPE text;

NOTIFY pgrst, 'reload schema';
