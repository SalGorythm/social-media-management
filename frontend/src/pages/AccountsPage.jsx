import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import {
  ActionRow,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../components/ui.jsx";

const emptyForm = {
  name: "",
  product: "",
  type: "product",
  platformsText: "instagram, x",
  tone: "",
  frequency: "weekly",
  notes: "",
};

export function AccountsPage() {
  const { personaId } = usePersona();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [promptAccount, setPromptAccount] = useState(null);
  const [aiAccount, setAiAccount] = useState(null);
  const [llmMeta, setLlmMeta] = useState(null);
  const [aiForm, setAiForm] = useState({
    provider: "gemini",
    model: "",
    post_count: 5,
    extra_instructions: "",
  });
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const rows = await api("/api/accounts");
      setAccounts(rows);
    } catch (e) {
      toast.error(e.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [personaId]);

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm);
  }

  function startEdit(acc) {
    setEditingId(acc.id);
    setForm({
      name: acc.name,
      product: acc.product,
      type: acc.type || "product",
      platformsText: (acc.platforms || []).join(", "),
      tone: acc.tone || "",
      frequency: acc.frequency || "weekly",
      notes: acc.notes || "",
    });
  }

  function parsePlatforms(text) {
    return text
      .split(/[,\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async function saveAccount() {
    const platforms = parsePlatforms(form.platformsText);
    if (!form.name.trim() || !form.product.trim()) {
      toast.error("Name and product are required");
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        product: form.product.trim(),
        type: form.type,
        platforms,
        tone: form.tone || null,
        frequency: form.frequency || null,
        notes: form.notes || null,
      };
      if (editingId === "new") {
        await api("/api/accounts", { method: "POST", json: payload });
        toast.success("Account created");
      } else {
        await api(`/api/accounts/${editingId}`, { method: "PUT", json: payload });
        toast.success("Account updated");
      }
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error(e.message || "Save failed");
    }
  }

  async function removeAccount(id) {
    if (!window.confirm("Delete this account? Posts will be deleted (cascade).")) return;
    try {
      await api(`/api/accounts/${id}`, { method: "DELETE" });
      toast.success("Account deleted");
      await load();
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  }

  const promptText = useMemo(() => {
    if (!promptAccount) return "";
    const today = new Date().toISOString().slice(0, 10);
    const iso = new Date().toISOString();
    const platforms = (promptAccount.platforms || []).join(", ");
    const safeName = (promptAccount.name || "").replace(/^@/, "");
    return `Generate social media content for my app and save it as a JSON file in /content-queue folder.

Account: ${promptAccount.name}
Product: ${promptAccount.product}
Tone: ${promptAccount.tone || "—"}
Target audience: ${promptAccount.notes || "—"}
Platforms: ${platforms}
Post types to include: Post, Story, Reel

Generate 7 posts (mix of platforms and post types). 

For each post include:
- platform
- post_type  
- caption (full, ready to publish)
- hashtags (array, 15–20 tags)
- image_prompt (detailed, 100+ words, specify art style, color palette, mood, composition — suitable for DALL-E or Midjourney)
- video_idea (only for reels/stories, otherwise null)
- posting_tip
- scheduled_date (spread across next 7 days from today, ISO format)

Save the output as a single JSON file named:
${today}_${safeName}_batch.json

The file must follow this exact schema:
{
  "account": "${promptAccount.name}",
  "generated_at": "${iso}",
  "posts": [ ... ]
}

Save it in the /content-queue folder at the root of this project.`;
  }, [promptAccount]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Prompt copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function openAiGenerate(acc) {
    setAiAccount(acc);
    try {
      const res = await api("/api/llm/providers");
      setLlmMeta(res);
      const configured = (res.providers || []).filter((p) => p.configured);
      const pick =
        configured.find((p) => p.id === res.default_provider) || configured[0] || res.providers?.[0];
      setAiForm({
        provider: pick?.id || "gemini",
        model: pick?.model || pick?.default_model || "",
        post_count: 5,
        extra_instructions: "",
      });
    } catch (e) {
      toast.error(e.message || "Could not load AI providers");
    }
  }

  async function runAiGenerate() {
    if (!aiAccount) return;
    const provider = (llmMeta?.providers || []).find((p) => p.id === aiForm.provider);
    if (!provider?.configured) {
      toast.error("Configure this provider under AI settings first");
      return;
    }
    setGenerating(true);
    try {
      const out = await api("/api/llm/generate", {
        method: "POST",
        json: {
          account_id: aiAccount.id,
          provider: aiForm.provider,
          model: aiForm.model || null,
          post_count: Number(aiForm.post_count) || 5,
          extra_instructions: aiForm.extra_instructions || "",
        },
      });
      toast.success(`Imported ${out.post_count || 0} post(s) from ${out.file}`);
      setAiAccount(null);
      await load();
    } catch (e) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const selectedProvider = (llmMeta?.providers || []).find((p) => p.id === aiForm.provider);

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Accounts"
        description="Manage handles and tones. Generate via Cursor prompt or in-app AI (Gemini / OpenAI / Grok)."
        actions={<Button onClick={startCreate}>Add account</Button>}
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts"
          description="Seed data should create two accounts on first run. If you see this, check the API and database file."
        />
      ) : (
        <ul className="space-y-4">
          {accounts.map((acc) => (
            <li
              key={acc.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-lg text-slate-900 dark:text-white">{acc.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{acc.product}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Platforms: {(acc.platforms || []).join(", ") || "—"} · Tone: {acc.tone || "—"}
                </p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600 dark:text-slate-400">
                  <span>Total {acc.total_posts}</span>
                  <span>Pending {acc.pending}</span>
                  <span>Approved {acc.approved}</span>
                  <span>Posted {acc.posted}</span>
                </div>
              </div>
              <ActionRow>
                <Button size="sm" onClick={() => openAiGenerate(acc)}>
                  Generate with AI
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPromptAccount(acc)}>
                  Cursor prompt
                </Button>
                <Button size="sm" variant="secondary" onClick={() => startEdit(acc)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => removeAccount(acc.id)}>
                  Delete
                </Button>
              </ActionRow>
            </li>
          ))}
        </ul>
      )}

      {editingId ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h2 className="font-display font-semibold text-lg">
            {editingId === "new" ? "New account" : "Edit account"}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name (handle)">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Product">
              <Input
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="product">product</option>
                <option value="brand">brand</option>
                <option value="personal">personal</option>
              </Select>
            </Field>
            <Field label="Frequency">
              <Select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                <option value="daily">daily</option>
                <option value="twice_a_week">twice_a_week</option>
                <option value="weekly">weekly</option>
              </Select>
            </Field>
          </div>
          <Field label="Platforms (comma-separated)">
            <Input
              value={form.platformsText}
              onChange={(e) => setForm({ ...form, platformsText: e.target.value })}
            />
          </Field>
          <Field label="Tone">
            <Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
          </Field>
          <Field label="Notes / audience">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <ActionRow>
            <Button onClick={saveAccount}>Save</Button>
            <Button variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </ActionRow>
        </div>
      ) : null}

      {promptAccount ? (
        <Modal
          title={`Cursor prompt — ${promptAccount.name}`}
          description="Copy into Cursor, Claude, or Copilot in your IDE. Save the JSON under content-queue/."
          onClose={() => setPromptAccount(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPromptAccount(null)}>
                Close
              </Button>
              <Button onClick={copyPrompt}>Copy prompt</Button>
            </>
          }
        >
          <pre className="text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[50vh] overflow-auto">
            {promptText}
          </pre>
        </Modal>
      ) : null}

      {aiAccount ? (
        <Modal
          title={`Generate with AI — ${aiAccount.name}`}
          description={
            <>
              Uses your saved API key. Output is written to content-queue and imported automatically.{" "}
              <Link to="/settings/ai" className="text-indigo-600 dark:text-indigo-400 underline">
                AI settings
              </Link>
            </>
          }
          onClose={() => setAiAccount(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAiAccount(null)}>
                Cancel
              </Button>
              <Button disabled={generating} onClick={runAiGenerate}>
                {generating ? "Generating…" : "Generate & import"}
              </Button>
            </>
          }
        >
          <Field label="Provider">
            <Select
              value={aiForm.provider}
              onChange={(e) => {
                const id = e.target.value;
                const p = (llmMeta?.providers || []).find((x) => x.id === id);
                setAiForm((f) => ({
                  ...f,
                  provider: id,
                  model: p?.model || p?.default_model || "",
                }));
              }}
            >
              {(llmMeta?.providers || []).map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}
                  {p.configured ? "" : " (not configured)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model">
            <Select
              value={aiForm.model}
              onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
            >
              {(selectedProvider?.models || [aiForm.model]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Number of posts">
            <Input
              type="number"
              min={1}
              max={20}
              value={aiForm.post_count}
              onChange={(e) => setAiForm((f) => ({ ...f, post_count: e.target.value }))}
            />
          </Field>
          <Field label="Extra instructions (optional)">
            <Textarea
              rows={3}
              value={aiForm.extra_instructions}
              onChange={(e) => setAiForm((f) => ({ ...f, extra_instructions: e.target.value }))}
              placeholder="e.g. Focus on launch week; include one reel"
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
