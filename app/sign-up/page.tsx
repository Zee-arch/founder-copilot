import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign up — FounderCopilot",
  description: "Create a FounderCopilot account to save your validation reports.",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-md px-6 pt-12 sm:pt-16">
          <AuthForm mode="sign-up" />
        </section>
      </div>
    </div>
  );
}
