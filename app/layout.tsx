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
  { label: "Home", href: "/", external: false },
  { label: "Learn", href: "/learn", external: false },
  { label: "Progress", href: "/progress", external: false },
  { label: "Social", href: "/social", external: false },
  { label: "Study Rooms", href: "/study-rooms", external: false },
  { label: "Achievements", href: "/achievements", external: false },
  { label: "Health Check", href: "/api/health", external: false },
  { label: "Next.js Docs", href: "https://nextjs.org/docs/app", external: true },
  { label: "Drizzle ORM", href: "https://orm.drizzle.team", external: true },
  { label: "OpenAI Agents", href: "https://github.com/openai/agents", external: true },
] as const;

const navLinkClasses =
  "rounded-base border-2 border-border px-4 py-2 text-sm font-heading transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-shadow bg-background shadow-shadow";

export const metadata: Metadata = {
  title: "aiDapt - AI Learning Platform",
  description:
    "Intelligent learning platform that generates personalized micro-courses using AI. Create adaptive learning experiences.",
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
          <header className="border-b-4 border-border bg-main shadow-shadow">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🧠</span>
                  <div>
                    <h1 className="text-3xl font-heading tracking-tight text-main-foreground">aiDapt</h1>
                    <p className="text-sm font-base text-main-foreground/80">
                      AI-Powered Learning Platform
                    </p>
                  </div>
                </div>
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
          <main className="flex-1 bg-background">
            <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 lg:py-20">{children}</div>
          </main>
          <footer className="border-t-4 border-border bg-secondary-background shadow-shadow mt-auto">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-6 py-8 text-sm font-base sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <span className="font-heading text-secondary-foreground">
                  &copy; {currentYear} aiDapt - Powered by AI Agents
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-background border-2 border-border rounded-base shadow-shadow">
                <span className="text-accent">⚡</span>
                <code className="font-mono text-xs text-foreground font-heading">
                  7 AI AGENTS ACTIVE
                </code>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
