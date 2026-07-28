import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";
import { api, getStoredPersonaId, setStoredPersonaId } from "../api.js";

const PersonaContext = createContext(null);

export function PersonaProvider() {
  const [personaId, setPersonaId] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshPersonas = useCallback(async () => {
    const list = await api("/api/personas", { skipPersonaHeader: true });
    setPersonas(Array.isArray(list) ? list : []);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let list = await api("/api/personas", { skipPersonaHeader: true });
        if (cancelled) return;
        setPersonas(Array.isArray(list) ? list : []);

        if (!list || list.length === 0) {
          await api("/api/personas", {
            method: "POST",
            json: { name: "Default", description: "Your workspace." },
            skipPersonaHeader: true,
          });
          list = await api("/api/personas", { skipPersonaHeader: true });
          if (cancelled) return;
          setPersonas(Array.isArray(list) ? list : []);
        }

        const activeRes = await api("/api/personas/active", { skipPersonaHeader: true });
        if (cancelled) return;

        const ids = new Set((list || []).map((p) => p.id));
        const stored = getStoredPersonaId();
        let nextId = activeRes?.id;
        if (stored && ids.has(stored)) nextId = stored;
        if (!nextId && list?.length) nextId = list[0].id;

        if (nextId && nextId !== activeRes?.id) {
          await api("/api/personas/active", {
            method: "POST",
            json: { id: nextId },
            skipPersonaHeader: true,
          });
        }

        if (nextId) {
          setStoredPersonaId(nextId);
          setPersonaId(nextId);
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message || "Failed to load personas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchPersona = useCallback(async (id) => {
    try {
      await api("/api/personas/active", {
        method: "POST",
        json: { id },
        skipPersonaHeader: true,
      });
      setStoredPersonaId(id);
      setPersonaId(id);
      toast.success("Persona switched");
    } catch (e) {
      toast.error(e.message || "Could not switch persona");
    }
  }, []);

  const value = useMemo(
    () => ({
      personaId,
      personas,
      loading,
      refreshPersonas,
      switchPersona,
      activePersona: personas.find((p) => p.id === personaId) ?? null,
    }),
    [personaId, personas, loading, refreshPersonas, switchPersona]
  );

  if (loading || personaId == null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm">
        Loading workspace…
      </div>
    );
  }

  return <PersonaContext.Provider value={value}><Outlet /></PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within PersonaProvider");
  return ctx;
}
