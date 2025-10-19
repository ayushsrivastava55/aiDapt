import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  analyzeProgress,
  type AnalyzeProgressParams,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const progressRequestSchema = z.object({
  timeframe: z.enum(["week", "month", "quarter", "all"]),
  focusAreas: z.array(z.string()).optional(),
  includeComparisons: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = progressRequestSchema.parse(body);

    const progressParams: AnalyzeProgressParams = {
      learnerId: learner.id,
      timeframe: validatedData.timeframe,
      focusAreas: validatedData.focusAreas,
      includeComparisons: validatedData.includeComparisons,
    };

    const analytics = await analyzeProgress(progressParams);

    return NextResponse.json({
      success: true,
      analytics,
      metadata: {
        learnerId: learner.id,
        analyzedAt: new Date().toISOString(),
        agentUsed: "Progress Analytics",
        timeframe: validatedData.timeframe,
      },
    });
  } catch (error) {
    console.error("Error analyzing progress:", error);

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
        error: "Failed to analyze progress",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}