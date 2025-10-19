# Next.js AI Starter

An opinionated Next.js 15 App Router project for TypeScript-only development. It bundles Drizzle ORM, the Neon serverless driver, Tailwind CSS v4, and the OpenAI Agents SDK so you can ship AI-enabled products without the boilerplate.

## What's included

- Next.js App Router with strict TypeScript configuration and path aliases.
- Styling via Tailwind CSS v4 with shared design tokens in `app/globals.css`.
- Database tooling powered by Drizzle ORM, Neon HTTP driver, and CLI helpers.
- OpenAI Agents SDK with a helper to register your API key and a health endpoint.
- DX utilities: ESLint (project-aware), Prettier, and dedicated npm scripts.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and provide your secrets:

   ```bash
   cp .env.example .env.local
   ```

   Set values for `OPENAI_API_KEY` and `DATABASE_URL` before running database or agent features.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 to see the landing page.

## Environment variables

Required variables (locally via `.env.local` and in Vercel Project Settings):

- DATABASE_URL: Postgres connection string (e.g. from Neon)
- OPENAI_API_KEY: Your OpenAI API key

See `.env.example` for the expected keys. The `/api/health` endpoint reports whether these are configured.

## Available scripts

| Script                 | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Start the Next.js development server with Turbopack. |
| `npm run build`        | Create a production build.                           |
| `npm run start`        | Serve the production build.                          |
| `npm run lint`         | Run ESLint with project-aware TypeScript settings.   |
| `npm run lint:fix`     | Lint and automatically fix fixable issues.           |
| `npm run typecheck`    | Execute `tsc --noEmit` to ensure type safety.        |
| `npm run format`       | Check formatting with Prettier.                      |
| `npm run format:write` | Format files in-place with Prettier.                 |
| `npm run db:generate`  | Generate SQL migrations from the Drizzle schema.     |
| `npm run db:push`      | Push the generated migrations to the database.       |
| `npm run db:studio`    | Launch Drizzle Studio for interactive exploration.   |
| `npm run db:seed`      | Seed the database with initial sample data.          |

## Project structure

```
app/
  api/health/route.ts      # Minimal health check with env awareness
  layout.tsx               # Global shell and navigation
  page.tsx                 # Landing page describing the tooling
lib/
  ai/provider.ts           # Helper to register the OpenAI Agents API key
  db/client.ts             # Neon HTTP driver + Drizzle singleton
  db/schema.ts             # Drizzle schema with learners, skills, units, activities
  db/seed.ts               # Database seeding script
  db/README.md             # Database documentation
  session.ts               # Anonymous session management with cookies
drizzle/                   # Generated migrations directory
drizzle.config.ts          # Drizzle CLI configuration
.env.example               # Environment variable template
```

## Database workflow

Drizzle ORM is configured to use the Neon HTTP driver for serverless-friendly Postgres access.

- Define your tables in `lib/db/schema.ts`.
- Generate migrations with `npm run db:generate` (drizzle-kit generate).
- Apply migrations using `npm run db:push` (drizzle-kit push).
- Inspect and modify data via `npm run db:studio`.
- Optionally seed local or remote data with `npm run db:seed`.

`drizzle.config.ts` will stop the CLI if `DATABASE_URL` is not defined, preventing accidental misconfiguration.

## OpenAI Agents SDK

The `@openai/agents` package is installed with a convenience helper (`lib/ai/provider.ts`) that registers your API key using `ensureOpenAIConfigured()`. Call this on the server before creating or running agents. The `/api/health` endpoint reports whether the API key is present so you can monitor readiness quickly.

## Health check API

`GET /api/health` responds with a JSON payload describing the availability of critical environment variables. It's marked as dynamic to avoid caching so that status is always fresh.

## Formatting and linting

- Prettier configuration lives in `package.json` and can be enforced with `npm run format` or `npm run format:write`.
- ESLint uses the flat config, extends the Next.js presets, and integrates Prettier while pointing at `tsconfig.json` for type-aware rules.

## Deployment (Vercel)

The project is optimized for Vercel. Follow these steps to deploy:

1. Create a Postgres database (Neon recommended) and note your connection string.
2. Run database migrations against the target database (before first deploy):
   - Either export the URL and push directly:
     ```bash
     export DATABASE_URL="postgresql://user:password@host/db"
     npm run db:push
     ```
   - Or temporarily place it in a local `.env.local` and run `npm run db:push`.
   - (Optional) Seed initial data: `npm run db:seed`
3. Push your repository to GitHub and import it as a new project in Vercel.
4. In Vercel → Project Settings → Environment Variables, add the following for Production and Preview:
   - `DATABASE_URL` (required)
   - `OPENAI_API_KEY` (required if using agent features)
5. Build settings:
   - Framework: Next.js (auto-detected)
   - Build command: `npm run build`
   - Install command: `npm ci` (auto)
   - Output directory: `.next` (auto)
6. Deploy. After the first deployment, verify readiness at `/api/health`.

Notes:
- Vercel builds do not run Drizzle migrations automatically. Re-run `npm run db:push` whenever you change the schema.
- The production server is started by Vercel; locally you can simulate with `npm run build && npm run start`.

## Continuous Integration (CI)

A basic GitHub Actions workflow runs on every push and pull request to ensure the project is ready to deploy:

- Installs dependencies with `npm ci`
- Lints with `npm run lint`
- Typechecks with `npm run typecheck`
- Builds with `npm run build`

You can find it at `.github/workflows/ci.yml`.

You're ready to ship — customize the schema, wire up agents, and start building!
