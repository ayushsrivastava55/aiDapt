import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateLearner } from "@/lib/session";
import {
  generateAssessment,
  type GenerateAssessmentParams,
  AgentServiceError,
} from "@/lib/ai/agent-services";

export const dynamic = "force-dynamic";

const assessmentRequestSchema = z.object({
  topic: z.string().min(1),
  learnerLevel: z.enum(["beginner", "intermediate", "advanced", "mixed"]).optional(),
  assessmentType: z.enum(["diagnostic", "formative", "summative"]),
  targetConcepts: z.array(z.string()).min(1),
  questionCount: z.number().int().min(3).max(10).optional(),
  timeLimit: z.number().int().min(5).max(60).optional(),
});

export async function POST(request: Request) {
  try {
    const learner = await getOrCreateLearner();
    const body = await request.json();
    const validatedData = assessmentRequestSchema.parse(body);

    const assessmentParams: GenerateAssessmentParams = {
      topic: validatedData.topic,
      learnerLevel: validatedData.learnerLevel,
      assessmentType: validatedData.assessmentType,
      targetConcepts: validatedData.targetConcepts,
      questionCount: validatedData.questionCount,
      timeLimit: validatedData.timeLimit,
    };

    const assessment = await generateAssessment(assessmentParams);

    return NextResponse.json({
      success: true,
      assessment,
      metadata: {
        learnerId: learner.id,
        generatedAt: new Date().toISOString(),
        agentUsed: "Assessment Specialist",
      },
    });
  } catch (error) {
    console.error("Error generating assessment:", error);

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
        error: "Failed to generate assessment",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}