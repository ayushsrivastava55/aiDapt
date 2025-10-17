# Next.js AI Starter

An opinionated Next.js 15 App Router project for TypeScript-only development. It bundles Drizzle ORM, the Neon serverless driver, Tailwind CSS v4, and the OpenAI Agents SDK so you can ship AI-enabled products without the boilerplate.

## What's included

- **Next.js App Router** with strict TypeScript configuration and path aliases.
- **Styling** via Tailwind CSS v4 with shared design tokens in `app/globals.css`.
- **Database tooling** powered by Drizzle ORM, Neon HTTP driver, and CLI helpers.
- **OpenAI Agents SDK** with a helper to register your API key and a health endpoint.
- **DX utilities**: ESLint (project-aware), Prettier, and dedicated npm scripts.

## Getting started

1. Install dependencies (already done in this scaffold):

   ```bash
   npm install
   ```

2. Copy the environment template and provide your secrets:

   ```bash
   cp .env.example .env.local
   ```

   Update `OPENAI_API_KEY` and `DATABASE_URL` before running database or agent features.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) to see the landing page.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server with Turbopack. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint with project-aware TypeScript settings. |
| `npm run lint:fix` | Lint and automatically fix fixable issues. |
| `npm run typecheck` | Execute `tsc --noEmit` to ensure type safety. |
| `npm run format` | Check formatting with Prettier. |
| `npm run format:write` | Format files in-place with Prettier. |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema. |
| `npm run db:push` | Push the generated migrations to the database. |
| `npm run db:studio` | Launch Drizzle Studio for interactive exploration. |

## Project structure

```
app/
  api/health/route.ts      # Minimal health check with env awareness
  layout.tsx               # Global shell and navigation
  page.tsx                 # Landing page describing the tooling
lib/
  ai/provider.ts           # Helper to register the OpenAI Agents API key
  db/client.ts             # Neon HTTP driver + Drizzle singleton
  db/schema.ts             # Example Drizzle schema
drizzle.config.ts         # Drizzle CLI configuration
.env.example               # Environment variable template
```

## Database workflow

Drizzle ORM is configured to use the Neon HTTP driver for serverless-friendly Postgres access.

- Define your tables in `lib/db/schema.ts`.
- Generate migrations with `npm run db:generate`.
- Apply migrations using `npm run db:push`.
- Inspect and modify data via `npm run db:studio`.

`drizzle.config.ts` will stop the CLI if `DATABASE_URL` is not defined, preventing accidental misconfiguration.

## OpenAI Agents SDK

The `@openai/agents` package is installed with a convenience helper (`lib/ai/provider.ts`) that registers your API key using `ensureOpenAIConfigured()`. Call this on the server before creating or running agents. The `/api/health` endpoint reports whether the API key is present so you can monitor readiness quickly.

## Health check API

`GET /api/health` responds with a JSON payload describing the availability of critical environment variables. It's configured to run on the edge runtime and marked as dynamic to avoid caching so that status is always fresh.

## Formatting and linting

- Prettier configuration lives in `package.json` and can be enforced with `npm run format` or `npm run format:write`.
- ESLint is set up with the new flat config, extends the Next.js presets, and integrates Prettier while pointing at `tsconfig.json` for type-aware rules.

You're ready to ship — customize the schema, wire up agents, and start building!
