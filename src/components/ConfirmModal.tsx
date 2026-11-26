import { useEffect, useRef, useState, type ReactNode } from "react";

interface ConfirmModalProps {
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  confirmationText?: string;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  confirmationText,
}: ConfirmModalProps) {
  const titleId = useRef(`confirm-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [confirmationValue, setConfirmationValue] = useState("");
  const confirmationMatches = !confirmationText
    || confirmationValue.trim().toLocaleLowerCase() === confirmationText.toLocaleLowerCase();

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="ef-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ef-modal-panel w-full max-w-sm p-6 outline-none"
      >
        <h3 id={titleId} className="ef-h2">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ef-text-2)]">{message}</p>
        {confirmationText && (
          <label className="mt-4 block text-sm font-medium text-[var(--ef-text-2)]">
            Digite <span className="font-bold">{confirmationText}</span> para confirmar:
            <input
              type="text"
              value={confirmationValue}
              onChange={(event) => setConfirmationValue(event.target.value)}
              autoComplete="off"
              className="ef-input mt-2"
              aria-label={`Digite ${confirmationText}`}
            />
          </label>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="ef-btn ef-btn-outline flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmationMatches}
            className={`ef-btn flex-1 disabled:cursor-not-allowed disabled:opacity-50 ${
              danger ? "ef-btn-danger" : "ef-btn-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
