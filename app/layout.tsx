import type { Metadata } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { ReportProvider } from "@/lib/report-context";
import "./globals.css";

// Body copy — legible workhorse, stays quiet.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Display face for the verdict headline and the big score numeral —
// a serif gives the "diagnostic reading" a bit of gravity instead of
// looking like another generic SaaS dashboard.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});

// Monospace for data: scores, TAM/SAM/SOM figures, labels — signals "this is a measurement."
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "FounderCopilot",
  description: "Your AI co-founder for startup idea validation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans antialiased`}
      >
        <ReportProvider>{children}</ReportProvider>
      </body>
    </html>
  );
}
