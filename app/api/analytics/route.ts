import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/services/analytics";
import { z } from "zod";

const SessionRecordSchema = z.object({
  learnerId: z.string().uuid(),
  sessionType: z.string(),
  duration: z.number().min(0),
  activitiesCompleted: z.number().min(0),
  xpEarned: z.number().min(0),
  metadata: z.any().optional(),
});

const InsightsRequestSchema = z.object({
  learnerId: z.string().uuid(),
  days: z.number().min(1).max(365).default(30),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { learnerId, sessionType, duration, activitiesCompleted, xpEarned, metadata } =
      SessionRecordSchema.parse(body);

    const service = new AnalyticsService();
    await service.recordStudySession(
      learnerId,
      sessionType,
      duration,
      activitiesCompleted,
      xpEarned,
      metadata
    );

    return NextResponse.json({
      success: true,
      message: "Study session recorded successfully",
    });
  } catch (error) {
    console.error("Error recording study session:", error);
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

    const service = new AnalyticsService();

    switch (action) {
      case "insights":
        const days = parseInt(searchParams.get("days") || "30");
        const insights = await service.getLearningInsights(learnerId, days);
        return NextResponse.json({
          success: true,
          insights,
        });

      case "performance":
        const skillId = searchParams.get("skillId") || undefined;
        const performance = await service.getPerformanceMetrics(learnerId, skillId);
        return NextResponse.json({
          success: true,
          performance,
        });

      case "recommendations":
        const recommendations = await service.generatePersonalizedRecommendations(learnerId);
        return NextResponse.json({
          success: true,
          recommendations,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}