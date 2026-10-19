import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "../services/supabase";
import type { Evento } from "../types";

const EVENT_STORAGE_KEY = "escalafacil_active_evento_id";

interface EventContextValue {
  activeEvent: Evento | null;
  eventoId: string | null;
  eventLoading: boolean;
  selectEvent: (evento: Evento | null) => void;
  clearEvent: () => void;
  setEventLoading: (loading: boolean) => void;
}

const EventContext = createContext<EventContextValue | null>(null);

function getStoredEventoId(): string | null {
  try {
    return localStorage.getItem(EVENT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeEventoId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(EVENT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(EVENT_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvent, setActiveEvent] = useState<Evento | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const restoredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreEvent() {
      const storedId = getStoredEventoId();
      if (!storedId) {
        if (!cancelled) setEventLoading(false);
        return;
      }

      const TIMEOUT_MS = 8000;
      const query = supabase
        .from("eventos")
        .select("*")
        .eq("id", storedId)
        .maybeSingle();

      const timeout = new Promise<{ timedOut: true }>((resolve) => {
        window.setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS);
      });

      try {
        const result = await Promise.race([query, timeout]);

        if ("timedOut" in result && result.timedOut) {
          console.warn("Busca do evento expirou — seguindo sem evento restaurado.");
          if (!cancelled) storeEventoId(null);
        } else if (!cancelled && "data" in result && result.data) {
          setActiveEvent(result.data as Evento);
        } else if (!cancelled) {
          storeEventoId(null);
        }
      } catch {
        if (!cancelled) storeEventoId(null);
      } finally {
        restoredRef.current = true;
        if (!cancelled) setEventLoading(false);
      }
    }

    restoreEvent();
    return () => { cancelled = true; };
  }, []);

  const selectEvent = useCallback((evento: Evento | null) => {
    setActiveEvent(evento);
    storeEventoId(evento?.id || null);
  }, []);

  const clearEvent = useCallback(() => {
    setActiveEvent(null);
    storeEventoId(null);
  }, []);

  const eventoId = activeEvent?.id || null;

  const value: EventContextValue = {
    activeEvent,
    eventoId,
    eventLoading,
    selectEvent,
    clearEvent,
    setEventLoading,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent deve ser usado dentro de um EventProvider");
  }
  return context;
}
