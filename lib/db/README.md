# Database Layer

This directory contains the database schema, client configuration, and utilities for the learning platform.

## Schema Overview

The database schema includes the following tables:

### Core Tables

- **learners**: Stores anonymous learners with session-based authentication
- **skills**: Defines learning skills/subjects (e.g., Math, Science)
- **units**: Learning units that belong to skills
- **activities**: Individual activities within units (practice, quiz, test, challenge)
- **attempts**: Records of learner attempts at activities
- **skill_states**: Tracks learner progress on specific skills

### Enums

- **activity_type**: `practice`, `quiz`, `test`, `challenge`
- **skill_state_status**: `not_started`, `in_progress`, `mastered`, `review_needed`
- **attempt_status**: `in_progress`, `completed`, `abandoned`

## Relationships

```
skills (1) -> (many) units
units (1) -> (many) activities
activities (1) -> (many) attempts
learners (1) -> (many) attempts
learners (1) -> (many) skill_states
skills (1) -> (many) skill_states
```

## Database Commands

### Generate Migrations

After modifying the schema in `schema.ts`, generate a new migration:

```bash
npm run db:generate
```

### Push Migrations

Apply migrations to your database:

```bash
npm run db:push
```

### Seed Database

Populate the database with initial sample data:

```bash
npm run db:seed
```

### Database Studio

Launch Drizzle Studio to browse and edit data:

```bash
npm run db:studio
```

## Anonymous Sessions

The `lib/session.ts` file provides utilities for managing anonymous learner sessions using HTTP-only cookies:

- `getOrCreateLearner()`: Gets the current learner or creates a new one
- `getCurrentLearner()`: Gets the current learner without creating a new one
- `clearLearnerSession()`: Clears the current session

### Usage Example

```typescript
import { getOrCreateLearner } from "@/lib/session";

export async function GET() {
  const learner = await getOrCreateLearner();

  return Response.json({
    id: learner.id,
    displayName: learner.displayName,
  });
}
```

## Database Client

The database client is a singleton that uses the Neon serverless driver. Access it via:

```typescript
import { getDb } from "@/lib/db/client";

const db = getDb();
```

## Environment Variables

Ensure `DATABASE_URL` is set in your `.env.local` file:

```
DATABASE_URL=postgresql://user:password@host/database
```
