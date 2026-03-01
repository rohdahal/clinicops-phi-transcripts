import Link from "next/link";

const DEFAULT_TITLE = "ClinicOps PHI Transcript Ops";

type Props = {
  title?: string;
  backHref?: string;
  tabs?: Array<{ href: string; label: string; active?: boolean }>;
};

export default function AppHeader({
  title = DEFAULT_TITLE,
  backHref,
  tabs
}: Props) {
  return (
    <header className="relative overflow-hidden border-b border-blue-200/55 bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 text-white shadow-[0_25px_55px_-40px_rgba(15,23,42,0.95)]">
      <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-16 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />
      <div className="shell-container relative py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {backHref ? (
                <Link
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 font-medium text-white/90 transition hover:bg-white/20"
                  href={backHref}
                >
                  Back to list
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 sm:inline-flex">
              Secure session
            </span>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-[var(--legion-ink)] transition hover:bg-blue-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        {tabs && tabs.length > 0 ? (
          <nav className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                className={
                  tab.active
                    ? "chip border-white/40 bg-white text-[var(--legion-ink)] shadow-[0_10px_24px_-16px_rgba(15,23,42,0.6)]"
                    : "chip border-white/25 bg-white/10 text-white/90 hover:bg-white/20"
                }
                href={tab.href}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
