import Link from "next/link";
import { CodeXml } from "lucide-react";
import { BRAND_ICON } from "@/lib/report-icons";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <BRAND_ICON className="h-4 w-4" />
          </span>
          <p className="font-display text-sm text-slate-text">FounderCopilot</p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-900">
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/zee-arch/founder-copilot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-900"
          >
            <CodeXml className="h-3.5 w-3.5" />
            Source
          </a>
        </nav>
      </div>

      <div className="border-t border-slate-200/80">
        <p className="mx-auto max-w-5xl px-6 py-4 text-xs leading-relaxed text-slate-400">
          Reports are AI-generated estimates grounded in live web search, not verified market research or
          financial advice — always labeled, never dressed up as certainty.
        </p>
      </div>
    </footer>
  );
}
