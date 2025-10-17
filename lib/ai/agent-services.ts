import { Agent, run } from "@openai/agents";
import { z } from "zod";

import { ensureOpenAIConfigured } from "@/lib/ai/provider";

const DEFAULT_AGENT_MODEL = "gpt-4.1-mini";
const DEFAULT_MODEL_SETTINGS = {
  temperature: 0.15,
  topP: 0.5,
  maxTokens: 2000,
} as const;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MICROCOURSE_MAX_TURNS = 4;
const EXPLANATION_MAX_TURNS = 4;

type LearnerLevel = "beginner" | "intermediate" | "advanced" | "mixed";
type TonePreference = "encouraging" | "neutral" | "direct";
type StylePreference = "concise" | "detailed" | "storytelling" | "visual";

type NormalizedMicrocourseRequest = {
  topic: string;
  learnerLevel: LearnerLevel;
  tone: TonePreference;
  conceptCardCount: number;
  quizItemCount: number;
  objectives: string[];
  focusAreas: string[];
  prerequisites: string[];
};

type NormalizedExplanationRequest = {
  topic: string;
  learnerLevel: LearnerLevel;
  tone: TonePreference;
  preferredStyle: StylePreference;
  question?: string;
  submittedAnswer?: string;
  correctAnswer?: string;
  misconceptions: string[];
  strengths: string[];
  struggles: string[];
  goals: string[];
  contextNotes: string[];
};

const conceptCardSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()).min(3).max(6),
  realWorldExample: z.string(),
  reflectionPrompt: z.string(),
});

const quizOptionSchema = z.object({
  label: z.string(),
  text: z.string(),
});

const quizItemSchema = z.object({
  question: z.string(),
  difficulty: z.string(),
  options: z.array(quizOptionSchema).min(3).max(5),
  correctAnswer: z.string(),
  explanation: z.string(),
});

const microcourseOutputSchema = z.object({
  overview: z.string(),
  conceptCards: z.array(conceptCardSchema).min(1),
  quizItems: z.array(quizItemSchema).min(1),
  recommendedDurationMinutes: z.union([z.number(), z.string()]).optional(),
  closingSummary: z.string(),
});

type MicrocourseStructuredOutput = z.infer<typeof microcourseOutputSchema>;

const explanationSectionSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  practicePrompt: z.string(),
});

const analogySchema = z.object({
  title: z.string(),
  explanation: z.string(),
});

const misconceptionSchema = z.object({
  misconception: z.string(),
  correction: z.string(),
});

const explanationOutputSchema = z.object({
  tone: z.string(),
  communicationStyle: z.string(),
  summary: z.string(),
  sections: z.array(explanationSectionSchema).min(1),
  keyPoints: z.array(z.string()).min(2),
  analogies: z.array(analogySchema).min(1),
  misconceptionsAddressed: z.array(misconceptionSchema).default([]),
  followUpQuestions: z.array(z.string()).min(1),
  actionableStrategies: z.array(z.string()).min(1),
  encouragement: z.string(),
});

type ExplanationStructuredOutput = z.infer<typeof explanationOutputSchema>;

export type AgentGenerationMetadata<TRequest = Record<string, unknown>> = {
  model: string;
  temperature: number;
  topP?: number;
  attempts: number;
  generatedAt: string;
  request: TRequest;
};

export type MicrocourseConceptCard = {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  realWorldExample: string;
  reflectionPrompt: string;
};

export type MicrocourseQuizOption = {
  id: string;
  label: string;
  text: string;
};

export type MicrocourseQuizItem = {
  id: string;
  question: string;
  difficulty: "easy" | "medium" | "hard";
  options: MicrocourseQuizOption[];
  correctOptionId: string;
  explanation: string;
};

export type GenerateMicrocourseParams = {
  topic: string;
  learnerLevel?: LearnerLevel;
  objectives?: string[];
  focusAreas?: string[];
  prerequisites?: string[];
  conceptCardCount?: number;
  quizItemCount?: number;
  tone?: TonePreference;
  emphasis?: string;
};

export type MicrocourseGenerationMetadata = AgentGenerationMetadata<{
  topic: string;
  learnerLevel: LearnerLevel;
  objectives: string[];
  focusAreas: string[];
  prerequisites: string[];
  conceptCardCount: number;
  quizItemCount: number;
  tone: TonePreference;
}>;

export type MicrocourseActivityContent = {
  version: "microcourse.v1";
  topic: string;
  learnerLevel: LearnerLevel;
  tone: TonePreference;
  objectives: string[];
  focusAreas: string[];
  prerequisites: string[];
  overview: string;
  conceptCards: MicrocourseConceptCard[];
  quiz: MicrocourseQuizItem[];
  closingSummary: string;
  recommendedDurationMinutes: number;
  metadata: MicrocourseGenerationMetadata;
};

export type ExplanationSection = {
  id: string;
  title: string;
  explanation: string;
  practicePrompt: string;
};

export type ExplanationAnalogy = {
  id: string;
  title: string;
  explanation: string;
};

export type ExplanationMisconception = {
  id: string;
  misconception: string;
  correction: string;
};

export type GenerateExplanationParams = {
  topic: string;
  learnerLevel?: LearnerLevel;
  question?: string;
  submittedAnswer?: string;
  correctAnswer?: string;
  misconceptions?: string[];
  strengths?: string[];
  struggles?: string[];
  goals?: string[];
  preferredStyle?: StylePreference;
  tone?: TonePreference;
  contextNotes?: string[];
};

export type ExplanationGenerationMetadata = AgentGenerationMetadata<{
  topic: string;
  learnerLevel: LearnerLevel;
  question?: string;
  submittedAnswer?: string;
  misconceptions: string[];
  strengths: string[];
  struggles: string[];
  goals: string[];
  tone: TonePreference;
  preferredStyle: StylePreference;
  contextNotes: string[];
}>;

export type TailoredExplanationContent = {
  version: "explanation.v1";
  topic: string;
  learnerLevel: LearnerLevel;
  tone: string;
  style: string;
  question?: string;
  submittedAnswer?: string;
  summary: string;
  goals: string[];
  sections: ExplanationSection[];
  keyPoints: string[];
  analogies: ExplanationAnalogy[];
  misconceptionsAddressed: ExplanationMisconception[];
  followUpQuestions: string[];
  actionableStrategies: string[];
  encouragement: string;
  metadata: ExplanationGenerationMetadata;
};

export type AgentCallOptions = {
  signal?: AbortSignal;
  maxAttempts?: number;
};

export class AgentServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AgentServiceError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

type RunAgentRetryOptions = AgentCallOptions & {
  taskName: string;
  maxTurns: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const dedupeNormalizedList = (items?: readonly string[]): string[] => {
  if (!items || items.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
};

const sanitizeSentence = (value: string) => value.replace(/\s+/g, " ").trim();

const sanitizeParagraph = (value: string) => value.replace(/\s+/g, " ").trim();

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const formatList = (label: string, values: string[]): string | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  return `${label}:\n${values.map((value) => `- ${value}`).join("\n")}`;
};

const buildId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

const normalizeDuration = (
  value: MicrocourseStructuredOutput["recommendedDurationMinutes"],
  conceptCards: number,
  quizItems: number,
) => {
  const fallback = Math.max(10, conceptCards * 6 + quizItems * 3);

  if (value === undefined || value === null) {
    return fallback;
  }

  const numeric = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.round(numeric), 10, 90);
};

const normalizeOptionLabel = (label: string, fallbackIndex: number) => {
  const cleaned = label.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cleaned.length === 1) {
    return cleaned;
  }

  const fallbackCharCode = "A".charCodeAt(0) + fallbackIndex;
  return String.fromCharCode(fallbackCharCode);
};

const resolveCorrectOptionId = (answer: string, options: MicrocourseQuizOption[]): string => {
  const trimmed = answer.trim();
  const labelFragment = trimmed.replace(/[^A-Za-z]/g, "");
  const normalizedLabel = labelFragment ? labelFragment.slice(-1).toUpperCase() : undefined;

  if (normalizedLabel) {
    const labelMatch = options.find((option) => option.label.toUpperCase() === normalizedLabel);
    if (labelMatch) {
      return labelMatch.id;
    }
  }

  const uppercaseAnswer = trimmed.toUpperCase();
  const directMatch = options.find((option) => option.label.toUpperCase() === uppercaseAnswer);
  if (directMatch) {
    return directMatch.id;
  }

  const suffixMatch = options.find((option) => uppercaseAnswer.endsWith(option.label.toUpperCase()));
  if (suffixMatch) {
    return suffixMatch.id;
  }

  const textMatch = options.find((option) => option.text.toLowerCase() === trimmed.toLowerCase());
  if (textMatch) {
    return textMatch.id;
  }

  return options[0]?.id ?? "";
};

const normalizeDifficulty = (value: string): "easy" | "medium" | "hard" => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("easy")) {
    return "easy";
  }

  if (normalized.includes("hard") || normalized.includes("challenging")) {
    return "hard";
  }

  return "medium";
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeMicrocourseRequest = (
  params: GenerateMicrocourseParams,
): NormalizedMicrocourseRequest => {
  const topic = sanitizeSentence(params.topic ?? "");
  if (!topic) {
    throw new AgentServiceError("A topic is required to generate a microcourse");
  }

  const learnerLevel = params.learnerLevel ?? "mixed";
  const tone = params.tone ?? "encouraging";
  const objectives = dedupeNormalizedList(params.objectives);
  const focusAreas = dedupeNormalizedList(
    params.focusAreas ?? (params.emphasis ? [params.emphasis] : undefined),
  );
  const prerequisites = dedupeNormalizedList(params.prerequisites);

  const conceptCardCount = clamp(params.conceptCardCount ?? 3, 2, 6);
  const quizItemCount = clamp(params.quizItemCount ?? 4, 3, 6);

  return {
    topic,
    learnerLevel,
    tone,
    conceptCardCount,
    quizItemCount,
    objectives,
    focusAreas,
    prerequisites,
  };
};

const normalizeExplanationRequest = (
  params: GenerateExplanationParams,
): NormalizedExplanationRequest => {
  const topic = sanitizeSentence(params.topic ?? "");
  if (!topic) {
    throw new AgentServiceError("A topic is required to generate an explanation");
  }

  const learnerLevel = params.learnerLevel ?? "mixed";
  const tone = params.tone ?? "encouraging";
  const preferredStyle = params.preferredStyle ?? "detailed";

  return {
    topic,
    learnerLevel,
    tone,
    preferredStyle,
    question: params.question?.trim() || undefined,
    submittedAnswer: params.submittedAnswer?.trim() || undefined,
    correctAnswer: params.correctAnswer?.trim() || undefined,
    misconceptions: dedupeNormalizedList(params.misconceptions),
    strengths: dedupeNormalizedList(params.strengths),
    struggles: dedupeNormalizedList(params.struggles),
    goals: dedupeNormalizedList(params.goals),
    contextNotes: dedupeNormalizedList(params.contextNotes),
  };
};

const buildMicrocourseInstructions = (request: NormalizedMicrocourseRequest) => {
  const lines = [
    "You are an instructional designer who creates cohesive microcourses composed of concept cards and quiz items.",
    "Respond only with a JSON object that matches the required schema. Do not add markdown fences or commentary.",
    "Top-level keys must include: overview, conceptCards, quizItems, recommendedDurationMinutes, and closingSummary.",
    `Adopt an ${request.tone} tone that matches a ${request.learnerLevel} learner.`,
    `Produce exactly ${request.conceptCardCount} items in conceptCards and ${request.quizItemCount} items in quizItems.`,
    "Each concept card should introduce one core idea, provide 3-6 keyPoints, include a vivid realWorldExample, and end with a reflectionPrompt.",
    "Key points must be concise, learner-friendly sentences (≤ 22 words).",
    "Quiz items should reinforce the concepts just introduced. Provide 3-5 options labelled with single-letter identifiers.",
    "The correctAnswer must match the label of the correct option (e.g. 'B').",
    "Use recommendedDurationMinutes to provide a realistic estimate between 10 and 90 minutes for an independent learner.",
    "Use closingSummary to recap the learning journey and encourage next steps.",
  ];

  if (request.focusAreas.length > 0) {
    lines.push(`Emphasize these focus areas: ${request.focusAreas.join(", ")}.`);
  }

  if (request.prerequisites.length > 0) {
    lines.push(`Connect new ideas to this prior knowledge: ${request.prerequisites.join(", ")}.`);
  }

  if (request.objectives.length > 0) {
    lines.push(
      `Ensure every concept and quiz item supports these objectives: ${request.objectives.join(", ")}.`,
    );
  }

  return lines.join("\n");
};

const buildExplanationInstructions = (request: NormalizedExplanationRequest) => {
  const lines = [
    "You are a patient tutor who crafts tailored explanations that close knowledge gaps and motivate the learner.",
    "Respond only with a JSON object that matches the required schema. Do not include markdown or extra narration.",
    `Use a ${request.tone} tone and communicate in a ${request.preferredStyle} style while keeping language clear and supportive.`,
    "Each section should cover one logical step, ending with a practicePrompt that encourages the learner to apply the idea.",
    "Key points must be short reminders (≤ 18 words).",
    "Analogies should be vivid, real-world comparisons that reinforce the concept.",
    "Actionable strategies should be specific behaviours or study approaches the learner can try immediately.",
  ];

  if (request.misconceptions.length > 0) {
    lines.push(
      `Directly address and correct these misconceptions when relevant: ${request.misconceptions.join(", ")}.`,
    );
  }

  if (request.goals.length > 0) {
    lines.push(`Tie explanations back to these learner goals: ${request.goals.join(", ")}.`);
  }

  return lines.join("\n");
};

const buildMicrocoursePrompt = (request: NormalizedMicrocourseRequest) => {
  const segments: Array<string | undefined> = [
    `Topic: ${request.topic}`,
    `Learner level: ${capitalize(request.learnerLevel)}`,
    `Tone: ${request.tone}`,
    formatList("Learning objectives", request.objectives),
    formatList("Focus areas", request.focusAreas),
    formatList("Prerequisite knowledge", request.prerequisites),
    `Concept cards requested: ${request.conceptCardCount}`,
    `Quiz items requested: ${request.quizItemCount}`,
  ];

  return segments.filter(Boolean).join("\n\n");
};

const buildExplanationPrompt = (request: NormalizedExplanationRequest) => {
  const segments: Array<string | undefined> = [
    `Topic: ${request.topic}`,
    `Learner level: ${capitalize(request.learnerLevel)}`,
    request.question ? `Learner question: ${request.question}` : undefined,
    request.submittedAnswer ? `Learner submitted answer: ${request.submittedAnswer}` : undefined,
    request.correctAnswer ? `Expected answer: ${request.correctAnswer}` : undefined,
    formatList("Learner strengths", request.strengths),
    formatList("Learner challenges", request.struggles),
    formatList("Misconceptions to address", request.misconceptions),
    formatList("Learner goals", request.goals),
    formatList("Context notes", request.contextNotes),
    `Tone: ${request.tone}`,
    `Preferred style: ${request.preferredStyle}`,
  ];

  return segments.filter(Boolean).join("\n\n");
};

const normalizeMicrocourseOutput = (
  output: MicrocourseStructuredOutput,
  request: NormalizedMicrocourseRequest,
  attempts: number,
): MicrocourseActivityContent => {
  const conceptCards = output.conceptCards.slice(0, request.conceptCardCount).map((card, index) => ({
    id: buildId("concept-card", index),
    title: sanitizeSentence(card.title),
    summary: sanitizeParagraph(card.summary),
    keyPoints: dedupeNormalizedList(card.keyPoints).map(sanitizeSentence),
    realWorldExample: sanitizeParagraph(card.realWorldExample),
    reflectionPrompt: sanitizeSentence(card.reflectionPrompt),
  }));

  if (conceptCards.length === 0) {
    throw new AgentServiceError("Microcourse agent did not return any concept cards");
  }

  const quiz = output.quizItems.slice(0, request.quizItemCount).map((item, index) => {
    const quizId = buildId("quiz-item", index);
    const options = item.options.slice(0, 5).map((option, optionIndex) => {
      const label = normalizeOptionLabel(option.label, optionIndex);
      return {
        id: `${quizId}-option-${label}`,
        label,
        text: sanitizeSentence(option.text),
      } satisfies MicrocourseQuizOption;
    });

    if (options.length < 3) {
      throw new AgentServiceError("Microcourse agent returned a quiz item without enough options");
    }

    const correctOptionId = resolveCorrectOptionId(item.correctAnswer, options);
    if (!correctOptionId) {
      throw new AgentServiceError("Unable to resolve the correct answer for a quiz item");
    }

    return {
      id: quizId,
      question: sanitizeParagraph(item.question),
      difficulty: normalizeDifficulty(item.difficulty),
      options,
      correctOptionId,
      explanation: sanitizeParagraph(item.explanation),
    } satisfies MicrocourseQuizItem;
  });

  if (quiz.length === 0) {
    throw new AgentServiceError("Microcourse agent did not return any quiz items");
  }

  const metadata: MicrocourseGenerationMetadata = {
    model: DEFAULT_AGENT_MODEL,
    temperature: DEFAULT_MODEL_SETTINGS.temperature,
    topP: DEFAULT_MODEL_SETTINGS.topP,
    attempts,
    generatedAt: new Date().toISOString(),
    request,
  };

  return {
    version: "microcourse.v1",
    topic: request.topic,
    learnerLevel: request.learnerLevel,
    tone: request.tone,
    objectives: request.objectives,
    focusAreas: request.focusAreas,
    prerequisites: request.prerequisites,
    overview: sanitizeParagraph(output.overview),
    conceptCards,
    quiz,
    closingSummary: sanitizeParagraph(output.closingSummary),
    recommendedDurationMinutes: normalizeDuration(
      output.recommendedDurationMinutes,
      conceptCards.length,
      quiz.length,
    ),
    metadata,
  };
};

const normalizeExplanationOutput = (
  output: ExplanationStructuredOutput,
  request: NormalizedExplanationRequest,
  attempts: number,
): TailoredExplanationContent => {
  const sections = output.sections.map((section, index) => ({
    id: buildId("explanation-section", index),
    title: sanitizeSentence(section.title),
    explanation: sanitizeParagraph(section.explanation),
    practicePrompt: sanitizeSentence(section.practicePrompt),
  }));

  const analogies = output.analogies.map((analogy, index) => ({
    id: buildId("analogy", index),
    title: sanitizeSentence(analogy.title),
    explanation: sanitizeParagraph(analogy.explanation),
  }));

  const misconceptions = (output.misconceptionsAddressed ?? []).map((item, index) => ({
    id: buildId("misconception", index),
    misconception: sanitizeSentence(item.misconception),
    correction: sanitizeParagraph(item.correction),
  }));

  const metadata: ExplanationGenerationMetadata = {
    model: DEFAULT_AGENT_MODEL,
    temperature: DEFAULT_MODEL_SETTINGS.temperature,
    topP: DEFAULT_MODEL_SETTINGS.topP,
    attempts,
    generatedAt: new Date().toISOString(),
    request,
  };

  return {
    version: "explanation.v1",
    topic: request.topic,
    learnerLevel: request.learnerLevel,
    tone: sanitizeSentence(output.tone),
    style: sanitizeSentence(output.communicationStyle),
    question: request.question,
    submittedAnswer: request.submittedAnswer,
    summary: sanitizeParagraph(output.summary),
    goals: request.goals,
    sections,
    keyPoints: dedupeNormalizedList(output.keyPoints).map(sanitizeSentence),
    analogies,
    misconceptionsAddressed: misconceptions,
    followUpQuestions: dedupeNormalizedList(output.followUpQuestions).map(sanitizeSentence),
    actionableStrategies: dedupeNormalizedList(output.actionableStrategies).map(sanitizeSentence),
    encouragement: sanitizeParagraph(output.encouragement),
    metadata,
  };
};

const runAgentWithRetry = async <TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string,
  { signal, maxAttempts = DEFAULT_MAX_ATTEMPTS, taskName, maxTurns }: RunAgentRetryOptions,
) => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    if (signal?.aborted) {
      throw new AgentServiceError(`${taskName} run was aborted`);
    }

    try {
      const result = await run(agent, input, { signal, maxTurns });
      return {
        result,
        attempts: attempt + 1,
      } as const;
    } catch (error) {
      lastError = error;
      attempt += 1;

      if (attempt >= maxAttempts) {
        throw new AgentServiceError(`${taskName} failed after ${attempt} attempts`, { cause: error });
      }

      await delay(BASE_RETRY_DELAY_MS * attempt);
    }
  }

  throw new AgentServiceError(`${taskName} failed`, { cause: lastError });
};

export const generateMicrocourse = async (
  params: GenerateMicrocourseParams,
  options: AgentCallOptions = {},
): Promise<MicrocourseActivityContent> => {
  ensureOpenAIConfigured();
  const request = normalizeMicrocourseRequest(params);

  const agent = new Agent({
    name: "Microcourse Builder",
    handoffDescription: "Generates concept cards and quiz items for a microcourse",
    instructions: buildMicrocourseInstructions(request),
    outputType: microcourseOutputSchema,
    model: DEFAULT_AGENT_MODEL,
    modelSettings: DEFAULT_MODEL_SETTINGS,
  });

  try {
    const { result, attempts } = await runAgentWithRetry(agent, buildMicrocoursePrompt(request), {
      ...options,
      taskName: "Microcourse generation",
      maxTurns: MICROCOURSE_MAX_TURNS,
    });

    const rawOutput = result.finalOutput;
    if (!rawOutput) {
      throw new AgentServiceError("Microcourse agent did not return structured output");
    }

    const structured = microcourseOutputSchema.parse(rawOutput);
    return normalizeMicrocourseOutput(structured, request, attempts);
  } catch (error) {
    if (error instanceof AgentServiceError) {
      throw error;
    }

    throw new AgentServiceError("Unable to generate microcourse content", { cause: error });
  }
};

export const generateTailoredExplanation = async (
  params: GenerateExplanationParams,
  options: AgentCallOptions = {},
): Promise<TailoredExplanationContent> => {
  ensureOpenAIConfigured();
  const request = normalizeExplanationRequest(params);

  const agent = new Agent({
    name: "Tailored Explanation Coach",
    handoffDescription: "Creates personalized explanations with scaffolded steps",
    instructions: buildExplanationInstructions(request),
    outputType: explanationOutputSchema,
    model: DEFAULT_AGENT_MODEL,
    modelSettings: DEFAULT_MODEL_SETTINGS,
  });

  try {
    const { result, attempts } = await runAgentWithRetry(agent, buildExplanationPrompt(request), {
      ...options,
      taskName: "Tailored explanation generation",
      maxTurns: EXPLANATION_MAX_TURNS,
    });

    const rawOutput = result.finalOutput;
    if (!rawOutput) {
      throw new AgentServiceError("Explanation agent did not return structured output");
    }

    const structured = explanationOutputSchema.parse(rawOutput);
    return normalizeExplanationOutput(structured, request, attempts);
  } catch (error) {
    if (error instanceof AgentServiceError) {
      throw error;
    }

    throw new AgentServiceError("Unable to generate tailored explanation", { cause: error });
  }
};
