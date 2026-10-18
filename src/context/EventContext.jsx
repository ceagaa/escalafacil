import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

const EVENT_STORAGE_KEY = "escalafacil_active_evento_id";
const EventContext = createContext(null);

function getStoredEventoId() {
  try {
    return localStorage.getItem(EVENT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeEventoId(id) {
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

export function EventProvider({ children }) {
  const [activeEvent, setActiveEvent] = useState(null);
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

      const timeout = new Promise((resolve) => {
        window.setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS);
      });

      try {
        const result = await Promise.race([query, timeout]);

        if (result?.timedOut) {
          console.warn("Busca do evento expirou — seguindo sem evento restaurado.");
          if (!cancelled) storeEventoId(null);
        } else if (!cancelled && result?.data) {
          setActiveEvent(result.data);
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

  const selectEvent = useCallback((evento) => {
    setActiveEvent(evento);
    storeEventoId(evento?.id || null);
  }, []);

  const clearEvent = useCallback(() => {
    setActiveEvent(null);
    storeEventoId(null);
  }, []);

  const eventoId = activeEvent?.id || null;

  const value = {
    activeEvent,
    eventoId,
    eventLoading,
    selectEvent,
    clearEvent,
    setEventLoading,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent deve ser usado dentro de um EventProvider");
  }
  return context;
}
