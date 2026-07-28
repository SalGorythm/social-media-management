import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import {
  ActionRow,
  Button,
  FilterDate,
  FilterSelect,
  LinkButton,
  PageHeader,
} from "../components/ui.jsx";
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
      <PageHeader
        title="Posted archive"
        description="Content you have already published manually. Review, copy, or remove records here."
        actions={<LinkButton to="/review">Back to review queue</LinkButton>}
      />

      <div className="flex flex-wrap gap-3 items-end rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
        <FilterDate
          label="Scheduled from"
          value={filters.date_from}
          onChange={(v) => setFilters((f) => ({ ...f, date_from: v }))}
        />
        <FilterDate
          label="Scheduled to"
          value={filters.date_to}
          onChange={(v) => setFilters((f) => ({ ...f, date_to: v }))}
        />
      </div>

      <ActionRow>
        <Button size="sm" variant="danger" onClick={deleteSelected}>
          Delete selected
        </Button>
      </ActionRow>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posted content yet"
          description="When you mark items as posted in the review queue, they will appear here for reference and cleanup."
          action={<LinkButton to="/review" variant="primary">Go to review queue</LinkButton>}
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
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1"
                      onClick={() => setExpanded((e) => ({ ...e, [post.id]: !e[post.id] }))}
                    >
                      {expanded[post.id] ? "Show less" : "Expand caption"}
                    </Button>
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
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setPromptOpen((p) => ({ ...p, [post.id]: !p[post.id] }))}
                    >
                      {promptOpen[post.id] ? "Hide image prompt" : "Image prompt"}
                    </Button>
                    {promptOpen[post.id] && post.image_prompt ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                        {post.image_prompt}
                      </p>
                    ) : null}
                  </div>

                  <ActionRow className="pt-1">
                    <LinkButton to={`/posts/${post.id}`} size="sm">
                      View / edit
                    </LinkButton>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyText(post.caption, "Caption copied")}
                    >
                      Copy caption
                    </Button>
                    {(post.hashtags || []).length > 0 ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyText(formatHashtags(post.hashtags), "Hashtags copied")}
                      >
                        Copy hashtags
                      </Button>
                    ) : null}
                    {post.image_prompt ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyText(post.image_prompt, "Image prompt copied")}
                      >
                        Copy image prompt
                      </Button>
                    ) : null}
                    <Button size="sm" variant="danger" onClick={() => deleteOne(post.id)}>
                      Delete
                    </Button>
                  </ActionRow>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
