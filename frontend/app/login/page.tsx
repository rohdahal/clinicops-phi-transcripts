"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="app-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <main className="panel reveal w-full max-w-md">
        <p className="section-kicker">ClinicOps Access</p>
        <h1 className="section-title">Log in</h1>
        <p className="mt-2 text-sm text-slate-600">Continue to transcript triage and lead ops.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="field"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="field"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}
        <p className="mt-6 text-sm text-slate-600">
          Need an account?{" "}
          <Link className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2" href="/register">
            Register
          </Link>
        </p>
      </main>
    </div>
  );
}
