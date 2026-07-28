export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-10 text-center">
      <h3 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
