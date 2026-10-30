/** Small pixel-styled UI primitives shared across pages. */
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-red text-void hover:bg-red-hi shadow-[0_4px_0_0_#991B32,0_0_18px_-4px_rgba(255,64,88,0.8)]",
  ghost: "bg-panel text-ink hover:bg-panel-hi hover:text-red-hi shadow-[0_4px_0_0_#0B0B10] border-2 border-[#3a2f48] hover:border-red",
  danger: "bg-red-deep text-ink hover:bg-red shadow-[0_4px_0_0_#4d0d19]",
};

export function PixelButton({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`pixel-btn inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-[0.62rem] ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className = "",
  glow = false,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <section className={`pixel-frame ${glow ? "pixel-frame--red" : ""} p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="pixel-title flex items-center gap-2 text-[0.72rem] text-red">
              {icon}
              {title}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ ok, label, detail, pulse = false }: { ok: boolean | null; label: string; detail?: string; pulse?: boolean }) {
  const color = ok === null ? "bg-warn" : ok ? "bg-ok" : "bg-ink-dim";
  return (
    <span className="inline-flex shrink-0 items-center gap-2 border-2 border-[#3a2f48] bg-deck px-2.5 py-1.5" title={detail}>
      <span aria-hidden className={`block h-2 w-2 ${color} ${pulse ? "status-blink" : ""}`} style={ok ? { boxShadow: "0 0 6px #3ddc97" } : undefined} />
      <span className="pixel-title text-[0.52rem] text-ink">{label}</span>
      <span className="sr-only">{ok === null ? "checking" : ok ? "ok" : "unavailable"}</span>
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-sm text-ink-dim">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-12 shrink-0 cursor-pointer border-2 transition-colors ${checked ? "border-red bg-red-deep" : "border-[#3a2f48] bg-void"}`}
      >
        <span className={`absolute top-0.5 block h-4 w-4 transition-all ${checked ? "left-6 bg-red-hi" : "left-0.5 bg-ink-dim"}`} />
      </button>
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const styles = {
    info: "border-[#3a2f48] text-ink-dim",
    warn: "border-warn/70 text-warn",
    error: "border-red text-red-hi",
    ok: "border-ok/70 text-ok",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-2 bg-deck px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}
