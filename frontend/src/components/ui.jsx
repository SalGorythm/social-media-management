import clsx from "clsx";
import { Link } from "react-router-dom";

const buttonVariants = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm focus-visible:ring-indigo-500",
  secondary:
    "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-slate-400",
  danger: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm focus-visible:ring-rose-500",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm focus-visible:ring-emerald-500",
  warning: "bg-amber-600 text-white hover:bg-amber-500 shadow-sm focus-visible:ring-amber-500",
  ghost:
    "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-slate-400",
  link: "text-indigo-600 dark:text-indigo-400 hover:underline px-0 py-0 font-medium rounded-none",
};

const buttonSizes = {
  sm: "px-2.5 py-1.5 text-xs font-medium rounded-lg gap-1",
  md: "px-3.5 py-2 text-sm font-semibold rounded-xl gap-1.5",
  lg: "px-5 py-2.5 text-sm font-semibold rounded-xl gap-2",
};

const buttonBase =
  "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 disabled:opacity-55 disabled:pointer-events-none";

export function buttonClass(variant = "primary", size = "md", className) {
  const sizeClass = variant === "link" ? "text-sm gap-1" : buttonSizes[size] || buttonSizes.md;
  return clsx(buttonBase, buttonVariants[variant] || buttonVariants.primary, sizeClass, className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  disabled,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = "secondary", size = "md", className, children, ...props }) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function FieldLabel({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
    >
      {children}
    </label>
  );
}

const controlBase =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500";

export function Input({ className, ...props }) {
  return <input className={clsx(controlBase, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={clsx(controlBase, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={clsx(controlBase, "min-h-[5rem]", className)} {...props} />;
}

export function Field({ label, children, className }) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {description ? (
          <div className="text-slate-600 dark:text-slate-400 mt-1 text-sm max-w-2xl">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className, title, description }) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm",
        className
      )}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="font-display font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Modal({ title, description, children, footer, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="max-w-lg w-full max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800">
        {title ? (
          <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">{title}</h2>
        ) : null}
        {description ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</div>
        ) : null}
        <div className={clsx(title || description ? "mt-4" : null, "space-y-4")}>{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap gap-2 justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ActionRow({ children, className }) {
  return <div className={clsx("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

const compactControl =
  "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500";

export function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <div className={clsx("flex flex-col gap-1.5 min-w-[8rem]", className)}>
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={compactControl}>
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterDate({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compactControl}
      />
    </div>
  );
}
