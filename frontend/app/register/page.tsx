"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/transcripts");
      return;
    }

    setMessage("Registration successful. Please log in.");
    setLoading(false);
  };

  return (
    <div className="auth-shell">
      <div className="auth-glow" />
      <main className="auth-grid">
        <section className="reveal text-white">
          <p className="auth-brand-badge">ClinicOps onboarding</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">Create your operations account.</h1>
          <p className="mt-5 max-w-lg text-base text-white/80 sm:text-lg">
            Set up secure access for transcript review, patient lead prioritization, and daily care-team workflows.
          </p>
          <ul className="mt-8 max-w-xl space-y-3 text-sm text-white/85 sm:text-base">
            <li className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur">Secure team access with Supabase auth</li>
            <li className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur">Immediate access to dashboard and transcripts</li>
            <li className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur">Built for HIPAA-conscious operations teams</li>
          </ul>
        </section>

        <section className="auth-card reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">ClinicOps Access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--legion-ink)]">Create account</h2>
          <p className="mt-2 text-sm text-slate-600">Provision access for transcript operations and outreach.</p>
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
                placeholder="Choose a strong password"
              />
            </label>
            <button type="submit" disabled={loading} className="auth-primary">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}
          {message ? <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p> : null}
          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{" "}
            <Link className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2" href="/login">
              Log in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
