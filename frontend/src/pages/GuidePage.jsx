import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, PageHeader } from "../components/ui.jsx";

const SAMPLE_FULL_PROMPT = `Generate social media content for my app and save it as a JSON file in the content-queue folder at the project root.

Account: @demo_product
Product: Demo Product — a habit tracker for busy professionals
Tone: Warm, practical, lightly witty — never salesy
Target audience: Indie founders and remote workers who want simple routines
Platforms: instagram, x, threads
Post types to include: Post, Story, Reel

Generate 7 posts (mix of platforms and post types).

For each post include:
- platform
- post_type
- caption (full, ready to publish)
- hashtags (array, 15–20 tags)
- image_prompt (detailed, 100+ words — art style, color palette, mood, composition; suitable for DALL-E or Midjourney)
- video_idea (only for reels/stories, otherwise null)
- posting_tip
- scheduled_date (spread across the next 7 days from today, ISO date YYYY-MM-DD)

Save the output as a single JSON file named:
YYYY-MM-DD_demo_product_batch.json

The file must follow this exact schema:
{
  "account": "@demo_product",
  "generated_at": "<ISO timestamp>",
  "posts": [ ... ]
}

Write the file into content-queue/ at the repository root. Do not invent extra top-level keys.`;

const SAMPLE_SHORT_PROMPT = `Using the account details below, create 5 ready-to-post social updates as JSON matching our content-queue schema (account, generated_at, posts[] with platform, post_type, caption, hashtags, image_prompt, video_idea, posting_tip, scheduled_date).

Account: @demo_brand
Product: Demo Brand — community-first lifestyle brand
Tone: Confident, inclusive, short sentences
Platforms: instagram, facebook
Focus this batch on: product launch week + one UGC-style reel idea

Save to content-queue/YYYY-MM-DD_demo_brand_batch.json at the project root.`;

const SAMPLE_CONTEXT_PROMPT = `Read my persona context (and any notes in products_contexts/ if present). Then generate a week of posts for @demo_product that stay on-brand.

Output only a valid content-queue JSON file:
- Top level: account, generated_at, posts
- Each post: platform, post_type, caption, hashtags, image_prompt, video_idea, posting_tip, scheduled_date

Save it under content-queue/ and tell me the filename when done.`;

const SAMPLE_SCHEMA = `{
  "account": "@demoaccount",
  "generated_at": "2026-05-10T10:00:00Z",
  "posts": [
    {
      "platform": "instagram",
      "post_type": "post",
      "caption": "Your caption here…",
      "hashtags": ["buildinpublic", "product"],
      "image_prompt": "Detailed visual brief…",
      "video_idea": null,
      "posting_tip": "When and how to post",
      "scheduled_date": "2026-05-17"
    }
  ]
}`;

export function GuidePage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <PageHeader
        title="User guide"
        description="Personas, queue import, IDE assistants (no API key), sample prompts, and in-app LLM generation."
      />

      <Section title="1. Sign up and personas">
        <p>
          Create an account, then use <strong>Personas</strong> as separate workspaces (one app or
          brand each). Accounts and posts belong to the active persona in the sidebar.
        </p>
      </Section>

      <Section title="2. Add social accounts">
        <p>
          Under{" "}
          <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/accounts">
            Accounts
          </Link>
          , add handles, platforms, tone, and audience notes. Seed demos use{" "}
          <code className="text-xs">@demo_product</code> /{" "}
          <code className="text-xs">@demo_brand</code> — replace them with yours.
        </p>
        <p className="mt-2">
          Tip: keep longer brand briefs in the persona <strong>Context</strong> tab (or{" "}
          <code className="text-xs">products_contexts/</code>). IDE assistants can read those files
          when you ask them to.
        </p>
      </Section>

      <Section title="3. Generate without an API key (recommended first)">
        <p>
          You do <strong>not</strong> need Gemini / OpenAI / Grok keys in this app to create content.
          Use an IDE or chat assistant you already have — it writes a JSON file; Social Content Studio
          only imports it.
        </p>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-4">Shared workflow</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1.5">
          <li>
            Open{" "}
            <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/accounts">
              Accounts
            </Link>{" "}
            → <strong>Cursor prompt</strong> on a handle (or paste a sample prompt below).
          </li>
          <li>Paste into your assistant and ask it to write the JSON into the repo.</li>
          <li>
            Confirm a file landed in <code className="text-xs">content-queue/</code> at the project
            root.
          </li>
          <li>
            In the app: <strong>Scan queue folder</strong> (Dashboard) or{" "}
            <strong>Process new posts</strong> (Review queue). The watcher may pick up new files
            automatically.
          </li>
          <li>
            Review, edit, approve, then mark <strong>Posted</strong> after you publish manually.
          </li>
        </ol>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-5">
          Cursor
        </h3>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            Open this project folder in Cursor. Chat or Agent mode both work.
          </li>
          <li>
            Paste the prompt and say: <em>“Write the file into content-queue/ and show me the path.”</em>
          </li>
          <li>
            Optional: @-mention persona context or a brief under{" "}
            <code className="text-xs">products_contexts/</code> so captions stay on-brand.
          </li>
        </ul>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-5">
          Claude (Claude.ai, Claude Code, or Claude in the IDE)
        </h3>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            <strong>In the editor / Claude Code:</strong> same as Cursor — paste the prompt in the
            project workspace so Claude can create{" "}
            <code className="text-xs">content-queue/*.json</code>.
          </li>
          <li>
            <strong>Claude.ai chat only:</strong> paste the prompt, copy the returned JSON, and save
            it yourself as{" "}
            <code className="text-xs">content-queue/YYYY-MM-DD_handle_batch.json</code>.
          </li>
        </ul>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-5">
          Google Antigravity
        </h3>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            Open this repo in Antigravity. Paste the account prompt (or a sample below) into the agent.
          </li>
          <li>
            Ask it to create a valid queue JSON under{" "}
            <code className="text-xs">content-queue/</code> — no keys needed inside Social Content
            Studio.
          </li>
          <li>
            Then scan/process in the UI the same way as with Cursor.
          </li>
        </ul>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-5">
          GitHub Copilot / other IDE chat
        </h3>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            Paste the prompt into Copilot Chat (or similar) with the workspace open.
          </li>
          <li>
            Prefer “create/edit file” so the assistant writes into{" "}
            <code className="text-xs">content-queue/</code>; otherwise copy JSON into a new file
            there yourself.
          </li>
          <li>
            Microsoft Copilot is not wired as an HTTP provider in{" "}
            <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/settings/ai">
              AI settings
            </Link>{" "}
            — use this IDE path instead.
          </li>
        </ul>

        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Billing for these tools stays with your IDE / chat subscription. Social Content Studio never
          stores those credentials for this path.
        </p>
      </Section>

      <Section title="4. Sample prompts">
        <p>
          Use these as-is for demos, or swap the account / product / tone. Prefer the button on each
          account (<strong>Cursor prompt</strong>) so names and platforms match your DB.
        </p>

        <PromptBlock title="Full batch prompt (7 posts)" text={SAMPLE_FULL_PROMPT} />
        <PromptBlock title="Short launch-week prompt" text={SAMPLE_SHORT_PROMPT} />
        <PromptBlock title="On-brand with persona context" text={SAMPLE_CONTEXT_PROMPT} />

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-5">Expected JSON shape</h3>
        <p className="mt-1">
          A full demo file is already in{" "}
          <code className="text-xs">content-queue/sample_demo_product_batch.json</code> (also under{" "}
          <code className="text-xs">examples/</code>). Scan or process new posts to import it.
        </p>
        <pre className="mt-3 text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {SAMPLE_SCHEMA}
        </pre>
      </Section>

      <Section title="5. In-app LLM (optional API keys)">
        <ol className="list-decimal ml-5 space-y-1.5">
          <li>
            Add keys under{" "}
            <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/settings/ai">
              AI settings
            </Link>{" "}
            (Gemini, OpenAI, or Grok).
          </li>
          <li>
            On <strong>Accounts</strong>, choose <strong>Generate with AI</strong>, pick provider and
            post count.
          </li>
          <li>
            The app writes a queue JSON file, imports it for your active persona, and archives the
            file — same pipeline as a manual scan.
          </li>
        </ol>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Keys are encrypted per user. Skip this section entirely if you prefer Cursor, Claude,
          Antigravity, or Copilot.
        </p>
      </Section>

      <Section title="6. Review → approve → post">
        <p>
          Use{" "}
          <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/review">
            Review queue
          </Link>{" "}
          to edit captions, copy image prompts, approve or reject. After you publish manually on each
          network, mark <strong>Posted</strong>. Posted items move to the{" "}
          <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/posted">
            Posted
          </Link>{" "}
          archive and leave the main pipeline views.
        </p>
      </Section>

      <Section title="7. Calendar">
        <p>
          Drag posts onto days when they have a <code className="text-xs">scheduled_date</code>. Posted
          items are hidden from the calendar.
        </p>
      </Section>

      <Section title="8. Local folders">
        <ul className="list-disc ml-5 space-y-1">
          <li>
            <code className="text-xs">content-queue/</code> — drop or generate JSON here
          </li>
          <li>
            <code className="text-xs">content-archive/</code> — imported files
          </li>
          <li>
            <code className="text-xs">data/</code> — SQLite database (not committed)
          </li>
          <li>
            <code className="text-xs">products_contexts/</code> — optional private briefs (gitignored)
          </li>
        </ul>
      </Section>

      <Section title="9. Run the app">
        <pre className="mt-2 text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
{`python3 setup.py
source .venv/bin/activate
python run.py
# UI http://127.0.0.1:5173  ·  API http://127.0.0.1:8000

# or
docker compose up --build
# http://127.0.0.1:8000`}
        </pre>
      </Section>

      <Section title="10. About, license & credit">
        <p>
          Made with love for the community by{" "}
          <strong>SalGorythm</strong> (Salman Akhtar). Personal and non-commercial community use is
          welcome. <strong>Commercial use is not allowed</strong> unless you have written
          authorization from the owner.
        </p>
        <p className="mt-2">
          Full terms, disclaimers, and privacy notes:{" "}
          <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/about">
            About &amp; license
          </Link>{" "}
          (also the <code className="text-xs">LICENSE</code> file in the repo).
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

function PromptBlock({ title, text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Prompt copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-4 max-h-64 overflow-auto">
        {text}
      </pre>
    </div>
  );
}
