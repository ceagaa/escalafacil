import { useEvent } from "../context/EventContext";
import { getEventoTipoLabel, formatEventoSubtitle } from "../utils/helpers";

export default function EventBadge({ variant = "desktop" }) {
  const { activeEvent, clearEvent } = useEvent();

  if (!activeEvent) return null;

  const tipoLabel = getEventoTipoLabel(activeEvent.tipo);
  const subtitle = formatEventoSubtitle(activeEvent);

  if (variant === "mobile") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#172233]/5 px-3 py-1.5 text-xs font-semibold text-[#172233]">
          <i className="fi fi-rr-calendar text-[10px] text-[#345C3F]" />
          <span className="max-w-[140px] truncate">{tipoLabel}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{activeEvent.ano}</span>
        </span>
        <button
          type="button"
          onClick={clearEvent}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1.5 text-[10px] font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          title="Trocar evento"
        >
          <i className="fi fi-rr-refresh text-[9px]" />
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
            <p className="text-xs font-semibold text-[#d8ff56] truncate">{tipoLabel}</p>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400 truncate">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={clearEvent}
          className="shrink-0 rounded-lg bg-white/5 p-1 text-[10px] text-slate-400 transition hover:bg-white/10 hover:text-[#42d27b]"
          title="Trocar evento"
        >
          <i className="fi fi-rr-refresh block text-[10px]" />
        </button>
      </div>
    </div>
  );
}
