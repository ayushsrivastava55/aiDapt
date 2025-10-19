import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  calibrateDifficulty,
  type CalibrateDifficultyParams,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const difficultyRequestSchema = z.object({
  learnerPerformance: z.object({
    accuracy: z.number().min(0).max(1),
    timeSpent: z.number().int().min(1),
    attemptsCount: z.number().int().min(1),
    frustrationIndicators: z.array(z.string()),
  }),
  contentMetrics: z.object({
    currentDifficulty: z.string(),
    targetSkills: z.array(z.string()),
    complexity: z.number().min(1).max(10),
  }),
  learnerContext: z.object({
    level: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
    recentPerformance: z.array(z.number()),
    preferences: z.array(z.string()),
  }),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = difficultyRequestSchema.parse(body);

    const difficultyParams: CalibrateDifficultyParams = {
      learnerPerformance: validatedData.learnerPerformance,
      contentMetrics: validatedData.contentMetrics,
      learnerContext: validatedData.learnerContext,
    };

    const calibration = await calibrateDifficulty(difficultyParams);

    return NextResponse.json({
      success: true,
      calibration,
      metadata: {
        learnerId: learner.id,
        calibratedAt: new Date().toISOString(),
        agentUsed: "Difficulty Calibrator",
      },
    });
  } catch (error) {
    console.error("Error calibrating difficulty:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid request data",
          details: error.errors,
        },
        { status: 400 },
      );
    }

    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        {
          error: "agent_error",
          message: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to calibrate difficulty",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}