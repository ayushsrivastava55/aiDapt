import { NextRequest, NextResponse } from "next/server";
import { AchievementsService } from "@/lib/services/achievements";
import { z } from "zod";

const CheckAchievementsSchema = z.object({
  learnerId: z.string().uuid(),
});

const AwardXpSchema = z.object({
  learnerId: z.string().uuid(),
  xpAmount: z.number().min(1),
});

const CreateAchievementSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  icon: z.string().max(100).optional(),
  type: z.string(),
  requirement: z.any(),
  xpReward: z.number().min(0).default(0),
  rarity: z.string().default("common"),
});

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const body = await request.json();

    const service = new AchievementsService();

    switch (action) {
      case "check":
        const { learnerId } = CheckAchievementsSchema.parse(body);
        const newUnlocks = await service.checkAndUnlockAchievements(learnerId);
        return NextResponse.json({
          success: true,
          newUnlocks,
          message: `${newUnlocks.length} new achievements unlocked`,
        });

      case "award-xp":
        const xpData = AwardXpSchema.parse(body);
        await service.awardXp(xpData.learnerId, xpData.xpAmount);
        return NextResponse.json({
          success: true,
          message: `Awarded ${xpData.xpAmount} XP`,
        });

      case "create":
        const achievementData = CreateAchievementSchema.parse(body);
        const achievement = await service.createCustomAchievement(achievementData);
        return NextResponse.json({
          success: true,
          achievement,
          message: "Custom achievement created successfully",
        });

      case "initialize":
        await service.initializeDefaultAchievements();
        return NextResponse.json({
          success: true,
          message: "Default achievements initialized",
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in achievements API:", error);
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
    const action = searchParams.get("action");
    const learnerId = searchParams.get("learnerId");

    const service = new AchievementsService();

    switch (action) {
      case "progress":
        if (!learnerId) {
          return NextResponse.json(
            { success: false, error: "learnerId is required" },
            { status: 400 }
          );
        }
        const progress = await service.getAchievementProgress(learnerId);
        return NextResponse.json({
          success: true,
          progress,
        });

      case "unlocked":
        if (!learnerId) {
          return NextResponse.json(
            { success: false, error: "learnerId is required" },
            { status: 400 }
          );
        }
        const unlocked = await service.getUnlockedAchievements(learnerId);
        return NextResponse.json({
          success: true,
          unlocked,
        });

      case "stats":
        if (!learnerId) {
          return NextResponse.json(
            { success: false, error: "learnerId is required" },
            { status: 400 }
          );
        }
        const stats = await service.getLearnerStats(learnerId);
        return NextResponse.json({
          success: true,
          stats,
        });

      case "leaderboard":
        const limit = parseInt(searchParams.get("limit") || "50");
        const leaderboard = await service.getLeaderboard(limit);
        return NextResponse.json({
          success: true,
          leaderboard,
        });

      case "recent":
        if (!learnerId) {
          return NextResponse.json(
            { success: false, error: "learnerId is required" },
            { status: 400 }
          );
        }
        const recentLimit = parseInt(searchParams.get("limit") || "5");
        const recent = await service.getRecentUnlocks(learnerId, recentLimit);
        return NextResponse.json({
          success: true,
          recent,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error fetching achievements data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}