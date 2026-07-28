import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import clsx from "clsx";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { platformIcon, platformLabel } from "../lib/platforms.js";

const PLATFORMS = ["", "instagram", "x", "threads", "facebook", "reddit"];
const POST_TYPES = ["", "post", "story", "reel", "carousel"];

function formatHashtags(tags = []) {
  return tags.map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" ");
}

export function PostedArchive() {
  const { personaId } = usePersona();
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    account_id: "",
    platform: "",
    post_type: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [promptOpen, setPromptOpen] = useState({});
  const [selected, setSelected] = useState({});

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set("status", "posted");
    if (filters.account_id) q.set("account_id", filters.account_id);
    if (filters.platform) q.set("platform", filters.platform);
    if (filters.post_type) q.set("post_type", filters.post_type);
    if (filters.date_from) q.set("date_from", filters.date_from);
    if (filters.date_to) q.set("date_to", filters.date_to);
    return `?${q.toString()}`;
  }, [filters]);

  async function loadAccounts() {
    const rows = await api("/api/accounts");
    setAccounts(rows);
  }

  async function loadPosts() {
    setLoading(true);
    try {
      const rows = await api(`/api/posts${query}`);
      setPosts(rows);
      setSelected({});
    } catch (e) {
      toast.error(e.message || "Failed to load posted content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts().catch(() => {});
  }, [personaId]);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, personaId]);

  function toggleSelect(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectedIds() {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
  }

  async function deleteOne(id) {
    if (!window.confirm("Delete this posted record from the app?")) return;
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setSelected((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  }

  async function deleteSelected() {
    const ids = selectedIds();
    if (ids.length === 0) {
      toast.message("Select at least one post");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} posted record(s)?`)) return;
    try {
      for (const id of ids) {
        await api(`/api/posts/${id}`, { method: "DELETE" });
      }
      setPosts((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelected({});
      toast.success(`Deleted ${ids.length} post(s)`);
    } catch (e) {
      toast.error(e.message || "Delete failed");
    }
  }

  async function copyText(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
            Posted archive
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Content you have already published manually. Review, copy, or remove records here.
          </p>
        </div>
        <Link
          to="/review"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Back to review queue
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-end rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <FilterSelect
          label="Account"
          value={filters.account_id}
          onChange={(v) => setFilters((f) => ({ ...f, account_id: v }))}
          options={[
            { value: "", label: "All" },
            ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
          ]}
        />
        <FilterSelect
          label="Platform"
          value={filters.platform}
          onChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
          options={PLATFORMS.map((p) => ({
            value: p,
            label: p ? platformLabel(p) : "All",
          }))}
        />
        <FilterSelect
          label="Post type"
          value={filters.post_type}
          onChange={(v) => setFilters((f) => ({ ...f, post_type: v }))}
          options={POST_TYPES.map((p) => ({
            value: p,
            label: p ? p : "All",
          }))}
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Scheduled from</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Scheduled to</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={deleteSelected}
          className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          Delete selected
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posted content yet"
          description="When you mark items as posted in the review queue, they will appear here for reference and cleanup."
          action={
            <Link
              to="/review"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Go to review queue
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm"
            >
              <div className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  checked={!!selected[post.id]}
                  onChange={() => toggleSelect(post.id)}
                  className="mt-1.5 rounded border-slate-300"
                  aria-label={`Select post ${post.id}`}
                />
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg" title={post.platform}>
                      {platformIcon(post.platform)}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {post.account_name}
                    </span>
                    <span className="text-slate-500 text-sm">{platformLabel(post.platform)}</span>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium capitalize">
                      {post.post_type}
                    </span>
                    <span className="rounded-full bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100 px-2 py-0.5 text-xs font-medium capitalize">
                      posted
                    </span>
                    {post.scheduled_date ? (
                      <span className="text-xs text-slate-500">{post.scheduled_date}</span>
                    ) : null}
                  </div>

                  <div>
                    <p
                      className={clsx(
                        "text-slate-800 dark:text-slate-100 whitespace-pre-wrap",
                        expanded[post.id] ? "" : "line-clamp-4"
                      )}
                    >
                      {post.caption}
                    </p>
                    <button
                      type="button"
                      className="text-sm text-indigo-600 dark:text-indigo-400 mt-1"
                      onClick={() => setExpanded((e) => ({ ...e, [post.id]: !e[post.id] }))}
                    >
                      {expanded[post.id] ? "Show less" : "Expand caption"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(post.hashtags || []).slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200"
                      >
                        #{tag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>

                  {post.posting_tip ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Tip: </span>
                      {post.posting_tip}
                    </p>
                  ) : null}

                  <div>
                    <button
                      type="button"
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
                      onClick={() => setPromptOpen((p) => ({ ...p, [post.id]: !p[post.id] }))}
                    >
                      {promptOpen[post.id] ? "Hide image prompt" : "Image prompt"}
                    </button>
                    {promptOpen[post.id] && post.image_prompt ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                        {post.image_prompt}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      to={`/posts/${post.id}`}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium"
                    >
                      View / edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => copyText(post.caption, "Caption copied")}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
                    >
                      Copy caption
                    </button>
                    {(post.hashtags || []).length > 0 ? (
                      <button
                        type="button"
                        onClick={() => copyText(formatHashtags(post.hashtags), "Hashtags copied")}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
                      >
                        Copy hashtags
                      </button>
                    ) : null}
                    {post.image_prompt ? (
                      <button
                        type="button"
                        onClick={() => copyText(post.image_prompt, "Image prompt copied")}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
                      >
                        Copy image prompt
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteOne(post.id)}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1 min-w-[8rem]">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
