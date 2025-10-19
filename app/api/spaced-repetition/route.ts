import { NextRequest, NextResponse } from "next/server";
import { SpacedRepetitionService } from "@/lib/services/spaced-repetition";
import { z } from "zod";

const ReviewRequestSchema = z.object({
  learnerId: z.string().uuid(),
  skillId: z.string().uuid(),
  grade: z.enum(["again", "hard", "good", "easy"]),
  score: z.number().min(0).max(1).optional(),
});

const StudyQueueRequestSchema = z.object({
  learnerId: z.string().uuid(),
  limit: z.number().min(1).max(50).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { learnerId, skillId, grade, score } = ReviewRequestSchema.parse(body);

    const service = new SpacedRepetitionService();
    const updatedSkillState = await service.updateSkillAfterReview(
      learnerId,
      skillId,
      grade,
      score
    );

    return NextResponse.json({
      success: true,
      skillState: updatedSkillState,
      message: "Skill state updated successfully",
    });
  } catch (error) {
    console.error("Error updating skill state:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const learnerId = searchParams.get("learnerId");
    const action = searchParams.get("action");

    if (!learnerId) {
      return NextResponse.json(
        { success: false, error: "learnerId is required" },
        { status: 400 }
      );
    }

    const service = new SpacedRepetitionService();

    switch (action) {
      case "due":
        const dueSkills = await service.getDueSkills(learnerId);
        return NextResponse.json({
          success: true,
          dueSkills,
          count: dueSkills.length,
        });

      case "queue":
        const limit = parseInt(searchParams.get("limit") || "10");
        const studyQueue = await service.getStudyQueue(learnerId, limit);
        return NextResponse.json({
          success: true,
          studyQueue,
          count: studyQueue.length,
        });

      case "study-plan":
        const studyPlan = await service.getOptimalStudyTime(learnerId);
        return NextResponse.json({
          success: true,
          ...studyPlan,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error fetching spaced repetition data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}