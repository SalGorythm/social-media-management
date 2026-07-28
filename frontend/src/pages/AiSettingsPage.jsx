import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api.js";

export function AiSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api("/api/llm/providers");
      setData(res);
      const next = {};
      for (const p of res.providers || []) {
        next[p.id] = { api_key: "", model: p.model || p.default_model };
      }
      setDrafts(next);
    } catch (e) {
      toast.error(e.message || "Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProvider(providerId) {
    const draft = drafts[providerId] || {};
    if (!draft.api_key?.trim()) {
      toast.error("Paste an API key first");
      return;
    }
    setSaving(providerId);
    try {
      await api(`/api/llm/providers/${providerId}`, {
        method: "PUT",
        json: { api_key: draft.api_key.trim(), model: draft.model },
      });
      toast.success("API key saved (encrypted at rest)");
      setDrafts((d) => ({ ...d, [providerId]: { ...d[providerId], api_key: "" } }));
      await load();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function removeProvider(providerId) {
    if (!window.confirm("Remove this API key from your account?")) return;
    try {
      await api(`/api/llm/providers/${providerId}`, { method: "DELETE" });
      toast.success("Key removed");
      await load();
    } catch (e) {
      toast.error(e.message || "Remove failed");
    }
  }

  async function setDefault(providerId) {
    try {
      await api("/api/llm/default", { method: "POST", json: { provider: providerId } });
      toast.success("Default provider updated");
      await load();
    } catch (e) {
      toast.error(e.message || "Could not set default");
    }
  }

  if (loading && !data) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
          AI settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-2xl">
          Store your own LLM API keys (per user, encrypted with the server secret). Keys are never
          shown in full after save. Cursor / Claude / Copilot in your IDE still work via{" "}
          <Link to="/accounts" className="text-indigo-600 dark:text-indigo-400 underline">
            Generate prompt
          </Link>{" "}
          — no key needed here.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="font-display font-semibold text-slate-900 dark:text-white">
          IDE assistants (no API key)
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          {data?.cursor_workflow?.description}
        </p>
      </section>

      <ul className="space-y-4">
        {(data?.providers || []).map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{p.label}</p>
                <p className="text-xs text-slate-500 mt-1">{p.free_tier_note}</p>
                <a
                  href={p.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 underline mt-1 inline-block"
                >
                  Get an API key
                </a>
              </div>
              <div className="text-xs text-slate-500">
                {p.configured ? (
                  <span>
                    Configured {p.key_hint ? `(${p.key_hint})` : ""}
                    {data?.default_provider === p.id ? " · default" : ""}
                  </span>
                ) : (
                  <span>Not configured</span>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">API key</label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={p.configured ? "Paste new key to replace" : "Paste API key"}
                  value={drafts[p.id]?.api_key || ""}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [p.id]: { ...d[p.id], api_key: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Model</label>
                <select
                  value={drafts[p.id]?.model || p.default_model}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [p.id]: { ...d[p.id], model: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {(p.models || [p.default_model]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving === p.id}
                onClick={() => saveProvider(p.id)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving === p.id ? "Saving…" : p.configured ? "Update key" : "Save key"}
              </button>
              {p.configured ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDefault(p.id)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                  >
                    Set default
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProvider(p.id)}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white"
                  >
                    Remove
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
