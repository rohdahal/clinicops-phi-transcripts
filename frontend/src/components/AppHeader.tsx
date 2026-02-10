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
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          {backHref ? (
            <Link className="text-xs text-slate-500 hover:text-slate-700" href={backHref}>
              Back to list
            </Link>
          ) : null}
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {tabs && tabs.length > 0 ? (
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  className={
                    tab.active
                      ? "rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-white"
                      : "rounded-full border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-100"
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
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
