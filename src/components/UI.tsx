import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { hexToRgba, STAT_ICON_PATHS, dayTheme } from "../utils/helpers";

interface CardProps {
  children?: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`ap-card rounded-card bg-white shadow-card ${className || "p-5"}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  square?: boolean;
  className?: string;
}

export function Button({ children, variant = "primary", square = false, className = "", type = "button", onClick, disabled = false, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 text-sm font-semibold transition disabled:opacity-50";
  const size = square ? "h-10 w-10 rounded-full p-0" : "rounded-full px-8 py-4";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-[#172233] text-white hover:bg-[#101827]",
    outline: "border border-slate-200 bg-white text-[#345C3F] hover:bg-slate-50",
    danger: "bg-[#172233] text-white hover:bg-[#101827]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${size} ${styles[variant] || styles.primary} ${className}`}
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-xl font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
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
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none placeholder:text-slate-300 focus:border-slate-400"
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
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-slate-400"
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
  const iconBackground = hexToRgba(theme.color, 0.1);

  return (
    <Card className="ap-stat-card relative w-[230px] shrink-0 p-9 md:w-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold leading-none text-slate-500">{label}</p>
          <div
            className="ap-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackground, color: theme.color }}
          >
            <StatSvgIcon name={icon} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-bold leading-none text-slate-950 md:text-4xl">{value}</p>
          <p className="mt-3 text-xs leading-snug text-slate-400 md:text-sm">{detail}</p>
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
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
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
      <span className="text-[14px] font-medium text-slate-400">{period}</span>
    </div>
  );
}
