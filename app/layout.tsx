import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const navigation = [
  { label: "Next.js Docs", href: "https://nextjs.org/docs/app", external: true },
  { label: "Drizzle ORM", href: "https://orm.drizzle.team", external: true },
  { label: "OpenAI Agents", href: "https://github.com/openai/agents", external: true },
  { label: "Health Check", href: "/api/health", external: false },
] as const;

const navLinkClasses =
  "rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/50 hover:text-foreground";

export const metadata: Metadata = {
  title: "Next.js AI Starter",
  description:
    "TypeScript-first Next.js App Router project with Drizzle ORM, Neon, Tailwind CSS, and the OpenAI Agents SDK.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-border/60 bg-surface/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                  Starter
                </span>
                <h1 className="text-2xl font-semibold tracking-tight">Next.js AI Starter</h1>
                <p className="max-w-xl text-sm text-muted-foreground">
                  An opinionated foundation for AI-enabled products that pairs the Next.js App Router
                  with typed database access and modern tooling.
                </p>
              </div>
              <nav className="flex flex-wrap gap-3 text-muted-foreground">
                {navigation.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      className={navLinkClasses}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.label} className={navLinkClasses} href={item.href}>
                      {item.label}
                    </Link>
                  ),
                )}
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16 lg:py-20">{children}</div>
          </main>
          <footer className="border-t border-border/60 bg-surface/70">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>&copy; {currentYear} Next.js AI Starter</span>
              <code className="rounded-md bg-foreground/10 px-3 py-1.5 font-mono text-xs text-foreground">
                npm run dev
              </code>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
