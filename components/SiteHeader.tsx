"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BRAND_ICON } from "@/lib/report-icons";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/actions/auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

// `undefined` = not loaded yet, `null` = signed out. Lifted up from
// AuthSection (rather than each auth-aware spot re-fetching its own copy)
// so the compact mobile row and the hamburger dropdown can agree on
// signed-in state without duplicating the Supabase session-fetching logic.
function useSessionUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // Runs on every page, including anonymous ones — if Supabase isn't
    // configured (e.g. local dev before setup, or a preview deploy missing
    // env vars), fail quiet and just show the signed-out state instead of
    // throwing on every page load.
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

  return user;
}

// The compact mobile row only has room for one primary action — "Log in" /
// "Dashboard" move into the hamburger dropdown instead (see
// MobileAuthLinks below). Confirmed live on a real 375px viewport that
// Logo + Log in + Sign up + hamburger didn't all fit; this is the fix.
function AuthSection({ user, compact = false }: { user: User | null | undefined; compact?: boolean }) {
  if (user === undefined) {
    return <span className="h-9 w-20" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        {!compact && (
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900">
            Log in
          </Link>
        )}
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
      {!compact && (
        <>
          <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            Dashboard
          </Link>
          <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
        </>
      )}
      <button
        type="submit"
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
      >
        Sign out
      </button>
    </form>
  );
}

// The links AuthSection drops when compact — shown in the mobile dropdown
// instead, alongside the main nav links, so nothing is actually lost on a
// narrow screen, just relocated.
function MobileAuthLinks({ user }: { user: User | null | undefined }) {
  if (!user) {
    return (
      <Link href="/login" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
        Log in
      </Link>
    );
  }

  return (
    <Link href="/dashboard" className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
      Dashboard
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const user = useSessionUser();
  // Below `sm`, "Home / How It Works / About" plus Log in/Sign up wrapped
  // onto their own rows and ate over a third of a 375px-viewport screen
  // before any real content — a real mobile issue, found by actually
  // opening every route at 375px, not assumed.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <header className="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <BRAND_ICON className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg leading-none text-slate-text">FounderCopilot</p>
            <p className="mt-1 hidden text-sm text-slate-500 sm:block">Your AI co-founder</p>
          </div>
        </Link>

        <div className="hidden flex-wrap items-center gap-4 sm:flex">
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

          <span className="h-5 w-px bg-slate-200" aria-hidden />

          <AuthSection user={user} />
        </div>

        <div className="flex items-center gap-3 sm:hidden">
          <AuthSection user={user} compact />
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav className="border-t border-slate-200/80 bg-white px-6 py-3 sm:hidden">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink text-ink-text" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="my-2 h-px bg-slate-200" aria-hidden />
          <MobileAuthLinks user={user} />
        </nav>
      )}
    </header>
  );
}
