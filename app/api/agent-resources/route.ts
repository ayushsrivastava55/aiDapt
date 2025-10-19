import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  curateResources,
  type CurateResourcesParams,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const resourceRequestSchema = z.object({
  topic: z.string().min(1),
  learnerLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
  learningObjectives: z.array(z.string()).min(1),
  preferredFormats: z.array(z.string()).min(1),
  timeAvailable: z.number().int().min(10).max(300),
  budget: z.enum(["free", "paid", "any"]),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = resourceRequestSchema.parse(body);

    const resourceParams: CurateResourcesParams = {
      topic: validatedData.topic,
      learnerLevel: validatedData.learnerLevel,
      learningObjectives: validatedData.learningObjectives,
      preferredFormats: validatedData.preferredFormats,
      timeAvailable: validatedData.timeAvailable,
      budget: validatedData.budget,
    };

    const curation = await curateResources(resourceParams);

    return NextResponse.json({
      success: true,
      curation,
      metadata: {
        learnerId: learner.id,
        curatedAt: new Date().toISOString(),
        agentUsed: "Resource Curator",
      },
    });
  } catch (error) {
    console.error("Error curating resources:", error);

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
        error: "Failed to curate resources",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}