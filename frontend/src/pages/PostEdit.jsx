import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { PLATFORM_LIMITS, platformLabel } from "../lib/platforms.js";

const STATUSES = ["pending", "approved", "posted", "rejected"];

function formatHashtags(tags = []) {
  return tags.map((tag) => `#${String(tag).replace(/^#/, "")}`).join(" ");
}

export function PostEdit() {
  const { id } = useParams();
  const { personaId } = usePersona();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState("pending");
  const [scheduledDate, setScheduledDate] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoIdea, setVideoIdea] = useState("");
  const [postingTip, setPostingTip] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const limit = useMemo(() => PLATFORM_LIMITS[post?.platform] ?? 2200, [post?.platform]);
  const over = caption.length > limit;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await api(`/api/posts/${id}`);
        if (cancelled) return;
        setPost(p);
        setCaption(p.caption || "");
        setHashtags(Array.isArray(p.hashtags) ? p.hashtags : []);
        setStatus(p.status || "pending");
        setScheduledDate(p.scheduled_date || "");
        setImagePath(p.image_path || "");
        setImagePrompt(p.image_prompt || "");
        setVideoIdea(p.video_idea || "");
        setPostingTip(p.posting_tip || "");
      } catch (e) {
        toast.error(e.message || "Failed to load post");
        navigate("/review");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, personaId]);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!hashtags.includes(t)) setHashtags([...hashtags, t]);
    setTagInput("");
  }

  function removeTag(tag) {
    setHashtags(hashtags.filter((h) => h !== tag));
  }

  async function save() {
    if (over) {
      toast.error("Caption exceeds limit for this platform");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/posts/${id}`, {
        method: "PUT",
        json: {
          caption,
          hashtags,
          status,
          scheduled_date: scheduledDate || null,
          image_path: imagePath || null,
          image_prompt: imagePrompt || null,
          video_idea: videoIdea || null,
          posting_tip: postingTip || null,
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrompt(kind) {
    if (!imagePrompt) return;
    try {
      await navigator.clipboard.writeText(imagePrompt);
      toast.success(kind === "dalle" ? "Copied for DALL-E" : "Copied for Midjourney");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function copyHashtags() {
    if (hashtags.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatHashtags(hashtags));
      toast.success("Hashtags copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  if (loading || !post) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 dark:text-indigo-400"
        >
          ← Back
        </button>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white mt-2">
          Edit post
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {post.account_name} · {platformLabel(post.platform)} · {post.post_type}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <label className="font-medium text-slate-700 dark:text-slate-200" htmlFor="caption">
            Caption
          </label>
          <span className={over ? "text-rose-600 font-medium" : "text-slate-500"}>
            {caption.length} / {limit} ({platformLabel(post.platform)})
          </span>
        </div>
        <textarea
          id="caption"
          rows={10}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Hashtags</p>
          <button
            type="button"
            onClick={copyHashtags}
            disabled={hashtags.length === 0}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Copy hashtags
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-sm"
            >
              #{tag}
              <button type="button" className="text-slate-500 hover:text-rose-600" onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Add tag"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-2 text-sm font-medium"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="imagePrompt">
          Image prompt
        </label>
        <textarea
          id="imagePrompt"
          rows={6}
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyPrompt("dalle")}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
          >
            Copy for DALL-E
          </button>
          <button
            type="button"
            onClick={() => copyPrompt("mj")}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm"
          >
            Copy for Midjourney
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Scheduled date</label>
          <input
            type="date"
            value={scheduledDate ? scheduledDate.slice(0, 10) : ""}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Image path (local)</label>
        <input
          value={imagePath}
          onChange={(e) => setImagePath(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Video idea</label>
        <textarea
          rows={3}
          value={videoIdea}
          onChange={(e) => setVideoIdea(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Posting tip</label>
        <textarea
          rows={2}
          value={postingTip}
          onChange={(e) => setPostingTip(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
