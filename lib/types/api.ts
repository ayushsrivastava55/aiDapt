// Shared TypeScript types for API responses

export interface ConceptCard {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  realWorldExample: string;
  reflectionPrompt: string;
}

export interface QuizOption {
  id: string;
  label: string;
  text: string;
}

export interface QuizItem {
  id: string;
  question: string;
  difficulty: "easy" | "medium" | "hard";
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export type ActivityContent =
  | {
      kind: "concept-card";
      version: string;
      topic: string;
      card: ConceptCard;
    }
  | {
      kind: "quiz-item";
      version: string;
      topic: string;
      quizItem: QuizItem;
    };

export interface Activity {
  id: string;
  name: string;
  description: string | null;
  type: string;
  content: ActivityContent;
  metadata: Record<string, any> | null;
  order: number | null;
  unit: {
    id: string;
    name: string;
    description: string | null;
    order: number | null;
  };
  skill: {
    id: string;
    name: string;
    description: string | null;
    level: number;
  };
}

export interface NextActivityResponse {
  activity: Activity | null;
  reason?: string;
  scheduling?: {
    level: number;
    nextReviewAt: string;
    lastAttemptAt: string;
    isDue: boolean;
    reason: string;
  };
  skillState?: {
    id: string;
    status: "not_started" | "in_progress" | "mastered" | "review_needed";
    progress: number;
    masteryScore: number | null;
  };
}

export interface Explanation {
  version: string;
  topic: string;
  learnerLevel: string;
  tone: string;
  style: string;
  question?: string;
  submittedAnswer?: string;
  summary: string;
  goals: string[];
  sections: Array<{
    id: string;
    title: string;
    explanation: string;
    practicePrompt: string;
  }>;
  keyPoints: string[];
  analogies: Array<{
    id: string;
    title: string;
    explanation: string;
  }>;
  misconceptionsAddressed: Array<{
    id: string;
    misconception: string;
    correction: string;
  }>;
  followUpQuestions: string[];
  actionableStrategies: string[];
  encouragement: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  requirement: any;
  xpReward: number;
  rarity: string;
}

export interface AchievementProgress {
  achievement: Achievement;
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
}

export interface LearnerStats {
  totalXp: number;
  level: number;
  achievementCount: number;
  rank: number;
  nextLevelXp: number;
}

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
    trend: "increasing" | "decreasing" | "stable";
    comparison: number;
  };
  recommendedFocus: string[];
}

export interface StudyRoom {
  id: string;
  name: string;
  description: string;
  hostName: string;
  participants: any[];
  avgAttentionScore: number;
  requireCamera: number;
  requireMicrophone: number;
  attentionThreshold: number;
}

export interface ParticipantSession {
  id: string;
  roomId: string;
  learnerId: string;
  role: string;
  attentionScore: number;
  focusTime: number;
  totalTime: number;
  cameraEnabled: number;
  microphoneEnabled: number;
}

export interface AttentionAnalysis {
  currentScore: number;
  averageScore: number;
  focusPercentage: number;
  totalSessionTime: number;
  recommendations: string[];
  alertTriggered: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  details?: any;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}
