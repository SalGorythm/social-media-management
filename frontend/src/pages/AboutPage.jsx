import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui.jsx";
import { GITHUB_URL, REPO_URL, SignatureCredit } from "../components/SignatureCredit.jsx";

export function AboutPage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <PageHeader
        title="About & license"
        description="Who built this, how you may use it, and what you should know before shipping content."
      />

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 p-6 md:p-8 space-y-3">
        <p className="font-display text-xl md:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
          Made with love for the community
          <span className="ml-2 text-rose-500" aria-hidden="true">
            ♥
          </span>
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          Social Content Studio was built by{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            SalGorythm
          </a>{" "}
          (Salman Akhtar) so creators and builders can review, shape, and ship social content without
          turning their pipeline into another SaaS tax. Use it, learn from it, improve it with the
          community — and ask before you commercialize it.
        </p>
        <SignatureCredit className="pt-1" />
        <p className="text-xs text-slate-500">
          Source:{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline">
            github.com/SalGorythm/social-media-management
          </a>
        </p>
      </section>

      <Section title="License (important)">
        <p>
          This project is released under a <strong>proprietary community license</strong> (see the{" "}
          <code className="text-xs">LICENSE</code> file in the repository). It is{" "}
          <strong>not</strong> MIT, Apache, or GPL.
        </p>
        <ul className="list-disc ml-5 mt-3 space-y-2">
          <li>
            <strong>Allowed:</strong> personal use, education, learning, and non-commercial community
            work — including forking and contributing improvements.
          </li>
          <li>
            <strong>Not allowed without authorization:</strong> commercial use of any kind (paid
            products/services, agency/client delivery as a paid offering, selling or bundling this
            software, running it as a commercial SaaS, and similar).
          </li>
          <li>
            <strong>Commercial permission:</strong> contact the owner via{" "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
              GitHub (@SalGorythm)
            </a>{" "}
            and wait for <strong>written authorization</strong> before any commercial use.
          </li>
          <li>
            Keep copyright and license notices intact when you share non-commercial copies.
          </li>
        </ul>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          If these terms conflict with anything said informally, the{" "}
          <code className="text-xs">LICENSE</code> file controls.
        </p>
      </Section>

      <Section title="What this app is (and isn’t)">
        <ul className="list-disc ml-5 space-y-2">
          <li>
            A <strong>local-first</strong> studio: queue JSON → SQLite → review UI. You publish to
            networks yourself (or via your own tooling).
          </li>
          <li>
            <strong>Not</strong> an official Instagram, X, Threads, Facebook, Reddit, or Meta
            product. Those brands belong to their owners; this project is unaffiliated.
          </li>
          <li>
            Optional AI features use <strong>your</strong> API keys or IDE assistants (Cursor,
            Claude, Antigravity, Copilot, etc.). Keys stay with you / on your machine when
            configured here.
          </li>
        </ul>
      </Section>

      <Section title="Your responsibilities">
        <ul className="list-disc ml-5 space-y-2">
          <li>
            You are responsible for captions, images, and anything you publish on third-party
            platforms — including their terms, copyright, and advertising rules.
          </li>
          <li>
            Do not commit <code className="text-xs">.env</code>, databases, private queue files, or
            API keys to public repos.
          </li>
          <li>
            AI-generated drafts can be wrong or off-brand; always review before posting.
          </li>
        </ul>
      </Section>

      <Section title="Privacy & data">
        <ul className="list-disc ml-5 space-y-2">
          <li>
            Account data and posts live in local SQLite under <code className="text-xs">data/</code>{" "}
            (or your Docker volume) unless you deploy elsewhere.
          </li>
          <li>
            LLM keys saved in AI settings are encrypted at rest with the server secret — still treat
            them as sensitive.
          </li>
          <li>
            There is no analytics product baked into this app for selling your content. If you host
            it publicly, you are responsible for securing access (JWT secret, HTTPS, etc.).
          </li>
        </ul>
      </Section>

      <Section title="No warranty">
        <p>
          The software is provided <strong>“as is”</strong>, without warranty of any kind. The owner
          is not liable for lost data, failed posts, API bills, or platform enforcement actions. Use
          at your own risk.
        </p>
      </Section>

      <Section title="Contributing">
        <p>
          Community improvements are welcome under the same license. See{" "}
          <code className="text-xs">CONTRIBUTING.md</code> and open a pull request. Please do not
          include personal client content in PRs.
        </p>
        <p className="mt-2">
          Need commercial rights or a custom arrangement?{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
            Reach out on GitHub
          </a>
          .
        </p>
      </Section>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        See also the{" "}
        <Link to="/guide" className="text-indigo-600 dark:text-indigo-400 underline">
          user guide
        </Link>
        . Signed in?{" "}
        <Link to="/" className="text-indigo-600 dark:text-indigo-400 underline">
          Open the dashboard
        </Link>
        .
      </p>
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
