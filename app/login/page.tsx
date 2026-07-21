import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Log in — FounderCopilot",
  description: "Log in to FounderCopilot to see your saved validation reports.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-md px-6 pt-12 sm:pt-16">
          {error && (
            <div className="mb-6 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-3 text-sm text-signal-pivot">
              {error}
            </div>
          )}
          <AuthForm mode="login" next={next || "/"} />
        </section>
      </div>
    </div>
  );
}
