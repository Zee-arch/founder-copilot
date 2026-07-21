"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/GoogleIcon";

type Mode = "login" | "sign-up";

// Supabase's AuthError.message is normally a string, but this guards against
// any non-Error rejection (e.g. a network failure) rendering "[object Object]".
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const COPY: Record<Mode, { title: string; subtitle: string; submitLabel: string; submittingLabel: string }> = {
  login: {
    title: "Log in",
    subtitle: "Welcome back — sign in to see your saved reports.",
    submitLabel: "Log in",
    submittingLabel: "Logging in…",
  },
  "sign-up": {
    title: "Create an account",
    subtitle: "Save your reports and pick up where you left off — no account needed to try FounderCopilot first.",
    submitLabel: "Create account",
    submittingLabel: "Creating account…",
  },
};

export function AuthForm({ mode, next = "/" }: { mode: Mode; next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  const copy = COPY[mode];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    const supabase = createClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(errorMessage(signInError, "Couldn't log in. Check your email and password and try again."));
        setIsSubmitting(false);
        return;
      }
      window.location.href = next;
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });

    if (signUpError) {
      setError(errorMessage(signUpError, "Couldn't create your account. Please try again."));
      setIsSubmitting(false);
      return;
    }

    setConfirmationSent(true);
    setIsSubmitting(false);
  }

  async function handleGoogle() {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setError("");

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });

    if (oauthError) {
      setError(errorMessage(oauthError, "Couldn't sign in with Google. Please try again."));
      setIsGoogleLoading(false);
    }
    // On success the browser navigates away to Google, so no further state change here.
  }

  if (confirmationSent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="font-display text-lg text-slate-text">Check your email</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          We sent a confirmation link to <span className="font-medium text-slate-700">{email}</span>. Click it to
          finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="font-display text-lg text-slate-text">{copy.title}</p>
      <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isGoogleLoading || isSubmitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon className="h-4 w-4" />
        Continue with Google
      </button>

      <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or with email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
          />
        </div>

        {error && <p className="text-sm text-signal-pivot">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {copy.submittingLabel}
            </>
          ) : (
            copy.submitLabel
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-medium text-brand hover:text-brand-dim">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:text-brand-dim">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
