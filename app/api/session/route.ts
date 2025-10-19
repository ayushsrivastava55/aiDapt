import { NextResponse } from "next/server";
import { getOrCreateLearner, getCurrentLearner } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/session
 * Returns the current learner session or creates a new one
 */
export async function GET() {
  try {
    const learner = await getOrCreateLearner();

    return NextResponse.json({
      success: true,
      learner: {
        id: learner.id,
        sessionId: learner.sessionId,
        displayName: learner.displayName,
        email: learner.email,
        streakCount: learner.streakCount,
        totalXp: learner.totalXp,
        level: learner.level,
        createdAt: learner.createdAt,
        lastActiveAt: learner.lastActiveAt,
      },
    });
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to get or create session",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/session
 * Clears the current learner session
 */
export async function DELETE() {
  try {
    const { clearLearnerSession } = await import("@/lib/session");
    await clearLearnerSession();

    return NextResponse.json({
      success: true,
      message: "Session cleared",
    });
  } catch (error) {
    console.error("Session clear error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Failed to clear session",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}
