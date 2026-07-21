"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { BRAND_ICON } from "@/lib/report-icons";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
];

function AuthSection() {
  // `SiteHeader` is a client component (several pages that render it — e.g.
  // LandingPage, the report layout — are themselves client components, so
  // this can't be flipped to a server component without also restructuring
  // those). `getSession()` reads from local storage rather than making a
  // network round-trip, so the signed-in flash-on-load is brief in practice.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // AuthSection mounts on every page, including anonymous ones — if
    // Supabase isn't configured (e.g. local dev before setup, or a preview
    // deploy missing env vars), fail quiet and just show the signed-out
    // state instead of throwing on every page load.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setUser(null);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));

    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) {
    return <span className="h-9 w-20" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dim"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <form action={signOut} className="flex items-center gap-3">
      <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        Dashboard
      </Link>
      <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
      <button
        type="submit"
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
      >
        Sign out
      </button>
    </form>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <BRAND_ICON className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg leading-none text-slate-text">FounderCopilot</p>
            <p className="mt-1 text-sm text-slate-500">Your AI co-founder</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-ink text-ink-text" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />

          <AuthSection />
        </div>
      </div>
    </header>
  );
}
