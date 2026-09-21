import { useState, useEffect } from "react";
import { Modal } from "./UI";
import { getDepartmentHistory, importVolunteersFromEvento } from "../services/eventService";
import { getEventoTipoLabel } from "../utils/helpers";

export default function ImportVolunteersModal({ departmentId, departmentName, eventoId, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    setLoading(true);
    getDepartmentHistory(departmentId, eventoId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [departmentId, eventoId]);

  async function handleImport(fromEventoId) {
    setImporting(true);
    try {
      const res = await importVolunteersFromEvento(fromEventoId, departmentId);
      setResult(res);
    } catch {
      setResult({ imported: 0, message: "Erro ao importar voluntários." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Importar Voluntários" onClose={onClose}>
      {loading ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-400">Carregando histórico...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="py-6 text-center">
          <i className="fi fi-rr-folder-open text-3xl text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Nenhum histórico encontrado para <strong>{departmentName}</strong>.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Você não coordenou este departamento em eventos anteriores.
          </p>
        </div>
      ) : result ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#42d27b]/15">
            <i className="fi fi-rr-check text-xl text-[#2a9d5c]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#172233]">
            {result.message || `${result.imported} voluntário(s) importado(s).`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-[#42d27b] px-4 py-2 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868]"
          >
            Fechar
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Você já foi coordenador de <strong>{departmentName}</strong> em eventos passados.
            Deseja importar a lista de voluntários de algum deles?
          </p>
          <div className="mt-4 space-y-2">
            {history.map((entry) => {
              const ev = entry.eventos;
              return (
                <div
                  key={entry.evento_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#172233]">
                      {getEventoTipoLabel(ev.tipo)} — {ev.ano}
                    </p>
                    <p className="text-xs text-slate-400">
                      {ev.cidade}/{ev.estado}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleImport(entry.evento_id)}
                    disabled={importing}
                    className="rounded-lg bg-[#345C3F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2a4a31] disabled:opacity-50"
                  >
                    {importing ? "Importando..." : "Importar"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
