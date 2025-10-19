import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import { getDb } from "@/lib/db/client";
import {
  skills,
  units,
  activities,
  skillStates,
  type NewSkill,
  type NewUnit,
  type NewActivity,
} from "@/lib/db/schema";
import {
  generateMicrocourse,
  type GenerateMicrocourseParams,
  type MicrocourseActivityContent,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const generateCourseRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  learnerLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]).optional(),
  objectives: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  conceptCardCount: z.number().int().min(2).max(6).optional(),
  quizItemCount: z.number().int().min(3).max(6).optional(),
  tone: z.enum(["encouraging", "neutral", "direct"]).optional(),
  emphasis: z.string().optional(),
});

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}

async function findExistingUnit(learnerId: string, normalizedTopic: string) {
  const db = getDb();

  const existing = await db
    .select({
      unitId: units.id,
      skillId: units.skillId,
    })
    .from(units)
    .innerJoin(
      skillStates,
      and(eq(skillStates.skillId, units.skillId), eq(skillStates.learnerId, learnerId)),
    )
    .where(sql`${units.metadata}->>'normalizedTopic' = ${normalizedTopic}`)
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  const [{ unitId, skillId }] = existing;

  const [{ activityCount }] = await db
    .select({
      activityCount: sql<number>`count(*)`,
    })
    .from(activities)
    .where(eq(activities.unitId, unitId));

  return {
    unitId,
    skillId,
    activityCount: Number(activityCount) || 0,
  } as const;
}

async function persistCourseContent(
  learnerId: string,
  topic: string,
  normalizedTopic: string,
  courseContent: MicrocourseActivityContent,
) {
  const db = getDb();
  const registeredAt = new Date().toISOString();

  const skillMetadata = {
    normalizedTopic,
    learnerLevel: courseContent.learnerLevel,
    tone: courseContent.tone,
    objectives: courseContent.objectives,
    focusAreas: courseContent.focusAreas,
    prerequisites: courseContent.prerequisites,
    recommendedDurationMinutes: courseContent.recommendedDurationMinutes,
    generationMetadata: courseContent.metadata,
  } satisfies NewSkill["metadata"];

  const [skill] = await db
    .insert(skills)
    .values({
      name: topic,
      description: courseContent.overview,
      level: 1,
      metadata: skillMetadata,
    })
    .returning();

  const unitMetadata = {
    normalizedTopic,
    version: courseContent.version,
    overview: courseContent.overview,
    closingSummary: courseContent.closingSummary,
    objectives: courseContent.objectives,
    focusAreas: courseContent.focusAreas,
    prerequisites: courseContent.prerequisites,
    recommendedDurationMinutes: courseContent.recommendedDurationMinutes,
    conceptCardCount: courseContent.conceptCards.length,
    quizItemCount: courseContent.quiz.length,
    generationMetadata: courseContent.metadata,
  } satisfies NewUnit["metadata"];

  const [unit] = await db
    .insert(units)
    .values({
      skillId: skill.id,
      name: `${topic} Course`,
      description: courseContent.closingSummary,
      order: 0,
      metadata: unitMetadata,
    })
    .returning();

  const activitiesData: NewActivity[] = [];

  courseContent.conceptCards.forEach((card, index) => {
    activitiesData.push({
      unitId: unit.id,
      name: card.title,
      description: card.summary,
      type: "practice",
      order: index,
      content: {
        kind: "concept-card",
        version: courseContent.version,
        topic: courseContent.topic,
        card,
      },
      metadata: {
        sourceType: "microcourse",
        normalizedTopic,
        conceptCardId: card.id,
      },
    });
  });

  const baseOrder = courseContent.conceptCards.length;
  courseContent.quiz.forEach((quizItem, index) => {
    const truncatedQuestion =
      quizItem.question.length > 70
        ? `${quizItem.question.slice(0, 67).trimEnd()}…`
        : quizItem.question;

    activitiesData.push({
      unitId: unit.id,
      name: truncatedQuestion,
      description: quizItem.explanation,
      type: "quiz",
      order: baseOrder + index,
      content: {
        kind: "quiz-item",
        version: courseContent.version,
        topic: courseContent.topic,
        quizItem,
      },
      metadata: {
        sourceType: "microcourse",
        normalizedTopic,
        quizItemId: quizItem.id,
        difficulty: quizItem.difficulty,
      },
    });
  });

  if (activitiesData.length > 0) {
    await db.insert(activities).values(activitiesData);
  }

  await db.insert(skillStates).values({
    learnerId,
    skillId: skill.id,
    status: "not_started",
    progress: 0,
    metadata: {
      topic,
      normalizedTopic,
      registeredAt,
    },
  });

  return {
    unitId: unit.id,
    skillId: skill.id,
    activityCount: activitiesData.length,
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = generateCourseRequestSchema.parse(body);

    // Ensure learner session
    const learner = await getOrCreateLearner();

    // Normalize topic for idempotency check
    const normalizedTopic = normalizeTopic(validatedData.topic);

    // Check for existing unit (idempotency)
    const existingUnit = await findExistingUnit(learner.id, normalizedTopic);
    if (existingUnit) {
      return NextResponse.json(
        {
          unitId: existingUnit.unitId,
          skillId: existingUnit.skillId,
          activityCount: existingUnit.activityCount,
          isExisting: true,
        },
        { status: 200 },
      );
    }

    // Generate course content using agent service
    const generationParams: GenerateMicrocourseParams = {
      topic: validatedData.topic,
      learnerLevel: validatedData.learnerLevel,
      objectives: validatedData.objectives,
      focusAreas: validatedData.focusAreas,
      prerequisites: validatedData.prerequisites,
      conceptCardCount: validatedData.conceptCardCount,
      quizItemCount: validatedData.quizItemCount,
      tone: validatedData.tone,
      emphasis: validatedData.emphasis,
    };

    const courseContent = await generateMicrocourse(generationParams);

    // Persist unit, skills, activities in DB
    const result = await persistCourseContent(
      learner.id,
      validatedData.topic,
      normalizedTopic,
      courseContent,
    );

    return NextResponse.json(
      {
        unitId: result.unitId,
        skillId: result.skillId,
        activityCount: result.activityCount,
        isExisting: false,
      },
      { status: 201 },
    );
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    // Handle other errors
    console.error("Error generating course:", error);

    return NextResponse.json(
      {
        error: "Failed to generate course",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
