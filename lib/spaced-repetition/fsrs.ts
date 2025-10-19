import { z } from "zod";

export const FSRSParametersSchema = z.object({
  requestRetention: z.number().min(0.1).max(1).default(0.9),
  maximumInterval: z.number().min(1).default(36500),
  w: z.array(z.number()).length(19).default([
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
    1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407,
    2.9466, 0.5034, 0.6567
  ]),
});

export const ReviewGradeSchema = z.enum(["again", "hard", "good", "easy"]);

export const CardStateSchema = z.object({
  stability: z.number().min(0.1),
  difficulty: z.number().min(1).max(10),
  retrievability: z.number().min(0).max(1),
  lapses: z.number().int().min(0),
  reps: z.number().int().min(0),
  lastReviewedAt: z.date().optional(),
  nextReviewAt: z.date().optional(),
});

export type FSRSParameters = z.infer<typeof FSRSParametersSchema>;
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;
export type CardState = z.infer<typeof CardStateSchema>;

export class FSRS {
  private params: FSRSParameters;

  constructor(params?: Partial<FSRSParameters>) {
    this.params = FSRSParametersSchema.parse(params || {});
  }

  createInitialCard(): CardState {
    return {
      stability: 2.5,
      difficulty: 0,
      retrievability: 0.9,
      lapses: 0,
      reps: 0,
    };
  }

  review(card: CardState, grade: ReviewGrade, reviewTime?: Date): CardState {
    const now = reviewTime || new Date();
    const retrievability = this.calculateRetrievability(card, now);

    const newCard: CardState = {
      ...card,
      retrievability,
      lastReviewedAt: now,
      reps: card.reps + 1,
    };

    switch (grade) {
      case "again":
        return this.handleAgain(newCard);
      case "hard":
        return this.handleHard(newCard);
      case "good":
        return this.handleGood(newCard);
      case "easy":
        return this.handleEasy(newCard);
    }
  }

  private calculateRetrievability(card: CardState, reviewTime: Date): number {
    if (!card.lastReviewedAt) return card.retrievability;

    const daysSinceReview = Math.max(0,
      (reviewTime.getTime() - card.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Math.pow(0.9, daysSinceReview / card.stability);
  }

  private handleAgain(card: CardState): CardState {
    const newStability = this.params.w[11] * Math.pow(card.difficulty, -this.params.w[12]) *
                        (Math.pow(card.stability + 1, this.params.w[13]) - 1) *
                        Math.exp((1 - card.retrievability) * this.params.w[14]);

    const newDifficulty = Math.min(10, Math.max(1, card.difficulty + this.params.w[6]));

    return {
      ...card,
      stability: Math.max(0.1, newStability),
      difficulty: newDifficulty,
      lapses: card.lapses + 1,
      nextReviewAt: this.calculateNextReview(newStability),
    };
  }

  private handleHard(card: CardState): CardState {
    const newStability = card.stability * (1 + Math.exp(this.params.w[15]) *
                        (11 - card.difficulty) * Math.pow(card.stability, -this.params.w[16]) *
                        (Math.exp((1 - card.retrievability) * this.params.w[17]) - 1));

    const newDifficulty = Math.min(10, Math.max(1, card.difficulty + this.params.w[7]));

    return {
      ...card,
      stability: Math.max(0.1, newStability),
      difficulty: newDifficulty,
      nextReviewAt: this.calculateNextReview(newStability),
    };
  }

  private handleGood(card: CardState): CardState {
    const newStability = card.reps === 0
      ? this.params.w[0] + this.params.w[1] * card.difficulty
      : card.stability * (1 + Math.exp(this.params.w[8]) *
        (11 - card.difficulty) * Math.pow(card.stability, -this.params.w[9]) *
        (Math.exp((1 - card.retrievability) * this.params.w[10]) - 1));

    const newDifficulty = Math.min(10, Math.max(1,
      card.difficulty - this.params.w[6] * (card.reps === 0 ? 1 : 0.5)
    ));

    return {
      ...card,
      stability: Math.max(0.1, newStability),
      difficulty: newDifficulty,
      nextReviewAt: this.calculateNextReview(newStability),
    };
  }

  private handleEasy(card: CardState): CardState {
    const newStability = card.reps === 0
      ? this.params.w[2] + this.params.w[3] * card.difficulty
      : card.stability * (1 + Math.exp(this.params.w[8]) *
        (11 - card.difficulty) * Math.pow(card.stability, -this.params.w[9]) *
        (Math.exp((1 - card.retrievability) * this.params.w[10]) - 1) * this.params.w[18]);

    const newDifficulty = Math.min(10, Math.max(1, card.difficulty - this.params.w[6]));

    return {
      ...card,
      stability: Math.max(0.1, newStability),
      difficulty: newDifficulty,
      nextReviewAt: this.calculateNextReview(newStability),
    };
  }

  private calculateNextReview(stability: number): Date {
    const interval = Math.min(
      this.params.maximumInterval,
      stability * Math.log(this.params.requestRetention) / Math.log(0.9)
    );

    return new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
  }

  getDueCards(cards: CardState[], now?: Date): CardState[] {
    const currentTime = now || new Date();
    return cards.filter(card =>
      !card.nextReviewAt || card.nextReviewAt <= currentTime
    );
  }

  getStudyQueue(cards: CardState[], limit = 20): CardState[] {
    const dueCards = this.getDueCards(cards);
    const newCards = cards.filter(card => card.reps === 0);

    const sortedDue = dueCards.sort((a, b) => {
      if (!a.nextReviewAt && !b.nextReviewAt) return 0;
      if (!a.nextReviewAt) return -1;
      if (!b.nextReviewAt) return 1;
      return a.nextReviewAt.getTime() - b.nextReviewAt.getTime();
    });

    const combined = [...sortedDue, ...newCards.slice(0, Math.max(0, limit - sortedDue.length))];
    return combined.slice(0, limit);
  }
}