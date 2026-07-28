import { Link } from "react-router-dom";

const GITHUB_URL = "https://github.com/SalGorythm";
const REPO_URL = "https://github.com/SalGorythm/social-media-management";

/** Compact credit line — use in sidebar, auth screens, and page footers. */
export function SignatureCredit({ className = "" }) {
  return (
    <p
      className={`text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 ${className}`.trim()}
    >
      Made with love for the community
      <span className="mx-1 text-rose-500/80" aria-hidden="true">
        ♥
      </span>
      by{" "}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        SalGorythm
      </a>
      .{" "}
      <Link
        to="/about"
        className="underline decoration-slate-300 dark:decoration-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        About &amp; license
      </Link>
    </p>
  );
}

export { GITHUB_URL, REPO_URL };
