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
    <header className="border-b border-white/60 bg-white/70 backdrop-blur">
      <div className="shell-container flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-col gap-2">
          {backHref ? (
            <Link
              className="w-fit text-xs font-medium text-teal-700 transition hover:text-teal-900"
              href={backHref}
            >
              Back to list
            </Link>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {tabs && tabs.length > 0 ? (
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  className={
                    tab.active
                      ? "chip border-teal-500 bg-teal-600 text-white"
                      : "chip border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }
                  href={tab.href}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <form action="/auth/logout" method="post">
          <button type="submit" className="btn-secondary">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
