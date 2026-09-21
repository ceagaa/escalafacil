import { useEffect } from "react";

export function useBeforeUnload(hasUnsavedChanges) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
