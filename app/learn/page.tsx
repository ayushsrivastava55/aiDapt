"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Types for API responses

type ConceptCard = {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  realWorldExample: string;
  reflectionPrompt: string;
};

type QuizOption = {
  id: string;
  label: string;
  text: string;
};

type QuizItem = {
  id: string;
  question: string;
  difficulty: "easy" | "medium" | "hard";
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
};

type ActivityContent =
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

type NextActivityResponse = {
  activity: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    content: ActivityContent;
    metadata: Record<string, any> | null;
    order: number | null;
    unit: { id: string; name: string; description: string | null; order: number | null };
    skill: { id: string; name: string; description: string | null; level: number };
  } | null;
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
};

type Explanation = {
  version: string;
  topic: string;
  learnerLevel: string;
  tone: string;
  style: string;
  question?: string;
  submittedAnswer?: string;
  summary: string;
  goals: string[];
  sections: { id: string; title: string; explanation: string; practicePrompt: string }[];
  keyPoints: string[];
  analogies: { id: string; title: string; explanation: string }[];
  misconceptionsAddressed: { id: string; misconception: string; correction: string }[];
  followUpQuestions: string[];
  actionableStrategies: string[];
  encouragement: string;
};

export default function LearnPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NextActivityResponse | null>(null);

  // Quiz state
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitBusy, setSubmitBusy] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean } | null>(null);

  // Explanation state
  const [explaining, setExplaining] = useState<boolean>(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);
    setExplainError(null);
    setSelectedOptionId(null);
    setSubmitted(false);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/next-activity", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load next activity (${res.status})`);
      }
      const json: NextActivityResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load next activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNext();
  }, [fetchNext]);

  const activity = data?.activity ?? null;
  const content = activity?.content;

  const isQuiz = content?.kind === "quiz-item";
  const isConcept = content?.kind === "concept-card";

  const selectedOption = useMemo(() => {
    if (!isQuiz || !content || !selectedOptionId) return null;
    return content.quizItem.options.find((o) => o.id === selectedOptionId) ?? null;
  }, [content, isQuiz, selectedOptionId]);

  const correctOptionId = isQuiz && content ? content.quizItem.correctOptionId : null;
  const isCorrectSelection = isQuiz && selectedOptionId ? selectedOptionId === correctOptionId : false;

  const handleSubmitAttempt = useCallback(async () => {
    if (!activity) return;

    setSubmitBusy(true);
    setError(null);

    try {
      const payload: any = {
        activityId: activity.id,
        status: "completed",
      };

      if (isQuiz && content) {
        const score = selectedOptionId && selectedOptionId === content.quizItem.correctOptionId ? 1 : 0;
        payload.score = score;
        payload.maxScore = 1;
        payload.success = score === 1;
        payload.response = { selectedOptionId };
        payload.feedback = score === 1 ? { message: "Correct" } : { message: "Incorrect" };
      } else if (isConcept) {
        payload.score = 1;
        payload.maxScore = 1;
        payload.success = true;
        payload.response = { acknowledged: true };
        payload.feedback = { message: "Marked as learned" };
      }

      const res = await fetch("/api/submit-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to submit attempt: ${res.status} ${text}`);
      }

      const json = await res.json();
      setSubmitted(true);
      setSubmitResult({ success: Boolean(json?.success) });
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit attempt");
    } finally {
      setSubmitBusy(false);
    }
  }, [activity, content, isConcept, isQuiz, selectedOptionId]);

  const handleExplain = useCallback(async () => {
    if (!activity || !content) return;
    setExplaining(true);
    setExplainError(null);

    try {
      const body: any = { activityId: activity.id };

      if (content.kind === "quiz-item") {
        body.question = content.quizItem.question;
        if (selectedOption) {
          body.submittedAnswer = `${selectedOption.label}. ${selectedOption.text}`;
        }
        const correct = content.quizItem.options.find((o) => o.id === content.quizItem.correctOptionId);
        if (correct) {
          body.correctAnswer = `${correct.label}. ${correct.text}`;
        }
      } else if (content.kind === "concept-card") {
        body.topic = content.card.title;
      }

      const res = await fetch("/api/agent-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to get explanation: ${res.status} ${text}`);
      }

      const json = await res.json();
      setExplanation(json.explanation as Explanation);
    } catch (e: any) {
      setExplainError(e?.message ?? "Failed to get explanation");
    } finally {
      setExplaining(false);
    }
  }, [activity, content, selectedOption]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Learn</h2>
          <p className="text-sm text-muted-foreground">Work through concept cards and quizzes. Your progress is saved to your anonymous session.</p>
        </div>
        <Link className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium" href="/progress">
          View Progress
        </Link>
      </div>

      {loading && (
        <div className="rounded-xl border border-border/60 bg-surface/70 p-6">Loading next activity…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50/70 p-4 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && data?.activity === null && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface/70 p-6">
          <p className="text-sm text-muted-foreground">No activities found. Generate a course to get started.</p>
          <div>
            <Link className="rounded-md bg-foreground/10 px-3 py-2 text-sm" href="/">Create a course</Link>
          </div>
        </div>
      )}

      {!loading && !error && activity && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{activity.skill.name} • Unit</div>
              <h3 className="text-xl font-semibold tracking-tight">{activity.unit.name}</h3>
            </div>
            {data?.scheduling && (
              <div className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                Level {data.scheduling.level} • Next review {new Date(data.scheduling.nextReviewAt).toLocaleString()}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/40 bg-background/40 p-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {isConcept ? "Concept" : isQuiz ? "Quiz" : "Activity"}
            </div>

            {isConcept && content && (
              <div className="space-y-3">
                <h4 className="text-lg font-semibold">{content.card.title}</h4>
                <p className="text-sm text-muted-foreground">{content.card.summary}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {content.card.keyPoints.map((kp) => (
                    <li key={kp}>{kp}</li>
                  ))}
                </ul>
                <div className="rounded-md border border-border/50 bg-surface/80 p-3 text-sm">
                  <div className="font-medium">Real-world example</div>
                  <p className="text-muted-foreground">{content.card.realWorldExample}</p>
                </div>
                <div className="text-sm italic text-muted-foreground">Reflection: {content.card.reflectionPrompt}</div>
              </div>
            )}

            {isQuiz && content && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{content.quizItem.question}</p>
                <div className="grid gap-2">
                  {content.quizItem.options.map((opt) => (
                    <label key={opt.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${selectedOptionId === opt.id ? "border-foreground/60 bg-foreground/5" : "border-border/50 hover:bg-foreground/5"}`}>
                      <input
                        type="radio"
                        name="quiz-option"
                        className="mt-0.5"
                        checked={selectedOptionId === opt.id}
                        onChange={() => setSelectedOptionId(opt.id)}
                        disabled={submitBusy || submitted}
                      />
                      <span className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{opt.label}.</span> {opt.text}
                      </span>
                    </label>
                  ))}
                </div>
                {submitted && (
                  <div className={`rounded-md border p-3 text-sm ${submitResult?.success ? "border-green-300 bg-green-50/70 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200" : "border-red-300 bg-red-50/70 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"}`}>
                    {submitResult?.success ? "Correct!" : (
                      <span>
                        Incorrect. {content.quizItem.explanation && (
                          <>
                            Explanation: <span className="text-foreground/90">{content.quizItem.explanation}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!submitted && (
              <button
                className="rounded-md bg-foreground/10 px-4 py-2 text-sm font-medium disabled:opacity-50"
                onClick={handleSubmitAttempt}
                disabled={submitBusy || (isQuiz && !selectedOptionId)}
              >
                {isConcept ? (submitBusy ? "Marking…" : "Mark as learned") : submitBusy ? "Submitting…" : "Submit answer"}
              </button>
            )}
            {submitted && (
              <button
                className="rounded-md bg-foreground/10 px-4 py-2 text-sm font-medium"
                onClick={fetchNext}
              >
                Next activity
              </button>
            )}

            <button
              className="rounded-md border border-border/60 px-4 py-2 text-sm"
              onClick={handleExplain}
              disabled={explaining}
            >
              {explaining ? "Generating explanation…" : "Need an explanation"}
            </button>
          </div>

          {explainError && (
            <div className="rounded-md border border-red-300 bg-red-50/70 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {explainError}
            </div>
          )}

          {explanation && (
            <div className="space-y-3 rounded-lg border border-border/40 bg-background/40 p-4">
              <div className="text-sm font-medium">Tailored Explanation</div>
              <p className="text-sm text-muted-foreground">{explanation.summary}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {explanation.keyPoints.map((kp) => (
                  <li key={kp}>{kp}</li>
                ))}
              </ul>
              <div className="grid gap-3 md:grid-cols-2">
                {explanation.sections.map((s) => (
                  <div key={s.id} className="rounded-md border border-border/40 bg-surface/80 p-3">
                    <div className="text-sm font-semibold">{s.title}</div>
                    <p className="text-sm text-muted-foreground">{s.explanation}</p>
                    <div className="mt-2 text-xs italic text-muted-foreground">Try: {s.practicePrompt}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
