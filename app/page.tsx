"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const tones = ["encouraging", "neutral", "direct"] as const;
const levels = ["beginner", "intermediate", "advanced", "mixed"] as const;

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [tone, setTone] = useState<(typeof tones)[number]>("encouraging");
  const [level, setLevel] = useState<(typeof levels)[number]>("mixed");
  const [conceptCount, setConceptCount] = useState<number>(3);
  const [quizCount, setQuizCount] = useState<number>(4);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          emphasis: emphasis.trim() || undefined,
          tone,
          learnerLevel: level,
          conceptCardCount: conceptCount,
          quizItemCount: quizCount,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to generate course: ${res.status} ${txt}`);
      }

      const json = await res.json();
      if (json?.isExisting) {
        setInfo("Existing course found. Redirecting to Learn…");
      }
      router.push("/learn");
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate course");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-4">
        <span className="inline-flex w-fit items-center rounded-full border border-border/60 bg-surface/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Microcourse Builder
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What do you want to learn?</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Enter a topic and we will generate a short course with concept cards and a quiz. Your progress is tracked anonymously in this browser.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border/60 bg-surface/70 p-6">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <label htmlFor="topic" className="text-sm font-medium">
              Topic
            </label>
            <input
              id="topic"
              className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/50"
              placeholder="e.g. Basics of photosynthesis"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="emphasis" className="text-sm font-medium">
              Emphasis (optional)
            </label>
            <input
              id="emphasis"
              className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-foreground/50"
              placeholder="e.g. real-world examples or common pitfalls"
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tone</label>
              <select
                className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
              >
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Learner level</label>
              <select
                className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
              >
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Concept cards</label>
                <input
                  type="number"
                  min={2}
                  max={6}
                  value={conceptCount}
                  onChange={(e) => setConceptCount(Number(e.target.value))}
                  className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Quiz items</label>
                <input
                  type="number"
                  min={3}
                  max={6}
                  value={quizCount}
                  onChange={(e) => setQuizCount(Number(e.target.value))}
                  className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50/70 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md border border-blue-300 bg-blue-50/70 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
              {info}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !topic.trim()}
              className="rounded-md bg-foreground/10 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate course"}
            </button>
            <Link className="rounded-md border border-border/60 px-4 py-2 text-sm" href="/learn">
              Go to Learn
            </Link>
            <Link className="rounded-md border border-border/60 px-4 py-2 text-sm" href="/progress">
              View Progress
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
