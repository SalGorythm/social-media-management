import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { getDb, getPaths, getImportPersonaId } from "./db.js";

const PLATFORMS = new Set([
  "instagram",
  "x",
  "threads",
  "facebook",
  "reddit",
]);
const POST_TYPES = new Set(["post", "story", "reel", "carousel"]);
const POST_TYPE_ALIASES = {
  static: "post",
  image: "post",
  single: "post",
  single_post: "post",
  feed_post: "post",
  post: "post",
  carousel: "carousel",
  reel: "reel",
  story: "story",
};

function normalizePlatform(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLATFORMS.has(normalized) ? normalized : null;
}

function normalizePostType(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return POST_TYPE_ALIASES[normalized] || null;
}

function normalizeHashtags(value) {
  let tags = [];

  if (Array.isArray(value)) {
    tags = value;
  } else if (value && typeof value === "object") {
    tags = Object.values(value).flatMap((entry) => (Array.isArray(entry) ? entry : []));
  }

  return [...new Set(tags)]
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => tag.trim().replace(/^#/, ""));
}

function buildFeedPostingTip(post) {
  const parts = [];

  if (typeof post.posting_tip === "string" && post.posting_tip.trim()) {
    parts.push(post.posting_tip.trim());
  }
  if (typeof post.hook === "string" && post.hook.trim()) {
    parts.push(`Hook: ${post.hook.trim()}`);
  }
  if (typeof post.cta === "string" && post.cta.trim()) {
    parts.push(`CTA: ${post.cta.trim()}`);
  }
  if (typeof post.content_category === "string" && post.content_category.trim()) {
    parts.push(`Category: ${post.content_category.trim()}`);
  }

  return parts.length ? parts.join(" | ") : null;
}

function buildVideoIdea(post) {
  if (typeof post.video_idea === "string" && post.video_idea.trim()) {
    return post.video_idea.trim();
  }

  if (post.reel_script && typeof post.reel_script === "object") {
    const parts = [];

    if (
      typeof post.reel_script.duration === "string" &&
      post.reel_script.duration.trim()
    ) {
      parts.push(`Duration: ${post.reel_script.duration.trim()}`);
    }

    if (Array.isArray(post.reel_script.scenes)) {
      for (const scene of post.reel_script.scenes) {
        if (!scene || typeof scene !== "object") continue;
        const second = typeof scene.second === "string" ? scene.second.trim() : "";
        const visuals =
          typeof scene.visuals === "string" ? scene.visuals.trim() : "";
        const overlay =
          typeof scene.text_overlay === "string"
            ? scene.text_overlay.trim()
            : "";
        const sceneParts = [second, visuals, overlay].filter(Boolean);
        if (sceneParts.length) parts.push(sceneParts.join(" - "));
      }
    }

    return parts.length ? parts.join("\n") : null;
  }

  return null;
}

function describeInteractiveElement(interactiveElement) {
  if (!interactiveElement || typeof interactiveElement !== "object") return null;

  const parts = [];
  if (typeof interactiveElement.type === "string" && interactiveElement.type.trim()) {
    parts.push(interactiveElement.type.trim());
  }
  if (typeof interactiveElement.label === "string" && interactiveElement.label.trim()) {
    parts.push(interactiveElement.label.trim());
  }
  if (Array.isArray(interactiveElement.options) && interactiveElement.options.length) {
    parts.push(`Options: ${interactiveElement.options.join(", ")}`);
  }

  return parts.length ? parts.join(" | ") : null;
}

function buildStoryCaption(story) {
  const parts = [];

  if (typeof story.hook === "string" && story.hook.trim()) {
    parts.push(story.hook.trim());
  }
  if (typeof story.overlay_copy === "string" && story.overlay_copy.trim()) {
    parts.push(story.overlay_copy.trim());
  }
  if (typeof story.cta === "string" && story.cta.trim()) {
    parts.push(`CTA: ${story.cta.trim()}`);
  }

  return parts.join("\n\n");
}

function buildStoryPostingTip(story) {
  const parts = [];

  if (typeof story.objective === "string" && story.objective.trim()) {
    parts.push(`Objective: ${story.objective.trim()}`);
  }

  const interactive = describeInteractiveElement(story.interactive_element);
  if (interactive) {
    parts.push(`Interactive: ${interactive}`);
  }

  if (story.related_post_day != null) {
    parts.push(`Related post day: ${story.related_post_day}`);
  }

  return parts.length ? parts.join(" | ") : null;
}

function validateNormalizedPost(post, index, collectionName) {
  if (!post || typeof post !== "object") {
    return { ok: false, error: `${collectionName}[${index}] invalid` };
  }
  if (!PLATFORMS.has(post.platform)) {
    return { ok: false, error: `${collectionName}[${index}].platform invalid` };
  }
  if (!POST_TYPES.has(post.post_type)) {
    return { ok: false, error: `${collectionName}[${index}].post_type invalid` };
  }
  if (typeof post.caption !== "string" || !post.caption.trim()) {
    return { ok: false, error: `${collectionName}[${index}].caption must be string` };
  }
  if (!Array.isArray(post.hashtags)) {
    return { ok: false, error: `${collectionName}[${index}].hashtags must be array` };
  }
  if (post.image_prompt != null && typeof post.image_prompt !== "string") {
    return { ok: false, error: `${collectionName}[${index}].image_prompt invalid` };
  }
  if (post.scheduled_date != null && typeof post.scheduled_date !== "string") {
    return { ok: false, error: `${collectionName}[${index}].scheduled_date invalid` };
  }
  return { ok: true };
}

function normalizeStandardOrRichPost(post, index) {
  if (!post || typeof post !== "object") {
    return { ok: false, error: `posts[${index}] invalid` };
  }

  const normalized = {
    platform: normalizePlatform(post.platform),
    post_type: normalizePostType(post.post_type),
    caption: typeof post.caption === "string" ? post.caption.trim() : "",
    hashtags: normalizeHashtags(post.hashtags),
    image_prompt:
      typeof post.image_prompt === "string" ? post.image_prompt.trim() : null,
    video_idea: buildVideoIdea(post),
    posting_tip: buildFeedPostingTip(post),
    scheduled_date:
      typeof post.scheduled_date === "string" ? post.scheduled_date : null,
    image_path:
      typeof post.image_path === "string" && post.image_path.trim()
        ? post.image_path.trim()
        : null,
  };

  const validated = validateNormalizedPost(normalized, index, "posts");
  if (!validated.ok) return validated;

  return { ok: true, post: normalized };
}

function normalizeStoryPost(story, index) {
  if (!story || typeof story !== "object") {
    return { ok: false, error: `stories[${index}] invalid` };
  }

  const normalized = {
    platform: "instagram",
    post_type: "story",
    caption: buildStoryCaption(story),
    hashtags: [],
    image_prompt:
      typeof story.image_prompt === "string" ? story.image_prompt.trim() : null,
    video_idea: null,
    posting_tip: buildStoryPostingTip(story),
    scheduled_date:
      typeof story.scheduled_date === "string" ? story.scheduled_date : null,
    image_path: null,
  };

  const validated = validateNormalizedPost(normalized, index, "stories");
  if (!validated.ok) return validated;

  return { ok: true, post: normalized };
}

function normalizeQueuePayload(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Root must be an object" };
  }
  if (typeof data.account !== "string" || !data.account.trim()) {
    return { ok: false, error: "Missing or invalid account" };
  }
  if (typeof data.generated_at !== "string") {
    return { ok: false, error: "Missing generated_at" };
  }

  if (Array.isArray(data.posts)) {
    const posts = [];
    for (let i = 0; i < data.posts.length; i++) {
      const normalized = normalizeStandardOrRichPost(data.posts[i], i);
      if (!normalized.ok) return normalized;
      posts.push(normalized.post);
    }
    return {
      ok: true,
      kind: "posts",
      data: {
        account: data.account.trim(),
        generated_at: data.generated_at,
        posts,
      },
    };
  }

  if (Array.isArray(data.stories)) {
    const posts = [];
    for (let i = 0; i < data.stories.length; i++) {
      const normalized = normalizeStoryPost(data.stories[i], i);
      if (!normalized.ok) return normalized;
      posts.push(normalized.post);
    }
    return {
      ok: true,
      kind: "stories",
      data: {
        account: data.account.trim(),
        generated_at: data.generated_at,
        posts,
      },
    };
  }

  if (Array.isArray(data.assets)) {
    return {
      ok: true,
      kind: "manifest",
      data: {
        account: data.account.trim(),
        generated_at: data.generated_at,
        posts: [],
      },
      assetCount: data.assets.length,
    };
  }

  return { ok: false, error: "posts must be an array" };
}

function uniquePlatforms(posts) {
  return [...new Set(posts.map((p) => p.platform))];
}

function findOrCreateAccount(db, personaId, accountName, posts) {
  const name = accountName.trim();
  const existing = db
    .prepare("SELECT id FROM accounts WHERE persona_id = ? AND name = ?")
    .get(personaId, name);
  if (existing) return existing.id;

  const platforms = JSON.stringify(uniquePlatforms(posts));
  const info = db
    .prepare(
      `INSERT INTO accounts (persona_id, name, product, type, platforms, tone, frequency, notes)
       VALUES (?, ?, ?, 'product', ?, NULL, 'weekly', NULL)`
    )
    .run(personaId, name, `Imported: ${name}`, platforms);
  console.log(`[parser] Created account ${name} (persona ${personaId}, id ${info.lastInsertRowid})`);
  return info.lastInsertRowid;
}

function archiveFilename(originalBasename) {
  const ts = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
  return `${ts}_${originalBasename}`;
}

export function parseFile(absPath, personaIdOverride) {
  const db = getDb();
  const personaId = personaIdOverride ?? getImportPersonaId(db);
  const paths = getPaths();
  const basename = path.basename(absPath);
  if (!basename.endsWith(".json")) {
    return { ok: false, file: basename, error: "Not a JSON file" };
  }

  let raw;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (e) {
    return { ok: false, file: basename, error: e.message };
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, file: basename, error: `Invalid JSON: ${e.message}` };
  }

  const validated = normalizeQueuePayload(json);
  if (!validated.ok) {
    console.error(`[parser] ${basename}: ${validated.error}`);
    return { ok: false, file: basename, error: validated.error };
  }
  const data = validated.data;

  const dest = path.join(paths.contentArchive, archiveFilename(basename));

  const insertPost = db.prepare(`
    INSERT INTO posts (
      account_id, platform, post_type, caption, hashtags, image_prompt, image_path,
      video_idea, posting_tip, status, scheduled_date, source_file
    ) VALUES (
      @account_id, @platform, @post_type, @caption, @hashtags, @image_prompt, @image_path,
      @video_idea, @posting_tip, 'pending', @scheduled_date, @source_file
    )
  `);

  const transaction = db.transaction(() => {
    if (validated.kind === "manifest") {
      fs.renameSync(absPath, dest);
      return { count: 0, assetCount: validated.assetCount ?? 0 };
    }

    const accountId = findOrCreateAccount(db, personaId, data.account, data.posts);
    for (const p of data.posts) {
      insertPost.run({
        account_id: accountId,
        platform: p.platform,
        post_type: p.post_type,
        caption: p.caption,
        hashtags: JSON.stringify(p.hashtags),
        image_prompt: p.image_prompt ?? null,
        image_path: p.image_path ?? null,
        video_idea: p.video_idea ?? null,
        posting_tip: p.posting_tip ?? null,
        scheduled_date: p.scheduled_date ?? null,
        source_file: basename,
      });
    }
    fs.renameSync(absPath, dest);
    return { count: data.posts.length };
  });

  let summary;
  try {
    summary = transaction();
  } catch (e) {
    console.error(`[parser] ${basename}: DB error`, e);
    return { ok: false, file: basename, error: e.message };
  }

  if (validated.kind === "manifest") {
    console.log(
      `[parser] Archived manifest ${basename} → ${path.basename(dest)} (${summary.assetCount} assets)`
    );
    return {
      ok: true,
      file: basename,
      archived: path.basename(dest),
      count: 0,
      kind: "manifest",
      assets: summary.assetCount,
    };
  }

  console.log(
    `[parser] Imported ${basename} → ${path.basename(dest)} (${summary.count} posts)`
  );
  return {
    ok: true,
    file: basename,
    archived: path.basename(dest),
    count: summary.count,
    kind: validated.kind,
  };
}

export function parseQueueDir(personaIdOverride) {
  const paths = getPaths();
  const files = fs
    .readdirSync(paths.contentQueue)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(paths.contentQueue, f));

  const results = [];
  for (const f of files) {
    results.push(parseFile(f, personaIdOverride));
  }
  return { processed: results.length, results };
}

export function startQueueWatcher(onParsed) {
  const paths = getPaths();
  const watcher = chokidar.watch(path.join(paths.contentQueue, "*.json"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  watcher.on("add", (filePath) => {
    const res = parseFile(filePath);
    if (typeof onParsed === "function") onParsed(res);
  });

  watcher.on("error", (err) => console.error("[parser] watcher error", err));
  console.log(`[parser] Watching ${paths.contentQueue}`);
  return watcher;
}

export function getContentPaths() {
  return getPaths();
}
