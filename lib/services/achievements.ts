import { getDb } from "@/lib/db";

const db = getDb();
import {
  achievements,
  learnerAchievements,
  learners,
  skillStates,
  attempts,
  studySessions,
  type Achievement,
  type NewAchievement,
  type LearnerAchievement,
  type NewLearnerAchievement,
} from "@/lib/db/schema";
import { eq, and, count, sum, avg, gte, desc } from "drizzle-orm";

export interface AchievementProgress {
  achievement: Achievement;
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  requirement: any;
}

export interface LeaderboardEntry {
  learnerId: string;
  learnerName: string;
  totalXp: number;
  achievementCount: number;
  rank: number;
}

export class AchievementsService {
  private defaultAchievements: NewAchievement[] = [
    {
      name: "First Steps",
      description: "Complete your first learning activity",
      icon: "🏃",
      type: "milestone",
      requirement: { activitiesCompleted: 1 },
      xpReward: 100,
      rarity: "common",
    },
    {
      name: "Week Warrior",
      description: "Maintain a 7-day learning streak",
      icon: "🔥",
      type: "streak",
      requirement: { streakDays: 7 },
      xpReward: 500,
      rarity: "uncommon",
    },
    {
      name: "Scholar",
      description: "Complete 50 learning activities",
      icon: "📚",
      type: "milestone",
      requirement: { activitiesCompleted: 50 },
      xpReward: 1000,
      rarity: "rare",
    },
    {
      name: "Perfectionist",
      description: "Achieve 100% score on 10 activities",
      icon: "💯",
      type: "performance",
      requirement: { perfectScores: 10 },
      xpReward: 750,
      rarity: "uncommon",
    },
    {
      name: "Speed Learner",
      description: "Complete 5 activities in one study session",
      icon: "⚡",
      type: "performance",
      requirement: { activitiesPerSession: 5 },
      xpReward: 300,
      rarity: "common",
    },
    {
      name: "Marathon Runner",
      description: "Maintain a 30-day learning streak",
      icon: "🏃‍♂️",
      type: "streak",
      requirement: { streakDays: 30 },
      xpReward: 2000,
      rarity: "epic",
    },
    {
      name: "Master Student",
      description: "Master 5 different skills",
      icon: "🎓",
      type: "mastery",
      requirement: { masteredSkills: 5 },
      xpReward: 1500,
      rarity: "rare",
    },
    {
      name: "Social Butterfly",
      description: "Connect with 10 learning friends",
      icon: "🦋",
      type: "social",
      requirement: { friendsCount: 10 },
      xpReward: 400,
      rarity: "uncommon",
    },
    {
      name: "Study Group Leader",
      description: "Create and maintain a study group for 7 days",
      icon: "👑",
      type: "social",
      requirement: { studyGroupLeaderDays: 7 },
      xpReward: 800,
      rarity: "rare",
    },
    {
      name: "XP Millionaire",
      description: "Earn 10,000 total XP",
      icon: "💎",
      type: "milestone",
      requirement: { totalXp: 10000 },
      xpReward: 2500,
      rarity: "legendary",
    },
  ];

  async initializeDefaultAchievements(): Promise<void> {
    for (const achievement of this.defaultAchievements) {
      try {
        await db.insert(achievements).values(achievement).onConflictDoNothing();
      } catch (error) {
        // Achievement might already exist, continue
      }
    }
  }

  async checkAndUnlockAchievements(learnerId: string): Promise<LearnerAchievement[]> {
    const allAchievements = await db.select().from(achievements);
    const unlockedAchievements = await this.getUnlockedAchievements(learnerId);
    const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievementId));

    const newUnlocks: LearnerAchievement[] = [];

    for (const achievement of allAchievements) {
      if (!unlockedIds.has(achievement.id)) {
        const isEligible = await this.checkAchievementEligibility(learnerId, achievement);
        if (isEligible) {
          const unlock = await this.unlockAchievement(learnerId, achievement.id);
          newUnlocks.push(unlock);

          // Award XP
          await this.awardXp(learnerId, achievement.xpReward || 0);
        }
      }
    }

    return newUnlocks;
  }

  private async checkAchievementEligibility(learnerId: string, achievement: Achievement): Promise<boolean> {
    const req = achievement.requirement as any;

    switch (achievement.type) {
      case "milestone":
        if (req.activitiesCompleted) {
          const [result] = await db
            .select({ count: count() })
            .from(attempts)
            .where(and(
              eq(attempts.learnerId, learnerId),
              eq(attempts.status, "completed")
            ));
          return result.count >= req.activitiesCompleted;
        }

        if (req.totalXp) {
          const [learner] = await db
            .select({ totalXp: learners.totalXp })
            .from(learners)
            .where(eq(learners.id, learnerId));
          return ((learner?.totalXp ?? 0) as number) >= req.totalXp;
        }
        break;

      case "streak":
        if (req.streakDays) {
          const [learner] = await db
            .select({ streakCount: learners.streakCount })
            .from(learners)
            .where(eq(learners.id, learnerId));
          return (learner?.streakCount || 0) >= req.streakDays;
        }
        break;

      case "performance":
        if (req.perfectScores) {
          const [result] = await db
            .select({ count: count() })
            .from(attempts)
            .where(and(
              eq(attempts.learnerId, learnerId),
              eq(attempts.status, "completed"),
              gte(attempts.score, 1.0)
            ));
          return result.count >= req.perfectScores;
        }

        if (req.activitiesPerSession) {
          const [result] = await db
            .select({ maxActivities: count() })
            .from(studySessions)
            .where(eq(studySessions.learnerId, learnerId))
            .groupBy(studySessions.id)
            .orderBy(desc(count()))
            .limit(1);
          return (result?.maxActivities || 0) >= req.activitiesPerSession;
        }
        break;

      case "mastery":
        if (req.masteredSkills) {
          const [result] = await db
            .select({ count: count() })
            .from(skillStates)
            .where(and(
              eq(skillStates.learnerId, learnerId),
              eq(skillStates.status, "mastered")
            ));
          return result.count >= req.masteredSkills;
        }
        break;

      case "social":
        // Social achievements would require integration with social service
        // For now, return false as placeholder
        return false;
    }

    return false;
  }

  async unlockAchievement(learnerId: string, achievementId: string): Promise<LearnerAchievement> {
    const [unlock] = await db.insert(learnerAchievements).values({
      learnerId,
      achievementId,
    }).returning();

    return unlock;
  }

  async awardXp(learnerId: string, xpAmount: number): Promise<void> {
    const [learner] = await db
      .select({ totalXp: learners.totalXp, level: learners.level })
      .from(learners)
      .where(eq(learners.id, learnerId));

    if (!learner) return;

    const newTotalXp = (learner.totalXp || 0) + xpAmount;
    const newLevel = Math.floor(newTotalXp / 1000) + 1; // Level up every 1000 XP

    await db
      .update(learners)
      .set({
        totalXp: newTotalXp,
        level: newLevel,
      })
      .where(eq(learners.id, learnerId));
  }

  async getUnlockedAchievements(learnerId: string): Promise<LearnerAchievement[]> {
    return await db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, learnerId))
      .orderBy(desc(learnerAchievements.unlockedAt));
  }

  async getAchievementProgress(learnerId: string): Promise<AchievementProgress[]> {
    const allAchievements = await db.select().from(achievements);
    const unlockedAchievements = await this.getUnlockedAchievements(learnerId);
    const unlockedMap = new Map(unlockedAchievements.map(ua => [ua.achievementId, ua]));

    const progressList: AchievementProgress[] = [];

    for (const achievement of allAchievements) {
      const unlocked = unlockedMap.get(achievement.id);
      const progress = unlocked ? 1 : await this.calculateProgress(learnerId, achievement);

      progressList.push({
        achievement,
        progress,
        isUnlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt,
        requirement: achievement.requirement,
      });
    }

    return progressList.sort((a, b) => {
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (!a.isUnlocked && b.isUnlocked) return 1;
      return b.progress - a.progress;
    });
  }

  private async calculateProgress(learnerId: string, achievement: Achievement): Promise<number> {
    const req = achievement.requirement as any;

    switch (achievement.type) {
      case "milestone":
        if (req.activitiesCompleted) {
          const [result] = await db
            .select({ count: count() })
            .from(attempts)
            .where(and(
              eq(attempts.learnerId, learnerId),
              eq(attempts.status, "completed")
            ));
          return Math.min(1, result.count / req.activitiesCompleted);
        }

        if (req.totalXp) {
          const [learner] = await db
            .select({ totalXp: learners.totalXp })
            .from(learners)
            .where(eq(learners.id, learnerId));
          return Math.min(1, (learner?.totalXp || 0) / req.totalXp);
        }
        break;

      case "streak":
        if (req.streakDays) {
          const [learner] = await db
            .select({ streakCount: learners.streakCount })
            .from(learners)
            .where(eq(learners.id, learnerId));
          return Math.min(1, (learner?.streakCount || 0) / req.streakDays);
        }
        break;

      case "performance":
        if (req.perfectScores) {
          const [result] = await db
            .select({ count: count() })
            .from(attempts)
            .where(and(
              eq(attempts.learnerId, learnerId),
              eq(attempts.status, "completed"),
              gte(attempts.score, 1.0)
            ));
          return Math.min(1, result.count / req.perfectScores);
        }
        break;

      case "mastery":
        if (req.masteredSkills) {
          const [result] = await db
            .select({ count: count() })
            .from(skillStates)
            .where(and(
              eq(skillStates.learnerId, learnerId),
              eq(skillStates.status, "mastered")
            ));
          return Math.min(1, result.count / req.masteredSkills);
        }
        break;
    }

    return 0;
  }

  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const results = await db
      .select({
        learnerId: learners.id,
        learnerName: learners.displayName,
        totalXp: learners.totalXp,
        achievementCount: count(learnerAchievements.id),
      })
      .from(learners)
      .leftJoin(learnerAchievements, eq(learnerAchievements.learnerId, learners.id))
      .groupBy(learners.id, learners.displayName, learners.totalXp)
      .orderBy(desc(learners.totalXp))
      .limit(limit);

    return results.map((result: any, index: number) => ({
      learnerId: result.learnerId,
      learnerName: result.learnerName || `User ${result.learnerId.slice(0, 8)}`,
      totalXp: result.totalXp || 0,
      achievementCount: result.achievementCount,
      rank: index + 1,
    }));
  }

  async getLearnerStats(learnerId: string): Promise<{
    totalXp: number;
    level: number;
    achievementCount: number;
    rank: number;
    nextLevelXp: number;
  }> {
    const [learner] = await db
      .select({
        totalXp: learners.totalXp,
        level: learners.level,
      })
      .from(learners)
      .where(eq(learners.id, learnerId));

    const [achievementCount] = await db
      .select({ count: count() })
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, learnerId));

    const [rankResult] = await db
      .select({ rank: count() })
      .from(learners)
      .where(gte(learners.totalXp, learner?.totalXp || 0));

    const totalXp = learner?.totalXp || 0;
    const level = learner?.level || 1;
    const nextLevelXp = level * 1000;

    return {
      totalXp,
      level,
      achievementCount: achievementCount.count,
      rank: rankResult.rank,
      nextLevelXp,
    };
  }

  async createCustomAchievement(achievement: NewAchievement): Promise<Achievement> {
    const [created] = await db.insert(achievements).values(achievement).returning();
    return created;
  }

  async getRecentUnlocks(learnerId: string, limit = 5): Promise<Array<{
    achievement: Achievement;
    unlockedAt: Date;
  }>> {
    const recent = await db
      .select({
        achievement: achievements,
        unlockedAt: learnerAchievements.unlockedAt,
      })
      .from(learnerAchievements)
      .innerJoin(achievements, eq(achievements.id, learnerAchievements.achievementId))
      .where(eq(learnerAchievements.learnerId, learnerId))
      .orderBy(desc(learnerAchievements.unlockedAt))
      .limit(limit);

    return recent.map((r: any) => ({
      achievement: r.achievement,
      unlockedAt: r.unlockedAt,
    }));
  }
}