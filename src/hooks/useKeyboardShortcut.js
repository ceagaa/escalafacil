import { useEffect } from "react";

export function useKeyboardShortcut(key, callback, modifiers = { ctrl: false, meta: false }) {
  useEffect(() => {
    function handleKeyDown(e) {
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
