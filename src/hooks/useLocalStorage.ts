import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Estado persistido no localStorage.
 *
 * - `initialValue` é usado quando não há nada salvo ou quando o JSON salvo é inválido.
 * - `sanitizer` valida o valor lido antes de entregá-lo ao componente.
 * - A gravação só acontece quando o valor muda de verdade (comparação por
 *   serialização), evitando regravar o snapshot inteiro a cada render.
 * - Sincroniza entre abas pelo evento `storage`.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  sanitizer?: (value: unknown) => T
): [T, Dispatch<SetStateAction<T>>] {
  const serialize = (value: T): string | null => {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  };

  const readStored = useCallback((): T => {
    try {
      if (typeof window === "undefined") return initialValue;
      const saved = window.localStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : initialValue;
      return sanitizer ? sanitizer(parsed) : (parsed as T);
    } catch {
      return initialValue;
    }
    // initialValue/sanitizer são intencionalmente fora das deps: só a chave deve
    // disparar uma nova leitura do storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [value, setValue] = useState<T>(readStored);
  const lastWrittenRef = useRef<string | null>(serialize(value));

  useEffect(() => {
    const serialized = serialize(value);
    if (serialized === null || serialized === lastWrittenRef.current) return;
    try {
      window.localStorage.setItem(key, serialized);
      lastWrittenRef.current = serialized;
    } catch {
      console.warn("Não foi possível salvar " + key + " no localStorage.");
    }
  }, [key, value]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== key || event.newValue === null) return;
      try {
        const parsed = JSON.parse(event.newValue);
        const next = sanitizer ? sanitizer(parsed) : (parsed as T);
        lastWrittenRef.current = serialize(next);
        setValue(next);
      } catch {
        // valor de outra aba inválido: ignora
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue];
}
