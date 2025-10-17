import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

import { getDb } from "@/lib/db/client";
import { learners, type Learner } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "learner_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function getOrCreateLearner(): Promise<Learner> {
  const cookieStore = await cookies();
  const db = getDb();

  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const existingLearner = await db.query.learners.findFirst({
      where: eq(learners.sessionId, sessionId),
    });

    if (existingLearner) {
      await db
        .update(learners)
        .set({ lastActiveAt: new Date() })
        .where(eq(learners.id, existingLearner.id));

      return {
        ...existingLearner,
        lastActiveAt: new Date(),
      };
    }
  }

  sessionId = generateSessionId();

  const [newLearner] = await db
    .insert(learners)
    .values({
      sessionId,
      displayName: `Learner ${sessionId.slice(0, 8)}`,
    })
    .returning();

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return newLearner;
}

export async function getCurrentLearner(): Promise<Learner | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const db = getDb();
  const learner = await db.query.learners.findFirst({
    where: eq(learners.sessionId, sessionId),
  });

  if (learner) {
    await db.update(learners).set({ lastActiveAt: new Date() }).where(eq(learners.id, learner.id));

    return {
      ...learner,
      lastActiveAt: new Date(),
    };
  }

  return null;
}

export async function clearLearnerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
