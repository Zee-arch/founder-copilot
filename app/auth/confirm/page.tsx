import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { confirmEmailSignup } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Confirm your email — FounderCopilot",
};

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const isValidLink = Boolean(tokenHash && type);

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-md px-6 pt-12 sm:pt-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            {isValidLink ? (
              <>
                <p className="font-display text-lg text-slate-text">Confirm your email</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Click below to finish creating your account.
                </p>
                <form action={confirmEmailSignup} className="mt-6">
                  <input type="hidden" name="token_hash" value={tokenHash} />
                  <input type="hidden" name="type" value={type} />
                  <input type="hidden" name="next" value={next ?? "/"} />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim"
                  >
                    Confirm email address
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="font-display text-lg text-slate-text">That link is invalid</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  This confirmation link is missing required information. Try signing up again.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
