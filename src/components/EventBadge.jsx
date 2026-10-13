import { useEvent } from "../context/EventContext";
import { formatEventoNome, formatEventoDate } from "../utils/helpers";

export default function EventBadge({ variant = "desktop" }) {
  const { activeEvent, clearEvent } = useEvent();

  if (!activeEvent) return null;

  const nomeLabel = formatEventoNome(activeEvent);
  const dateLabel = formatEventoDate(activeEvent);

  if (variant === "mobile") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/5 px-3 py-1.5 text-xs font-semibold text-navy-800">
          <i className="fi fi-rr-calendar text-[10px] text-brand-400" />
          <span className="max-w-[180px] truncate">{nomeLabel}</span>
          {dateLabel && (
            <>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{dateLabel}</span>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={clearEvent}
          aria-label="Trocar evento"
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1.5 text-[10px] font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <i className="fi fi-rr-refresh text-[9px]" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <i className="fi fi-rr-calendar text-xs text-[#d8ff56]" />
            <p className="text-xs font-semibold text-[#d8ff56] truncate">{nomeLabel}</p>
          </div>
          {dateLabel && (
            <p className="mt-0.5 text-[10px] text-brand-400">
              <i className="fi fi-rr-calendar mr-1 text-[8px]" />
              {dateLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={clearEvent}
          aria-label="Trocar evento"
          className="shrink-0 rounded-lg bg-white/5 p-1 text-[10px] text-slate-400 transition hover:bg-white/10 hover:text-brand-400"
        >
          <i className="fi fi-rr-refresh block text-[10px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
