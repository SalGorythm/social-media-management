import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { StatCard } from "../components/StatCard.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { platformLabel } from "../lib/platforms.js";

export function Dashboard() {
  const { personaId } = usePersona();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api("/api/stats"), api("/api/stats/activity")]);
      setStats(s);
      setActivity(Array.isArray(a) ? a : []);
    } catch (e) {
      toast.error(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [personaId]);

  async function scanQueue() {
    setParsing(true);
    try {
      const out = await api("/api/parse", { method: "POST" });
      const ok = (out.results || []).filter((r) => r.ok).length;
      const fail = (out.results || []).filter((r) => !r.ok).length;
      toast.success(`Parsed ${ok} file(s)${fail ? `, ${fail} failed` : ""}`);
      await load();
    } catch (e) {
      toast.error(e.message || "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  if (loading && !stats) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const platformEntries = stats?.by_platform
    ? Object.entries(stats.by_platform).sort((a, b) => b[1] - a[1])
    : [];

  const maxPlatform = Math.max(1, ...platformEntries.map(([, c]) => c));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
            Overview of your content pipeline and recent status changes.
          </p>
        </div>
        <button
          type="button"
          onClick={scanQueue}
          disabled={parsing}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {parsing ? "Scanning…" : "Scan queue folder"}
        </button>
      </div>

      {!stats || stats.total_pipeline === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Drop a JSON file into content-queue (or use the demo file), then click Scan queue folder or wait for the file watcher."
          action={
            <button
              type="button"
              onClick={scanQueue}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Scan queue folder
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="In pipeline" value={stats.total_pipeline ?? stats.total} />
            <StatCard title="Pending review" value={stats.pending} />
            <StatCard title="Approved" value={stats.approved} />
            <StatCard
              title="Posted this week"
              value={stats.posted_this_week ?? 0}
              hint="Based on posts marked posted in the last 7 days"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="font-display font-semibold text-slate-900 dark:text-white">
                Posts by platform
              </h2>
              <ul className="mt-4 space-y-3">
                {platformEntries.length === 0 ? (
                  <li className="text-sm text-slate-500">No data</li>
                ) : (
                  platformEntries.map(([platform, count]) => (
                    <li key={platform} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-slate-600 dark:text-slate-300">
                        {platformLabel(platform)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${(count / maxPlatform) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200 w-8 text-right">
                        {count}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="font-display font-semibold text-slate-900 dark:text-white">
                Recent activity
              </h2>
              {activity.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Approve, reject, or mark posts posted to see status changes here.
                </p>
              ) : (
                <ul className="mt-4 space-y-3 text-sm">
                  {activity.map((row) => (
                    <li
                      key={row.id}
                      className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0"
                    >
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {row.account_name}{" "}
                        <span className="text-slate-500 font-normal">· {row.platform}</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        {(row.from_status || "new")} → {row.to_status}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 truncate">{row.caption}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
