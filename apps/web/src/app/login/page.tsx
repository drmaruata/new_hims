'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@hims/auth';

/**
 * Read through static member access so Next can inline them at build time; a
 * computed lookup would survive into the browser bundle unresolved.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export default function LoginPage() {
  const router = useRouter();
  /**
   * The Supabase browser client is only ever useful in a browser, so it is
   * created there and nowhere else. `next build` prerenders this page, and a
   * `NEXT_PUBLIC_*` value is frozen into the bundle at build time, so building
   * without Supabase configured must not throw — it has to produce a page that
   * explains the misconfiguration when someone actually tries to sign in.
   *
   * `src/lib/api.ts` guards its own client the same way, and for the same
   * reason. Nothing here branches on `supabase` during render, so the
   * prerendered markup and the first client render stay identical.
   */
  const supabase = useMemo(
    () =>
      typeof window !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY
        ? createSupabaseBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null,
    []
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        'Sign-in is unavailable: this build has no Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and rebuild.'
      );
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/command-center');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">HIMS</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Staff sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Authenticate with the hospital&apos;s Supabase Auth service. Hospital role and tenant
          access are resolved by the HIMS API after sign-in.
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
