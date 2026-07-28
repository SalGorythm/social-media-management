import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { EmptyState } from "../components/EmptyState.jsx";

export function PersonasPage() {
  const { personaId, personas, refreshPersonas, switchPersona } = usePersona();
  const [selectedId, setSelectedId] = useState(personaId);
  const [contextDraft, setContextDraft] = useState("");
  const [appendDraft, setAppendDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const selected = personas.find((p) => p.id === selectedId) ?? personas[0];

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      const row = await api(`/api/personas/${selectedId}`, { skipPersonaHeader: true });
      setContextDraft(row.context ?? "");
    } catch (e) {
      toast.error(e.message || "Failed to load persona");
    }
  }, [selectedId]);

  useEffect(() => {
    setSelectedId(personaId);
  }, [personaId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function saveContext() {
    try {
      const row = await api(`/api/personas/${selectedId}`, {
        method: "PUT",
        json: { context: contextDraft },
        skipPersonaHeader: true,
      });
      setContextDraft(row.context ?? "");
      toast.success("Context saved");
      await refreshPersonas();
    } catch (e) {
      toast.error(e.message || "Save failed");
    }
  }

  async function appendContext() {
    if (!appendDraft.trim()) {
      toast.message("Nothing to append");
      return;
    }
    try {
      await api(`/api/personas/${selectedId}/context`, {
        method: "POST",
        json: { text: appendDraft, append: true, source_label: "Pasted block" },
        skipPersonaHeader: true,
      });
      toast.success("Appended to context");
      setAppendDraft("");
      await refreshPersonas();
      await loadDetail();
    } catch (e) {
      toast.error(e.message || "Append failed");
    }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".md") && !ext.endsWith(".txt") && !ext.endsWith(".markdown")) {
      toast.error("Please upload a .md or .txt file");
      return;
    }
    try {
      const text = await file.text();
      await api(`/api/personas/${selectedId}/context`, {
        method: "POST",
        json: { text, append: true, source_label: file.name },
        skipPersonaHeader: true,
      });
      toast.success(`Uploaded ${file.name}`);
      await refreshPersonas();
      await loadDetail();
    } catch (err) {
      toast.error(err.message || "Upload failed");
    }
  }

  async function createPersona() {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const row = await api("/api/personas", {
        method: "POST",
        json: { name: newName.trim(), description: newDescription.trim() || null },
        skipPersonaHeader: true,
      });
      toast.success("Persona created");
      setNewName("");
      setNewDescription("");
      await refreshPersonas();
      await switchPersona(row.id);
      setSelectedId(row.id);
    } catch (e) {
      toast.error(e.message || "Create failed");
    }
  }

  async function deletePersona(id) {
    if (!window.confirm("Delete this persona and all its accounts and posts?")) return;
    try {
      await api(`/api/personas/${id}`, { method: "DELETE", skipPersonaHeader: true });
      toast.success("Persona deleted");
      await refreshPersonas();
      const list = await api("/api/personas", { skipPersonaHeader: true });
      const next = list[0]?.id;
      if (next) await switchPersona(next);
      setSelectedId(next ?? personaId);
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
          Personas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
          Each persona is a separate app or product context. Accounts and posts are scoped to the
          active persona. Use context for Cursor prompts and internal reference.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white">New persona</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. My App)"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={createPersona}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Add persona
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white">Your personas</h2>
        {personas.length === 0 ? (
          <EmptyState title="No personas" description="This should not happen — reload the app." />
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {personas.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                  {p.description ? (
                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.id === personaId ? (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => switchPersona(p.id)}
                      className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1"
                    >
                      Switch to
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1"
                  >
                    Edit context
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePersona(p.id)}
                    disabled={personas.length <= 1}
                    className="text-xs rounded-lg bg-rose-600 text-white px-2 py-1 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">
            Context — {selected.name}
          </h2>
          <p className="text-xs text-slate-500">
            Full markdown or notes for this app. Replace below, or append / upload without wiping
            existing text.
          </p>
          <textarea
            rows={14}
            value={contextDraft}
            onChange={(e) => setContextDraft(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveContext}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save context
            </button>
            <label className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              Upload .md / .txt
              <input type="file" accept=".md,.txt,.markdown,text/plain" className="hidden" onChange={uploadFile} />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Append snippet
            </label>
            <textarea
              rows={4}
              value={appendDraft}
              onChange={(e) => setAppendDraft(e.target.value)}
              placeholder="Paste a section to append to the end with a divider…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
            />
            <button
              type="button"
              onClick={appendContext}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm"
            >
              Append to context
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
