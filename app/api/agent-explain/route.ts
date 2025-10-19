import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import { getDb } from "@/lib/db/client";
import {
  activities,
  attempts,
  skillStates,
  skills,
  type Skill,
  type SkillState,
} from "@/lib/db/schema";
import {
  type SkillSRSMetadata,
} from "@/lib/srs";
import {
  generateTailoredExplanation,
  type TailoredExplanationContent,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const explanationSchema = z
  .object({
    activityId: z.string().uuid().optional(),
    skillId: z.string().uuid().optional(),
    topic: z.string().min(1).optional(),
    question: z.string().optional(),
    submittedAnswer: z.string().optional(),
    correctAnswer: z.string().optional(),
    misconceptions: z.array(z.string()).optional(),
    strengths: z.array(z.string()).optional(),
    struggles: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    preferredStyle: z.enum(["concise", "detailed", "storytelling", "visual"]).optional(),
    tone: z.enum(["encouraging", "neutral", "direct"]).optional(),
    contextNotes: z.array(z.string()).optional(),
  })
  .refine((data) => Boolean(data.topic || data.skillId || data.activityId), {
    message: "Provide at least a topic, skillId, or activityId",
    path: ["topic"],
  });

const normalizeLearnerLevel = (value: unknown): "beginner" | "intermediate" | "advanced" | "mixed" => {
  const validLevels = new Set(["beginner", "intermediate", "advanced", "mixed"]);
  if (typeof value === "string" && validLevels.has(value)) {
    return value as "beginner" | "intermediate" | "advanced" | "mixed";
  }

  return "mixed";
};

type SkillContext = {
  skill: Skill | null;
  skillState: SkillState | null;
  metadata: SkillSRSMetadata | undefined;
};

async function loadSkillContext(
  db: ReturnType<typeof getDb>,
  learnerId: string,
  skillId: string,
): Promise<SkillContext> {
  const skillRecord = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
  });

  if (!skillRecord) {
    return { skill: null, skillState: null, metadata: undefined };
  }

  const skillStateRecord = await db.query.skillStates.findFirst({
    where: and(eq(skillStates.learnerId, learnerId), eq(skillStates.skillId, skillRecord.id)),
  });

  const metadata = (skillStateRecord?.metadata as SkillSRSMetadata | null) ?? undefined;

  return {
    skill: skillRecord,
    skillState: skillStateRecord ?? null,
    metadata,
  };
}

function buildContextNotes(
  base: string[] | undefined,
  lastAttempt: (typeof attempts.$inferSelect) | null,
  activitySrs: SkillSRSMetadata["activityStates"] extends infer T
    ? T extends Record<string, infer U>
      ? U
      : undefined
    : undefined,
): string[] {
  const notes = [...(base ?? [])];

  if (lastAttempt) {
    const scoreText =
      typeof lastAttempt.score === "number" && typeof lastAttempt.maxScore === "number"
        ? `${lastAttempt.score}/${lastAttempt.maxScore}`
        : lastAttempt.score !== null && lastAttempt.score !== undefined
          ? `${lastAttempt.score}`
          : "unknown";

    notes.push(
      `Most recent attempt status: ${lastAttempt.status} (score: ${scoreText}) on ${lastAttempt.completedAt ?? lastAttempt.startedAt}`,
    );

    if (lastAttempt.feedback) {
      notes.push(`Tutor feedback: ${JSON.stringify(lastAttempt.feedback)}`);
    }
  }

  if (activitySrs) {
    notes.push(
      `Current SRS level: ${activitySrs.level} (last reviewed at ${activitySrs.lastAttemptAt}, next review due ${activitySrs.nextReviewAt}).`,
    );
  }

  return notes;
}

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const db = getDb();

    const body = await request.json();
    const input = explanationSchema.parse(body);

    let topic = input.topic?.trim();
    let skillContext: SkillContext = { skill: null, skillState: null, metadata: undefined };
    let activityRecord: (typeof activities.$inferSelect & { unit?: { skill?: typeof skills.$inferSelect | null } | null }) | null | undefined = null;
    let lastAttempt: (typeof attempts.$inferSelect) | null = null;
    let activitySrsState:
      | (SkillSRSMetadata["activityStates"] extends infer T
          ? T extends Record<string, infer U>
            ? U
            : undefined
        : undefined)
      | undefined;

    if (input.activityId) {
      activityRecord = await db.query.activities.findFirst({
        where: eq(activities.id, input.activityId),
        with: {
          unit: {
            with: {
              skill: true,
            },
          },
        },
      });

      if (!activityRecord) {
        return NextResponse.json(
          {
            error: "activity_not_found",
            message: "The referenced activity does not exist",
          },
          { status: 404 },
        );
      }

      if (activityRecord.unit?.skill) {
        skillContext = await loadSkillContext(db, learner.id, activityRecord.unit.skill.id);
        topic = topic ?? activityRecord.unit.skill.name ?? activityRecord.name;
      } else {
        topic = topic ?? activityRecord.name;
      }

      const attemptResults = await db
        .select()
        .from(attempts)
        .where(and(eq(attempts.learnerId, learner.id), eq(attempts.activityId, activityRecord.id)))
        .orderBy(desc(attempts.completedAt), desc(attempts.startedAt))
        .limit(1);

      lastAttempt = attemptResults[0] ?? null;

      if (skillContext.metadata?.activityStates && input.activityId in skillContext.metadata.activityStates) {
        activitySrsState = skillContext.metadata.activityStates[input.activityId];
      }
    } else if (input.skillId) {
      skillContext = await loadSkillContext(db, learner.id, input.skillId);
      if (!skillContext.skill) {
        return NextResponse.json(
          {
            error: "skill_not_found",
            message: "The referenced skill does not exist",
          },
          { status: 404 },
        );
      }

      topic = topic ?? skillContext.skill.name;
    }

    if (!topic) {
      return NextResponse.json(
        {
          error: "topic_required",
          message: "Unable to determine a topic for explanation generation",
        },
        { status: 400 },
      );
    }

    const skillMetadata = (skillContext.skillState?.metadata as SkillSRSMetadata | null) ?? skillContext.metadata;
    const inferredLearnerLevel = normalizeLearnerLevel((skillMetadata as Record<string, unknown>)?.learnerLevel);
    const contextNotes = buildContextNotes(input.contextNotes, lastAttempt, activitySrsState);

    const explanation: TailoredExplanationContent = await generateTailoredExplanation({
      topic,
      learnerLevel: inferredLearnerLevel,
      question: input.question,
      submittedAnswer: input.submittedAnswer ?? (lastAttempt?.response as string | undefined),
      correctAnswer: input.correctAnswer,
      misconceptions: input.misconceptions,
      strengths: input.strengths,
      struggles: input.struggles,
      goals: input.goals,
      preferredStyle: input.preferredStyle,
      tone: input.tone,
      contextNotes,
    });

    return NextResponse.json(
      {
        explanation,
        context: {
          learnerLevel: inferredLearnerLevel,
          topic,
          skillId: skillContext.skill?.id,
          activityId: activityRecord?.id,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error("Error generating explanation:", error);
    return NextResponse.json(
      {
        error: "failed_to_generate_explanation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
