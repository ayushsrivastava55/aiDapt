import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  coordinateAgents,
  type CoordinatorRequest,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const coordinatorRequestSchema = z.object({
  type: z.enum([
    "course_generation",
    "assessment",
    "learning_path",
    "difficulty_calibration",
    "resource_curation",
    "progress_analysis",
    "explanation"
  ]),
  content: z.unknown(),
  learnerContext: z.object({
    id: z.string(),
    level: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
    preferences: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = coordinatorRequestSchema.parse(body);

    const coordinatorRequest: CoordinatorRequest = {
      type: validatedData.type,
      content: validatedData.content,
      learnerContext: validatedData.learnerContext || {
        id: learner.id,
        level: "mixed",
      },
    };

    const response = await coordinateAgents(coordinatorRequest);

    return NextResponse.json({
      success: true,
      coordination: response,
      metadata: {
        learnerId: learner.id,
        coordinatedAt: new Date().toISOString(),
        requestType: validatedData.type,
      },
    });
  } catch (error) {
    console.error("Error coordinating agents:", error);

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
        error: "Failed to coordinate agents",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}