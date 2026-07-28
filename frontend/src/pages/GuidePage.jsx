import { Link } from "react-router-dom";

export function GuidePage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
          User guide
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
          How Social Content Studio fits together: personas, queue import, Cursor, and in-app LLM
          generation.
        </p>
      </div>

      <Section title="1. Sign up and personas">
        <p>
          Create an account, then use <strong>Personas</strong> as separate workspaces (one app or
          brand each). Accounts and posts belong to the active persona in the sidebar.
        </p>
      </Section>

      <Section title="2. Add social accounts">
        <p>
          Under <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/accounts">Accounts</Link>,
          add handles, platforms, tone, and audience notes. Seed demos use{" "}
          <code className="text-xs">@demo_product</code> / <code className="text-xs">@demo_brand</code> —
          replace them with yours.
        </p>
      </Section>

      <Section title="3. Generate content — two ways">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-3">A. Cursor / Claude / Copilot (IDE)</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Open an account → <strong>Generate prompt</strong> → copy.</li>
          <li>Paste into Cursor (or Claude / Copilot in your editor).</li>
          <li>
            Save the JSON file into <code className="text-xs">content-queue/</code> at the repo root.
          </li>
          <li>
            Click <strong>Scan queue folder</strong> on the Dashboard (or wait for the watcher on new
            files).
          </li>
        </ol>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          No API key is stored in this app for the IDE path.
        </p>

        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mt-4">B. In-app LLM (Gemini / OpenAI / Grok)</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>
            Add keys under{" "}
            <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/settings/ai">
              AI settings
            </Link>
            .
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
          Keys are encrypted per user. Microsoft Copilot is not a direct HTTP API here; use the IDE
          prompt path instead (or OpenAI / Azure keys under OpenAI if you use Microsoft-hosted
          models elsewhere).
        </p>
      </Section>

      <Section title="4. Review → approve → post">
        <p>
          Use <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/review">Review queue</Link>{" "}
          to edit captions, copy image prompts, approve or reject. After you publish manually on each
          network, mark <strong>Posted</strong>. Posted items move to the{" "}
          <Link className="text-indigo-600 dark:text-indigo-400 underline" to="/posted">Posted</Link>{" "}
          archive and leave the main pipeline views.
        </p>
      </Section>

      <Section title="5. Calendar">
        <p>
          Drag posts onto days when they have a <code className="text-xs">scheduled_date</code>. Posted
          items are hidden from the calendar.
        </p>
      </Section>

      <Section title="6. Local folders">
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

      <Section title="7. Run the app">
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
