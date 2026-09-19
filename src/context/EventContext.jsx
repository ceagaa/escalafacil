import { createContext, useContext, useState, useCallback } from "react";

const EventContext = createContext(null);

export function EventProvider({ children }) {
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);

  const selectEvent = useCallback((evento) => {
    setActiveEvent(evento);
  }, []);

  const clearEvent = useCallback(() => {
    setActiveEvent(null);
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
