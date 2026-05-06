import { useState, useEffect } from "react";

export function useLocalStorage(key, initialValue, sanitizer) {
  const [value, setValue] = useState(() => {
    try {
      if (typeof window === "undefined") return initialValue;
      const saved = window.localStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : initialValue;
      return sanitizer ? sanitizer(parsed) : parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn("Não foi possível salvar " + key + " no localStorage.");
    }
  }, [key, value]);

  return [value, setValue];
}
