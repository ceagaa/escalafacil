import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { hexToRgba, STAT_ICON_PATHS, dayTheme } from "../utils/helpers";

interface CardProps {
  children?: ReactNode;
  className?: string;
}

/** Card base: superfície em cinza suave, sem borda, raio 20px. */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`ap-card ef-card ${className || "p-5"}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "outline" | "danger" | "dark" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  square?: boolean;
  className?: string;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "ef-btn-primary",
  outline: "ef-btn-outline",
  danger: "ef-btn-danger",
  dark: "ef-btn-dark",
  ghost: "ef-btn-ghost",
};

export function Button({ children, variant = "primary", square = false, className = "", type = "button", onClick, disabled = false, ...rest }: ButtonProps) {
  const size = square ? "ef-btn-square" : "";
  const variantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ef-btn ${variantClass} ${size} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps {
  label: string;
  iconClass: string;
  onClick?: () => void;
}

export function IconButton({ label, iconClass, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--ef-faint)] transition hover:bg-[var(--ef-hover)] hover:text-[var(--ef-text-2)]"
    >
      <i className={iconClass} />
    </button>
  );
}

interface ModalProps {
  title: ReactNode;
  children?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="ef-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ef-modal-panel w-full max-w-lg p-5 outline-none md:p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 id={titleId} className="ef-h2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ef-hover)] text-[var(--ef-muted)] transition hover:text-[var(--ef-text)]"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function Field({ label, value, onChange, required = false, placeholder = "" }: FieldProps) {
  return (
    <label className="block">
      <span className="ef-label">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="ef-input"
      />
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="block">
      <span className="ef-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ef-select"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}


export function StatSvgIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={STAT_ICON_PATHS[name] || STAT_ICON_PATHS.clock} />
    </svg>
  );
}

interface StatProps {
  icon: string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  day: string;
}

export function Stat({ icon, label, value, detail, day }: StatProps) {
  const theme = dayTheme[day] || dayTheme["Sexta-feira"];
  const iconBackground = hexToRgba(theme.color, 0.12);

  return (
    <Card className="ap-stat-card relative w-[230px] shrink-0 p-6 md:w-auto md:p-7">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] font-semibold leading-none text-[var(--ef-muted)]">{label}</p>
          <div
            className="ap-stat-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackground, color: theme.color }}
          >
            <StatSvgIcon name={icon} />
          </div>
        </div>
        <div>
          <p className="text-[30px] font-bold leading-none tracking-tight text-[var(--ef-text)] md:text-[34px]">{value}</p>
          <p className="mt-3 text-xs leading-snug text-[var(--ef-faint)] md:text-[13px]">{detail}</p>
        </div>
      </div>
    </Card>
  );
}

interface LiveNowBadgeProps {
  color: string;
  backgroundColor: string;
}

export function LiveNowBadge({ color, backgroundColor }: LiveNowBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor, color }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      AGORA
    </span>
  );
}

interface DayBadgeProps {
  day: string;
  period: string;
}

export function DayBadge({ day, period }: DayBadgeProps) {
  const theme = dayTheme[day] || dayTheme["Sexta-feira"];
  return (
    <div className="flex flex-col gap-1 leading-none">
      <span className="text-[16px] font-semibold" style={{ color: theme.color }}>
        {day}
      </span>
      <span className="text-[14px] font-medium text-[var(--ef-muted)]">{period}</span>
    </div>
  );
}
