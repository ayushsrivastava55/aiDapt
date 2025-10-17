/**
 * Spaced Repetition System (SRS) utilities
 * 
 * Implements a 4-level SRS system (0-3) with cooldown periods:
 * - Level 0: New/Failed - No cooldown, immediate review
 * - Level 1: Learning - 1 hour cooldown
 * - Level 2: Practiced - 1 day cooldown
 * - Level 3: Mastered - 7 days cooldown
 */

export type SRSLevel = 0 | 1 | 2 | 3;

export type ActivitySRSState = {
  level: SRSLevel;
  nextReviewAt: string; // ISO timestamp
  lastAttemptAt: string; // ISO timestamp
  consecutiveCorrect: number;
};

export type SkillSRSMetadata = {
  activityStates?: Record<string, ActivitySRSState>;
};

// Cooldown periods in milliseconds
const COOLDOWN_PERIODS: Record<SRSLevel, number> = {
  0: 0, // No cooldown for new/failed items
  1: 60 * 60 * 1000, // 1 hour
  2: 24 * 60 * 60 * 1000, // 1 day
  3: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Calculate next review time based on current level
 */
export function calculateNextReview(level: SRSLevel, fromDate: Date = new Date()): Date {
  const cooldownMs = COOLDOWN_PERIODS[level];
  return new Date(fromDate.getTime() + cooldownMs);
}

/**
 * Determine if an activity is due for review
 */
export function isDueForReview(nextReviewAt: string | Date, now: Date = new Date()): boolean {
  const reviewDate = typeof nextReviewAt === 'string' ? new Date(nextReviewAt) : nextReviewAt;
  return reviewDate <= now;
}

/**
 * Increment SRS level on successful attempt (max level 3)
 */
export function incrementLevel(currentLevel: SRSLevel): SRSLevel {
  return Math.min(3, currentLevel + 1) as SRSLevel;
}

/**
 * Demote SRS level on failed attempt (min level 0)
 */
export function demoteLevel(currentLevel: SRSLevel): SRSLevel {
  return Math.max(0, currentLevel - 1) as SRSLevel;
}

/**
 * Update activity SRS state after an attempt
 */
export function updateActivityState(
  currentState: ActivitySRSState | undefined,
  isCorrect: boolean,
  attemptDate: Date = new Date()
): ActivitySRSState {
  const currentLevel = currentState?.level ?? 0;
  const consecutiveCorrect = isCorrect 
    ? (currentState?.consecutiveCorrect ?? 0) + 1 
    : 0;
  
  let newLevel: SRSLevel;
  
  if (isCorrect) {
    // Increment level on success, but require 2 consecutive correct for level 0->1
    if (currentLevel === 0 && consecutiveCorrect < 2) {
      newLevel = 0;
    } else {
      newLevel = incrementLevel(currentLevel);
    }
  } else {
    // Demote on failure
    newLevel = demoteLevel(currentLevel);
  }
  
  return {
    level: newLevel,
    nextReviewAt: calculateNextReview(newLevel, attemptDate).toISOString(),
    lastAttemptAt: attemptDate.toISOString(),
    consecutiveCorrect,
  };
}

/**
 * Get or initialize activity SRS state
 */
export function getActivityState(
  metadata: SkillSRSMetadata | undefined,
  activityId: string
): ActivitySRSState {
  return metadata?.activityStates?.[activityId] ?? {
    level: 0,
    nextReviewAt: new Date().toISOString(),
    lastAttemptAt: new Date(0).toISOString(),
    consecutiveCorrect: 0,
  };
}

/**
 * Update skill metadata with new activity state
 */
export function updateSkillMetadata(
  currentMetadata: SkillSRSMetadata | undefined,
  activityId: string,
  newState: ActivitySRSState
): SkillSRSMetadata {
  return {
    ...currentMetadata,
    activityStates: {
      ...(currentMetadata?.activityStates ?? {}),
      [activityId]: newState,
    },
  };
}

/**
 * Calculate success threshold for an activity
 * @param maxScore Maximum possible score
 * @returns Minimum score needed to be considered successful (70%)
 */
export function calculateSuccessThreshold(maxScore: number): number {
  return maxScore * 0.7;
}

/**
 * Determine if an attempt was successful
 */
export function isAttemptSuccessful(score: number, maxScore: number): boolean {
  if (maxScore <= 0) return false;
  return score >= calculateSuccessThreshold(maxScore);
}
