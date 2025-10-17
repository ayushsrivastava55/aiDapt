import Link from "next/link";

const features = [
  {
    title: "TypeScript-first by default",
    description:
      "App Router pages, layouts, and configs are authored in TypeScript with strict compiler and linting settings to keep your codebase cohesive.",
    highlights: [
      "Bundler-based module resolution with path aliases",
      "Pre-configured ESLint + Prettier integration",
      "Shared design tokens defined in app/globals.css",
    ],
  },
  {
    title: "Database ready",
    description:
      "Drizzle ORM is paired with the Neon HTTP driver for first-class Postgres support, including a sample schema and CLI configuration.",
    highlights: [
      "Schema lives in lib/db/schema.ts",
      "drizzle.config.ts enforces DATABASE_URL",
      "Helper for establishing a singleton connection",
    ],
  },
  {
    title: "AI tooling on standby",
    description:
      "The OpenAI Agents SDK is installed with a lightweight helper to register your API key as soon as you're ready to prototype agents.",
    highlights: [
      "Configure OPENAI_API_KEY in your environment",
      "Use ensureOpenAIConfigured() before agent runs",
      "Health endpoint surfaces missing secrets",
    ],
  },
  {
    title: "Developer workflow",
    description:
      "A focused script catalog keeps formatting, type-checking, and database tasks close at hand so you can stay productive.",
    highlights: [
      "npm run format / format:write for Prettier",
      "npm run typecheck for strict typing",
      "Drizzle Studio and migration helpers included",
    ],
  },
] as const;

const commands = [
  {
    command: "npm run dev",
    detail: "Start the Next.js development server with Turbopack.",
  },
  {
    command: "npm run lint",
    detail: "Run ESLint with project-aware TypeScript settings.",
  },
  {
    command: "npm run typecheck",
    detail: "Validate the project with the TypeScript compiler.",
  },
  {
    command: "npm run format",
    detail: "Verify code style with Prettier (use format:write to apply fixes).",
  },
  {
    command: "npm run db:generate",
    detail: "Create SQL migrations from the Drizzle schema definition.",
  },
  {
    command: "npm run db:studio",
    detail: "Launch Drizzle Studio for interactive database exploration.",
  },
] as const;

const essentials = [
  {
    label: "Environment",
    description: (
      <>
        Copy <code>.env.example</code> to <code>.env.local</code> and provide values for
        <code> OPENAI_API_KEY</code> and <code> DATABASE_URL</code> before running server-side
        features.
      </>
    ),
  },
  {
    label: "Database",
    description: (
      <>
        Update <code>lib/db/schema.ts</code> with your tables and run <code>npm run db:generate</code>
        to produce migrations.
      </>
    ),
  },
  {
    label: "AI",
    description: (
      <>
        Call <code>ensureOpenAIConfigured()</code> from <code>lib/ai/provider.ts</code> before using the
        Agents SDK to guarantee your API key is registered.
      </>
    ),
  },
  {
    label: "Health",
    description: (
      <>
        Monitor <Link href="/api/health" className="underline decoration-dashed underline-offset-4">
          /api/health
        </Link>{" "}
        for a quick status report on critical environment variables.
      </>
    ),
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col gap-16">
      <section className="space-y-6">
        <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-surface/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Ready to build
        </span>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Kickstart your AI-enabled product with confidence.
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground">
            This starter stitches together Next.js, Drizzle ORM, Neon, Tailwind CSS, and the OpenAI Agents SDK so you can focus on application logic instead of boilerplate.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="flex h-full flex-col gap-4 rounded-xl border border-border/60 bg-surface/70 p-6 shadow-sm"
          >
            <div>
              <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
            <ul className="mt-auto list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {feature.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border/60 bg-surface/70 p-6">
        <h3 className="text-lg font-semibold tracking-tight">Essential commands</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Pair these scripts with the provided environment variables to iterate quickly.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {commands.map((item) => (
            <div key={item.command} className="space-y-2 rounded-lg border border-border/40 bg-background/40 p-4">
              <code className="inline-flex w-full items-center justify-between gap-2 rounded-md bg-foreground/10 px-3 py-2 font-mono text-xs text-foreground">
                {item.command}
              </code>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {essentials.map((item) => (
          <div key={item.label} className="space-y-2 rounded-xl border border-border/60 bg-surface/70 p-6">
            <h3 className="text-base font-semibold tracking-tight">{item.label}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
