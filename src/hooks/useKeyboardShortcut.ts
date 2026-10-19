import { useEffect } from "react";

interface KeyboardModifiers {
  ctrl?: boolean;
  meta?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: KeyboardModifiers = { ctrl: false, meta: false }
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrlOrMeta = modifiers.ctrl ? (e.ctrlKey || e.metaKey) : true;
      if (e.key === key && ctrlOrMeta) {
        e.preventDefault();
        callback();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, callback, modifiers.ctrl, modifiers.meta]);
}
