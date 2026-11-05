/**
 * Shared frame for login / change-password.
 * Left: the form, on a plain page. Right: an inset panel with a serif statement and a
 * small, static preview of how work moves through IFlow. Theme-token driven throughout.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* Form column */}
      <div className="flex-1 flex flex-col min-w-0 px-6 sm:px-10 lg:px-14">
        <header className="h-20 flex items-center">
          <a href="/login" className="flex items-center gap-2" aria-label="IFlow">
            <img src="/logo-large.png" alt="" className="h-6 w-auto object-contain" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">IFlow</span>
          </a>
        </header>

        <main className="flex-1 flex items-center">
          <div className="w-full max-w-[360px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>

        <footer className="h-16 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Imaginum</span>
          <a href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </a>
        </footer>
      </div>

      {/* Statement panel */}
      <aside className="hidden lg:flex w-[52%] max-w-[760px] p-3" aria-hidden="true">
        <div className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl border border-surface-border bg-surface-base px-12 py-12">
          {/* Fine rule grid, faded toward the bottom — structure, not glow */}
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--surface-border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--surface-border)) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              backgroundPosition: "-1px -1px",
              maskImage: "linear-gradient(to bottom, black, transparent 55%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 55%)",
            }}
          />

          <div className="relative">
            <p className="text-[12px] font-medium text-muted-foreground">IFlow by Imaginum</p>
            <h2 className="text-display text-[56px] xl:text-[64px] mt-5 text-foreground">
              Ship every page,
              <br />
              <em className="text-muted-foreground">with a name on it.</em>
            </h2>
            <p className="text-[14px] text-muted-foreground mt-6 max-w-[400px] leading-relaxed">
              Boards for the day-to-day, a page-by-page tracker for delivery, and a wiki the team keeps current —
              in one place.
            </p>
          </div>

          <WorkPreview />
        </div>
      </aside>
    </div>
  );
}

/* ── Static product vignette ─────────────────────────────────────────────── */

const STAGES = [
  { name: "Design", owner: "AK", color: "#E07A5F", state: "Approved", done: true },
  { name: "Development", owner: "RS", color: "#5B5FEF", state: "In review", done: false },
  { name: "Testing", owner: "MJ", color: "#3D9A73", state: "Up next", done: false },
] as const;

function WorkPreview() {
  return (
    <div className="relative mt-10">
      {/* Back card — gives the stack depth without decoration */}
      <div className="absolute -top-3 left-6 right-6 h-full rounded-xl border border-surface-border bg-surface-elevated/60" />

      <div className="relative rounded-xl border border-surface-border bg-surface-elevated shadow-lg">
        <div className="flex items-center justify-between px-5 h-12 border-b border-surface-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[12px] font-mono text-muted-foreground">PG-214</span>
            <span className="text-[13.5px] font-semibold truncate">Checkout · payment step</span>
          </div>
          <span className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded-md text-[11.5px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            In progress
          </span>
        </div>

        <ol className="grid grid-cols-3 divide-x divide-surface-border">
          {STAGES.map((s, i) => (
            <li key={s.name} className="px-5 py-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    s.done
                      ? "w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center"
                      : i === 1
                        ? "w-4 h-4 rounded-full border-[1.5px] border-foreground flex items-center justify-center"
                        : "w-4 h-4 rounded-full border-[1.5px] border-dashed border-muted-foreground/50"
                  }
                >
                  {s.done && (
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.2 5 8.5l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {i === 1 && <span className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                </span>
                <span className="text-[12.5px] font-medium">{s.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="w-5 h-5 rounded-full text-[9.5px] font-semibold text-white flex items-center justify-center"
                  style={{ background: s.color }}
                >
                  {s.owner}
                </span>
                <span className="text-[12px] text-muted-foreground">{s.state}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2 px-5 h-10 border-t border-surface-border text-[12px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Design approved by reviewer · 2h ago
        </div>
      </div>
    </div>
  );
}
