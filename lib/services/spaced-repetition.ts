import { getDb } from "@/lib/db";

const db = getDb();
import { skillStates, type SkillState, type NewSkillState } from "@/lib/db/schema";
import { FSRS, type CardState, type ReviewGrade } from "@/lib/spaced-repetition/fsrs";
import { eq, and, lte } from "drizzle-orm";

export class SpacedRepetitionService {
  private fsrs: FSRS;

  constructor() {
    this.fsrs = new FSRS();
  }

  async initializeSkillState(learnerId: string, skillId: string): Promise<SkillState> {
    const initialCard = this.fsrs.createInitialCard();

    const newSkillState: NewSkillState = {
      learnerId,
      skillId,
      status: "not_started",
      progress: 0,
      stability: initialCard.stability,
      difficulty: initialCard.difficulty,
      retrievability: initialCard.retrievability,
      lapses: initialCard.lapses,
      reps: initialCard.reps,
    };

    const [skillState] = await db.insert(skillStates).values(newSkillState).returning();
    return skillState;
  }

  async updateSkillAfterReview(
    learnerId: string,
    skillId: string,
    grade: ReviewGrade,
    score?: number
  ): Promise<SkillState> {
    const [skillState] = await db
      .select()
      .from(skillStates)
      .where(and(
        eq(skillStates.learnerId, learnerId),
        eq(skillStates.skillId, skillId)
      ));

    if (!skillState) {
      throw new Error("Skill state not found");
    }

    const currentCard: CardState = {
      stability: skillState.stability || 2.5,
      difficulty: skillState.difficulty || 0,
      retrievability: skillState.retrievability || 0.9,
      lapses: skillState.lapses || 0,
      reps: skillState.reps || 0,
      lastReviewedAt: skillState.lastReviewedAt || undefined,
      nextReviewAt: skillState.nextReviewAt || undefined,
    };

    const updatedCard = this.fsrs.review(currentCard, grade);

    const newStatus = this.determineSkillStatus(updatedCard, score);
    const newProgress = this.calculateProgress(updatedCard, score);

    const [updated] = await db
      .update(skillStates)
      .set({
        status: newStatus,
        progress: newProgress,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        retrievability: updatedCard.retrievability,
        lapses: updatedCard.lapses,
        reps: updatedCard.reps,
        lastReviewedAt: updatedCard.lastReviewedAt,
        nextReviewAt: updatedCard.nextReviewAt,
        masteryScore: score,
        updatedAt: new Date(),
      })
      .where(and(
        eq(skillStates.learnerId, learnerId),
        eq(skillStates.skillId, skillId)
      ))
      .returning();

    return updated;
  }

  async getDueSkills(learnerId: string): Promise<SkillState[]> {
    const now = new Date();

    return await db
      .select()
      .from(skillStates)
      .where(and(
        eq(skillStates.learnerId, learnerId),
        lte(skillStates.nextReviewAt, now)
      ));
  }

  async getStudyQueue(learnerId: string, limit = 10): Promise<SkillState[]> {
    const allSkills = await db
      .select()
      .from(skillStates)
      .where(eq(skillStates.learnerId, learnerId));

    const cards: CardState[] = allSkills.map(skill => ({
      stability: skill.stability || 2.5,
      difficulty: skill.difficulty || 0,
      retrievability: skill.retrievability || 0.9,
      lapses: skill.lapses || 0,
      reps: skill.reps || 0,
      lastReviewedAt: skill.lastReviewedAt || undefined,
      nextReviewAt: skill.nextReviewAt || undefined,
    }));

    const studyQueue = this.fsrs.getStudyQueue(cards, limit);

    return allSkills.filter((_: any, index: number) =>
      studyQueue.includes(cards[index])
    );
  }

  private determineSkillStatus(card: CardState, score?: number): "not_started" | "in_progress" | "mastered" | "review_needed" | "forgotten" | "strengthening" {
    if (card.reps === 0) return "not_started";

    if (score !== undefined) {
      if (score >= 0.9 && card.retrievability >= 0.8 && card.reps >= 3) {
        return "mastered";
      }
      if (score < 0.5 || card.retrievability < 0.4) {
        return card.lapses > 2 ? "forgotten" : "review_needed";
      }
    }

    if (card.retrievability < 0.7 && card.reps >= 2) {
      return "review_needed";
    }

    if (card.lapses > 0 && card.retrievability > 0.6) {
      return "strengthening";
    }

    return "in_progress";
  }

  private calculateProgress(card: CardState, score?: number): number {
    let baseProgress = Math.min(0.9, card.retrievability * 0.7 + (card.reps / 10) * 0.3);

    if (score !== undefined) {
      baseProgress = baseProgress * 0.7 + score * 0.3;
    }

    if (card.lapses > 0) {
      baseProgress *= Math.max(0.5, 1 - (card.lapses * 0.1));
    }

    return Math.max(0, Math.min(1, baseProgress));
  }

  async getOptimalStudyTime(learnerId: string): Promise<{
    recommendedDuration: number;
    prioritySkills: string[];
    studyPlan: Array<{ skillId: string; estimatedTime: number; priority: 'high' | 'medium' | 'low' }>;
  }> {
    const dueSkills = await this.getDueSkills(learnerId);
    const studyQueue = await this.getStudyQueue(learnerId, 15);

    const prioritySkills = dueSkills
      .filter((skill: any) => skill.retrievability && skill.retrievability < 0.7)
      .map(skill => skill.skillId);

    const studyPlan = studyQueue.map(skill => {
      const isHighPriority = prioritySkills.includes(skill.skillId);
      const isOverdue = skill.nextReviewAt && skill.nextReviewAt < new Date();

      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (isHighPriority || isOverdue) priority = 'high';
      else if (skill.retrievability && skill.retrievability > 0.8) priority = 'low';

      const estimatedTime = this.estimateStudyTime(skill);

      return {
        skillId: skill.skillId,
        estimatedTime,
        priority,
      };
    });

    const totalTime = studyPlan.reduce((sum, item) => sum + item.estimatedTime, 0);
    const recommendedDuration = Math.min(60, Math.max(15, totalTime));

    return {
      recommendedDuration,
      prioritySkills,
      studyPlan,
    };
  }

  private estimateStudyTime(skill: SkillState): number {
    const baseTime = 5;
    const difficultyMultiplier = (skill.difficulty || 0) / 10 + 1;
    const retrievabilityMultiplier = skill.retrievability ? (1 - skill.retrievability + 0.5) : 1;
    const lapsesMultiplier = Math.min(2, 1 + (skill.lapses || 0) * 0.2);

    return Math.round(baseTime * difficultyMultiplier * retrievabilityMultiplier * lapsesMultiplier);
  }
}