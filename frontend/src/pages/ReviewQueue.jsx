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

const STATUSES = ["", "pending", "approved", "rejected"];
const PLATFORMS = ["", "instagram", "x", "threads", "facebook", "reddit"];
const POST_TYPES = ["", "post", "story", "reel", "carousel"];

function formatHashtags(tags = []) {
  return tags.map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" ");
}

export function ReviewQueue() {
  const { personaId } = usePersona();
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    account_id: "",
    platform: "",
    post_type: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [promptOpen, setPromptOpen] = useState({});
  const [selected, setSelected] = useState({});

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set("exclude_status", "posted");
    if (filters.status) q.set("status", filters.status);
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
      toast.error(e.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  async function processNewPosts() {
    setProcessing(true);
    try {
      const out = await api("/api/parse", { method: "POST" });
      const ok = (out.results || []).filter((result) => result.ok).length;
      const fail = (out.results || []).filter((result) => !result.ok).length;

      if (ok === 0 && fail === 0) {
        toast.message("No new files found in content-queue");
      } else {
        toast.success(
          `Imported ${ok} file(s)${fail ? `, ${fail} failed` : ""}`
        );
      }

      await Promise.all([loadAccounts(), loadPosts()]);
    } catch (e) {
      toast.error(e.message || "Failed to process queued posts");
    } finally {
      setProcessing(false);
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

  async function bulkAction(kind) {
    const ids = selectedIds();
    if (ids.length === 0) {
      toast.message("Select at least one post");
      return;
    }
    const label =
      kind === "approve"
        ? `Approved ${ids.length} post(s)`
        : kind === "reject"
          ? `Rejected ${ids.length} post(s)`
          : kind === "posted"
            ? `Marked ${ids.length} post(s) as posted`
            : `Deleted ${ids.length} post(s)`;
    if (kind === "delete" && !window.confirm(`Delete ${ids.length} post(s)?`)) return;
    try {
      for (const id of ids) {
        if (kind === "approve") await api(`/api/posts/${id}/approve`, { method: "POST" });
        else if (kind === "reject") await api(`/api/posts/${id}/reject`, { method: "POST" });
        else if (kind === "posted") await api(`/api/posts/${id}/posted`, { method: "POST" });
        else if (kind === "delete") await api(`/api/posts/${id}`, { method: "DELETE" });
      }
      if (kind === "posted") {
        setPosts((prev) => prev.filter((p) => !ids.includes(p.id)));
        setSelected({});
      }
      toast.success(label);
      await loadPosts();
    } catch (e) {
      toast.error(e.message || "Bulk action failed");
    }
  }

  async function oneAction(id, kind) {
    try {
      if (kind === "approve") await api(`/api/posts/${id}/approve`, { method: "POST" });
      if (kind === "reject") await api(`/api/posts/${id}/reject`, { method: "POST" });
      if (kind === "posted") await api(`/api/posts/${id}/posted`, { method: "POST" });
      if (kind === "posted") {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setSelected((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      }
      toast.success(
        kind === "approve" ? "Approved" : kind === "reject" ? "Rejected" : "Marked as posted"
      );
      await loadPosts();
    } catch (e) {
      toast.error(e.message || "Action failed");
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
        title="Review queue"
        description="Filter, expand, and approve content before you post manually."
        actions={
          <ActionRow>
            <LinkButton to="/posted">Posted archive</LinkButton>
            <Button onClick={processNewPosts} disabled={processing}>
              {processing ? "Processing..." : "Process new posts"}
            </Button>
          </ActionRow>
        }
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
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={STATUSES.map((s) => ({ value: s, label: s || "All" }))}
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
        <Button size="sm" variant="success" onClick={() => bulkAction("approve")}>
          Approve selected
        </Button>
        <Button size="sm" variant="warning" onClick={() => bulkAction("reject")}>
          Reject selected
        </Button>
        <Button size="sm" onClick={() => bulkAction("posted")}>
          Mark selected posted
        </Button>
        <Button size="sm" variant="danger" onClick={() => bulkAction("delete")}>
          Delete selected
        </Button>
      </ActionRow>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing in this queue"
          description="Adjust filters or import JSON from the content-queue folder, then use Process new posts to bring them into the app."
          action={
            <Button onClick={processNewPosts} disabled={processing}>
              {processing ? "Processing..." : "Process new posts"}
            </Button>
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
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        post.status === "pending" &&
                          "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
                        post.status === "approved" &&
                          "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
                        post.status === "posted" &&
                          "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
                        post.status === "rejected" &&
                          "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"
                      )}
                    >
                      {post.status}
                    </span>
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
                    <Button size="sm" variant="success" onClick={() => oneAction(post.id, "approve")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => oneAction(post.id, "reject")}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => oneAction(post.id, "posted")}>
                      Mark posted
                    </Button>
                    <LinkButton to={`/posts/${post.id}`} size="sm">
                      Edit
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
