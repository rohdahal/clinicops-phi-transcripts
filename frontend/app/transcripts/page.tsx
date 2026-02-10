import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export default async function TranscriptsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <main className="w-full max-w-xl rounded-lg bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Transcripts</h1>
        <p className="mt-2 text-slate-600">Signed in as {user.email}</p>
        <p className="mt-4 text-slate-700">Transcripts (coming soon).</p>
        <form className="mt-6" action="/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Log out
          </button>
        </form>
      </main>
    </div>
  );
}
