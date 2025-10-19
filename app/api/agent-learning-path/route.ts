import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  generateLearningPath,
  type GenerateLearningPathParams,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const learningPathRequestSchema = z.object({
  goals: z.array(z.string()).min(1),
  currentLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
  timeAvailable: z.number().int().min(1).max(40),
  preferredPace: z.enum(["slow", "moderate", "fast"]),
  interests: z.array(z.string()),
  weakAreas: z.array(z.string()).optional(),
  strongAreas: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = learningPathRequestSchema.parse(body);

    const pathParams: GenerateLearningPathParams = {
      goals: validatedData.goals,
      currentLevel: validatedData.currentLevel,
      timeAvailable: validatedData.timeAvailable,
      preferredPace: validatedData.preferredPace,
      interests: validatedData.interests,
      weakAreas: validatedData.weakAreas,
      strongAreas: validatedData.strongAreas,
    };

    const learningPath = await generateLearningPath(pathParams);

    return NextResponse.json({
      success: true,
      learningPath,
      metadata: {
        learnerId: learner.id,
        generatedAt: new Date().toISOString(),
        agentUsed: "Learning Path Optimizer",
      },
    });
  } catch (error) {
    console.error("Error generating learning path:", error);

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
        error: "Failed to generate learning path",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}