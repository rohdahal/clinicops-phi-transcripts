import Link from "next/link";

const DEFAULT_TITLE = "ClinicOps PHI Transcript Ops";

type Props = {
  title?: string;
  subtitle?: string;
  backHref?: string;
};

export default function AppHeader({
  title = DEFAULT_TITLE,
  subtitle,
  backHref
}: Props) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          {backHref ? (
            <Link className="text-xs text-slate-500" href={backHref}>
              Back to list
            </Link>
          ) : null}
          <div className="mt-1">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>
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
