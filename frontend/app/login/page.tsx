"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      setError(oauthError);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Login failed. Please try again.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`
      }
    });

    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
      return;
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    setGoogleLoading(false);
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow" />
      <main className="auth-grid">
        <section className="reveal text-white">
          <p className="auth-brand-badge">Care operations platform</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
            Care coordination starts with a clean, fast workflow.
          </h1>
          <p className="mt-5 max-w-lg text-base text-white/80 sm:text-lg">
            Centralize transcripts, triage outreach opportunities, and keep your clinic team moving in one portal.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { label: "Avg intake", value: "3 min" },
              { label: "Lead routing", value: "Real-time" },
              { label: "Coverage", value: "All clinics" }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/75">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-card reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">ClinicOps Portal</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--legion-ink)]">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">Sign in to continue managing transcripts and lead outreach.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="auth-field"
                placeholder="name@clinicops.com"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="auth-field"
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" disabled={loading || googleLoading} className="auth-primary">
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="auth-divider">
            <span>Or</span>
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="auth-outline gap-2"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.33-2.04 3.04l3.3 2.56c1.92-1.77 3.03-4.37 3.03-7.46 0-.72-.06-1.42-.2-2.04H12z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.3-2.56c-.92.62-2.1.99-3.33.99-2.56 0-4.73-1.73-5.5-4.05l-3.4 2.63A9.98 9.98 0 0 0 12 22z"
              />
              <path
                fill="#4A90E2"
                d="M6.5 13.94a5.94 5.94 0 0 1 0-3.88l-3.4-2.63a9.98 9.98 0 0 0 0 9.14l3.4-2.63z"
              />
              <path
                fill="#FBBC05"
                d="M12 6.01c1.48 0 2.81.51 3.86 1.52l2.89-2.88C16.96 2.99 14.7 2 12 2a9.98 9.98 0 0 0-8.9 5.43l3.4 2.63c.77-2.32 2.94-4.05 5.5-4.05z"
              />
            </svg>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}

          <p className="mt-6 text-sm text-slate-600">
            Need an account?{" "}
            <Link className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2" href="/register">
              Register
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
