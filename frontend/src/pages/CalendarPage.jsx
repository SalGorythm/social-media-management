import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { api } from "../api.js";
import { usePersona } from "../context/PersonaContext.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { Button, PageHeader } from "../components/ui.jsx";
import { platformIcon, platformLabel } from "../lib/platforms.js";

export function CalendarPage() {
  const { personaId } = usePersona();
  const [cursor, setCursor] = useState(() => new Date());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const rangeFrom = format(monthStart, "yyyy-MM-dd");
  const rangeTo = format(monthEnd, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ date_from: rangeFrom, date_to: rangeTo, exclude_status: "posted" });
        const rows = await api(`/api/posts?${q.toString()}`);
        if (!cancelled) setPosts(rows);
      } catch (e) {
        if (!cancelled) toast.error(e.message || "Failed to load calendar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeFrom, rangeTo, personaId]);

  const byDate = useMemo(() => {
    const map = {};
    for (const p of posts) {
      if (!p.scheduled_date) continue;
      const key = p.scheduled_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  const selectedPosts = selectedDay ? byDate[selectedDay] || [] : [];

  async function reschedule(postId, newDate) {
    try {
      await api(`/api/posts/${postId}`, {
        method: "PUT",
        json: { scheduled_date: newDate },
      });
      toast.success("Rescheduled");
      const rows = await api(
        `/api/posts?${new URLSearchParams({ date_from: rangeFrom, date_to: rangeTo }).toString()}`
      );
      setPosts(rows);
    } catch (e) {
      toast.error(e.message || "Update failed");
    }
  }

  function onDragStart(e, post) {
    setDraggingId(post.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/post-id", String(post.id));
  }

  function onDragEnd() {
    setDraggingId(null);
  }

  function onDragOverDay(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function onDropDay(e, dayKey) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/post-id"));
    if (!id) return;
    await reschedule(id, dayKey);
    setSelectedDay(dayKey);
    setDraggingId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Scheduled posts for the month. Drag a post to another day to reschedule."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCursor((d) => addMonths(d, -1))}>
              Prev
            </Button>
            <span className="text-sm font-medium tabular-nums min-w-[8rem] text-center">
              {format(cursor, "MMMM yyyy")}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setCursor((d) => addMonths(d, 1))}>
              Next
            </Button>
          </div>
        }
      />

      {loading ? <p className="text-slate-500">Loading…</p> : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 md:p-4 shadow-sm overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[560px] text-center text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-w-[560px] gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, cursor);
              const list = byDate[key] || [];
              const isSelected = selectedDay === key;
              return (
                <div
                  key={key}
                  onDragOver={onDragOverDay}
                  onDrop={(e) => onDropDay(e, key)}
                  onClick={() => setSelectedDay(key)}
                  className={[
                    "min-h-[5.5rem] rounded-xl border p-1.5 flex flex-col gap-1 cursor-pointer transition-colors",
                    inMonth
                      ? "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40"
                      : "border-transparent bg-transparent opacity-40",
                    isSelected ? "ring-2 ring-indigo-500" : "hover:border-indigo-300 dark:hover:border-indigo-700",
                  ].join(" ")}
                >
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{format(day, "d")}</span>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {list.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, p)}
                        onDragEnd={onDragEnd}
                        className={[
                          "truncate rounded-md bg-indigo-100 dark:bg-indigo-950/80 px-1 py-0.5 text-[10px] font-medium text-indigo-900 dark:text-indigo-100",
                          draggingId === p.id ? "opacity-50" : "",
                        ].join(" ")}
                        title={p.caption}
                      >
                        {platformIcon(p.platform)} {p.account_name}
                      </div>
                    ))}
                    {list.length > 3 ? (
                      <span className="text-[10px] text-slate-500">+{list.length - 3} more</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm h-fit">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">
            {selectedDay ? format(parseISO(`${selectedDay}T12:00:00`), "EEEE, MMM d") : "Pick a day"}
          </h2>
          {!loading && posts.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="No scheduled posts this month"
                description="Set scheduled_date on posts from Review or the post editor. Drag chips between days to reschedule."
              />
            </div>
          ) : !selectedDay ? (
            <p className="text-sm text-slate-500 mt-2">Click a date on the calendar.</p>
          ) : selectedPosts.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">No posts scheduled for this day.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {selectedPosts.map((p) => (
                <li
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p)}
                  onDragEnd={onDragEnd}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span>{platformIcon(p.platform)}</span>
                    <span>{p.account_name}</span>
                    <span className="text-slate-500 text-xs">{platformLabel(p.platform)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1 line-clamp-3">{p.caption}</p>
                  <Link to={`/posts/${p.id}`} className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 inline-block">
                    Open editor
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
