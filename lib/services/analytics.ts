import { getDb } from "@/lib/db";

const db = getDb();
import {
  learningAnalytics,
  skillStates,
  attempts,
  studySessions,
  learners,
  type LearningAnalytics,
  type NewLearningAnalytics
} from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql, count, avg, sum } from "drizzle-orm";

export interface LearningInsights {
  totalStudyTime: number;
  activitiesCompleted: number;
  averageScore: number;
  currentStreak: number;
  xpEarned: number;
  skillsProgress: Array<{
    skillId: string;
    skillName: string;
    progress: number;
    status: string;
    lastReviewedAt?: Date;
  }>;
  weeklyProgress: Array<{
    date: string;
    timeSpent: number;
    activitiesCompleted: number;
    xpEarned: number;
  }>;
  learningVelocity: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    comparison: number;
  };
  recommendedFocus: string[];
}

export class AnalyticsService {
  async recordStudySession(
    learnerId: string,
    sessionType: string,
    duration: number,
    activitiesCompleted: number,
    xpEarned: number,
    metadata?: any
  ) {
    await db.insert(studySessions).values({
      learnerId,
      type: sessionType,
      duration,
      activitiesCompleted,
      xpEarned,
      metadata,
      endedAt: new Date(),
    });

    await this.updateDailyAnalytics(learnerId, duration, activitiesCompleted, xpEarned);
  }

  async updateDailyAnalytics(
    learnerId: string,
    timeSpent: number,
    activitiesCompleted: number,
    xpEarned: number
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(learningAnalytics)
      .where(and(
        eq(learningAnalytics.learnerId, learnerId),
        eq(learningAnalytics.date, today)
      ))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      await db
        .update(learningAnalytics)
        .set({
          timeSpent: (current.timeSpent || 0) + timeSpent,
          activitiesCompleted: (current.activitiesCompleted || 0) + activitiesCompleted,
          xpEarned: (current.xpEarned || 0) + xpEarned,
        })
        .where(eq(learningAnalytics.id, current.id));
    } else {
      await db.insert(learningAnalytics).values({
        learnerId,
        date: today,
        timeSpent,
        activitiesCompleted,
        xpEarned,
      });
    }
  }

  async getLearningInsights(learnerId: string, days = 30): Promise<LearningInsights> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [analytics, skillsData, learnerData] = await Promise.all([
      this.getAnalyticsData(learnerId, startDate, endDate),
      this.getSkillsProgress(learnerId),
      this.getLearnerStats(learnerId),
    ]);

    const weeklyData = await this.getWeeklyProgress(learnerId);
    const learningVelocity = this.calculateLearningVelocity(analytics);
    const recommendedFocus = this.getRecommendedFocus(skillsData);

    const totalStats = analytics.reduce(
      (acc: any, day: any) => ({
        timeSpent: acc.timeSpent + (day.timeSpent || 0),
        activitiesCompleted: acc.activitiesCompleted + (day.activitiesCompleted || 0),
        xpEarned: acc.xpEarned + (day.xpEarned || 0),
        scoreSum: acc.scoreSum + (day.averageScore || 0),
        scoreDays: acc.scoreDays + (day.averageScore ? 1 : 0),
      }),
      { timeSpent: 0, activitiesCompleted: 0, xpEarned: 0, scoreSum: 0, scoreDays: 0 }
    );

    return {
      totalStudyTime: totalStats.timeSpent,
      activitiesCompleted: totalStats.activitiesCompleted,
      averageScore: totalStats.scoreDays > 0 ? totalStats.scoreSum / totalStats.scoreDays : 0,
      currentStreak: learnerData.streakCount || 0,
      xpEarned: totalStats.xpEarned,
      skillsProgress: skillsData,
      weeklyProgress: weeklyData,
      learningVelocity,
      recommendedFocus,
    };
  }

  private async getAnalyticsData(learnerId: string, startDate: Date, endDate: Date) {
    return await db
      .select()
      .from(learningAnalytics)
      .where(and(
        eq(learningAnalytics.learnerId, learnerId),
        gte(learningAnalytics.date, startDate),
        lte(learningAnalytics.date, endDate)
      ))
      .orderBy(desc(learningAnalytics.date));
  }

  private async getSkillsProgress(learnerId: string) {
    const skills = await db
      .select({
        skillId: skillStates.skillId,
        skillName: sql<string>`'Skill ' || ${skillStates.skillId}`,
        progress: skillStates.progress,
        status: skillStates.status,
        lastReviewedAt: skillStates.lastReviewedAt,
      })
      .from(skillStates)
      .where(eq(skillStates.learnerId, learnerId));

    return skills.map((skill: any) => ({
      ...skill,
      lastReviewedAt: skill.lastReviewedAt || undefined,
    }));
  }

  private async getLearnerStats(learnerId: string) {
    const [learner] = await db
      .select()
      .from(learners)
      .where(eq(learners.id, learnerId));

    return learner;
  }

  private async getWeeklyProgress(learnerId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7 * 4);

    const data = await db
      .select({
        date: learningAnalytics.date,
        timeSpent: learningAnalytics.timeSpent,
        activitiesCompleted: learningAnalytics.activitiesCompleted,
        xpEarned: learningAnalytics.xpEarned,
      })
      .from(learningAnalytics)
      .where(and(
        eq(learningAnalytics.learnerId, learnerId),
        gte(learningAnalytics.date, weekStart)
      ))
      .orderBy(learningAnalytics.date);

    return data.map((d: any) => ({
      date: d.date.toISOString().split('T')[0],
      timeSpent: d.timeSpent || 0,
      activitiesCompleted: d.activitiesCompleted || 0,
      xpEarned: d.xpEarned || 0,
    }));
  }

  private calculateLearningVelocity(analytics: LearningAnalytics[]) {
    if (analytics.length < 7) {
      return { current: 0, trend: 'stable' as const, comparison: 0 };
    }

    const recent = analytics.slice(0, 7);
    const previous = analytics.slice(7, 14);

    const recentAvg = recent.reduce((sum, d) => sum + (d.activitiesCompleted || 0), 0) / 7;
    const previousAvg = previous.reduce((sum, d) => sum + (d.activitiesCompleted || 0), 0) / 7;

    const change = recentAvg - previousAvg;
    const changePercent = previousAvg > 0 ? (change / previousAvg) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 10) {
      trend = changePercent > 0 ? 'increasing' : 'decreasing';
    }

    return {
      current: recentAvg,
      trend,
      comparison: changePercent,
    };
  }

  private getRecommendedFocus(skillsData: any[]): string[] {
    const needsReview = skillsData
      .filter(skill =>
        skill.status === 'review_needed' ||
        skill.status === 'forgotten' ||
        (skill.progress < 0.5 && skill.status === 'in_progress')
      )
      .sort((a: any, b: any) => a.progress - b.progress)
      .slice(0, 3)
      .map(skill => skill.skillId);

    return needsReview;
  }

  async getPerformanceMetrics(learnerId: string, skillId?: string) {
    const baseQuery = db
      .select({
        avgScore: avg(attempts.score),
        totalAttempts: count(attempts.id),
        completionRate: sql<number>`
          COUNT(CASE WHEN ${attempts.status} = 'completed' THEN 1 END)::float /
          COUNT(*)::float * 100
        `,
        averageTime: sql<number>`
          AVG(EXTRACT(EPOCH FROM (${attempts.completedAt} - ${attempts.startedAt})) / 60)
        `,
      })
      .from(attempts)
      .where(eq(attempts.learnerId, learnerId));

    const result = await baseQuery;
    return result;
  }

  async generatePersonalizedRecommendations(learnerId: string) {
    const insights = await this.getLearningInsights(learnerId);
    const recommendations: string[] = [];

    if (insights.currentStreak === 0) {
      recommendations.push("Start a new learning streak! Even 10 minutes daily makes a difference.");
    } else if (insights.currentStreak >= 7) {
      recommendations.push(`Amazing ${insights.currentStreak}-day streak! Keep up the momentum.`);
    }

    if (insights.averageScore < 0.7) {
      recommendations.push("Focus on reviewing fundamentals to improve your understanding.");
    }

    if (insights.learningVelocity.trend === 'decreasing') {
      recommendations.push("Your learning pace has slowed. Try shorter, more frequent sessions.");
    }

    if (insights.recommendedFocus.length > 0) {
      recommendations.push(`Priority skills need attention: ${insights.recommendedFocus.length} skills require review.`);
    }

    const lowProgressSkills = insights.skillsProgress.filter(s => s.progress < 0.3).length;
    if (lowProgressSkills > 0) {
      recommendations.push(`${lowProgressSkills} skills need more practice to build confidence.`);
    }

    return recommendations;
  }
}