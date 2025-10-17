import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import { getDb } from "@/lib/db/client";
import {
  activities,
  attempts,
  skillStates,
  type SkillState,
} from "@/lib/db/schema";
import {
  getActivityState,
  isAttemptSuccessful,
  updateActivityState,
  updateSkillMetadata,
  type SkillSRSMetadata,
} from "@/lib/srs";

export const dynamic = "force-dynamic";

const submitAttemptSchema = z.object({
  activityId: z.string().uuid(),
  status: z.enum(["in_progress", "completed", "abandoned"]).default("completed"),
  score: z.number().finite().optional(),
  maxScore: z.number().positive().optional(),
  success: z.boolean().optional(),
  response: z.any().optional(),
  feedback: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});

type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

function determineSuccess(input: SubmitAttemptInput): boolean {
  if (typeof input.success === "boolean") {
    return input.success;
  }

  if (typeof input.score === "number" && typeof input.maxScore === "number") {
    return isAttemptSuccessful(input.score, input.maxScore);
  }

  return input.status === "completed";
}

function calculateSkillProgress(
  metadata: SkillSRSMetadata,
  totalActivities: number,
): number {
  if (totalActivities === 0) {
    return 0;
  }

  const states = metadata.activityStates ?? {};
  const totalLevel = Object.values(states).reduce((sum, state) => sum + state.level, 0);

  return Math.min(1, totalLevel / (totalActivities * 3));
}

function determineSkillStatus(previous: SkillState | null, progress: number, success: boolean) {
  if (progress >= 0.95) {
    return "mastered" as const;
  }

  if (!previous || previous.status === "not_started") {
    return success ? "in_progress" : "review_needed";
  }

  if (!success) {
    return "review_needed" as const;
  }

  return previous.status === "mastered" ? "in_progress" : previous.status;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = submitAttemptSchema.parse(body);

    const learner = await getOrCreateLearner();
    const db = getDb();
    const attemptDate = new Date();

    const activityRecord = await db.query.activities.findFirst({
      where: eq(activities.id, input.activityId),
      with: {
        unit: {
          with: {
            skill: {
              with: {
                units: {
                  with: {
                    activities: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!activityRecord || !activityRecord.unit?.skill) {
      return NextResponse.json(
        {
          error: "activity_not_found",
          message: "The requested activity could not be found",
        },
        { status: 404 },
      );
    }

    const skill = activityRecord.unit.skill;
    const skillActivities = skill.units
      ?.flatMap((unit) => unit.activities ?? [])
      .filter((activity) => activity !== null) ?? [];

    const existingSkillState = await db.query.skillStates.findFirst({
      where: and(eq(skillStates.learnerId, learner.id), eq(skillStates.skillId, skill.id)),
    });

    const previousMetadata = (existingSkillState?.metadata as SkillSRSMetadata | null) ?? { activityStates: {} };
    const activityStateBefore = getActivityState(previousMetadata, input.activityId);
    const success = determineSuccess(input);
    const updatedActivityState = updateActivityState(activityStateBefore, success, attemptDate);
    const updatedMetadata = updateSkillMetadata(previousMetadata, input.activityId, updatedActivityState);
    const totalActivities = skillActivities.length;
    const progress = calculateSkillProgress(updatedMetadata, totalActivities);
    const status = determineSkillStatus(existingSkillState ?? null, progress, success);

    let updatedSkillState: SkillState;

    if (existingSkillState) {
      const [state] = await db
        .update(skillStates)
        .set({
          status,
          progress,
          masteryScore: progress,
          metadata: updatedMetadata,
          updatedAt: attemptDate,
        })
        .where(eq(skillStates.id, existingSkillState.id))
        .returning();

      updatedSkillState = state;
    } else {
      const [state] = await db
        .insert(skillStates)
        .values({
          learnerId: learner.id,
          skillId: skill.id,
          status,
          progress,
          masteryScore: progress,
          metadata: updatedMetadata,
        })
        .returning();

      updatedSkillState = state;
    }

    const [attempt] = await db
      .insert(attempts)
      .values({
        learnerId: learner.id,
        activityId: input.activityId,
        status: input.status,
        score: input.score,
        maxScore: input.maxScore,
        response: input.response,
        feedback: input.feedback,
        metadata: input.metadata,
        completedAt: input.status === "completed" ? attemptDate : undefined,
      })
      .returning();

    return NextResponse.json(
      {
        attempt,
        success,
        skillState: updatedSkillState,
        srs: updatedActivityState,
      },
      { status: 201 },
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

    console.error("Error submitting attempt:", error);
    return NextResponse.json(
      {
        error: "failed_to_submit_attempt",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
