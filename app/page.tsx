"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/lib/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Input } from "@/lib/components/ui/input";
import { Badge } from "@/lib/components/ui/badge";

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
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="space-y-4">
          <Badge variant="accent" className="text-lg px-6 py-2 font-heading">
            🧠 AI-POWERED LEARNING
          </Badge>
          <div className="space-y-4">
            <h1 className="text-6xl font-heading tracking-tight text-foreground">
              WHAT DO YOU WANT TO
              <span className="block text-7xl bg-gradient-to-r from-accent to-main bg-clip-text text-transparent">
                LEARN?
              </span>
            </h1>
            <p className="text-xl font-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Enter any topic and our 7 specialized AI agents will create a personalized micro-course
              with concept cards, quizzes, and adaptive learning paths just for you!
            </p>
          </div>
        </div>

        {/* Agent Showcase */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
          {[
            { name: "Course Builder", emoji: "🏗️" },
            { name: "Assessment Specialist", emoji: "📝" },
            { name: "Learning Path Optimizer", emoji: "🛤️" },
            { name: "Difficulty Calibrator", emoji: "⚖️" },
            { name: "Resource Curator", emoji: "📚" },
            { name: "Progress Analytics", emoji: "📊" },
            { name: "Explanation Coach", emoji: "🎯" },
            { name: "Agent Coordinator", emoji: "🤖" },
          ].map((agent) => (
            <Badge key={agent.name} variant="outline" className="p-3 flex flex-col items-center gap-1">
              <span className="text-2xl">{agent.emoji}</span>
              <span className="text-xs font-heading">{agent.name}</span>
            </Badge>
          ))}
        </div>
      </section>

      {/* Course Generation Form */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">START LEARNING NOW</CardTitle>
          <CardDescription className="text-lg">
            Our AI agents will analyze your input and create the perfect learning experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-3">
              <label htmlFor="topic" className="text-lg font-heading block">
                What topic interests you? 🤔
              </label>
              <Input
                id="topic"
                placeholder="e.g., Machine Learning Basics, Photosynthesis, JavaScript Functions..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="text-lg p-4 h-14"
              />
            </div>

            <div className="space-y-3">
              <label htmlFor="emphasis" className="text-lg font-heading block">
                Any specific focus? (optional) 💡
              </label>
              <Input
                id="emphasis"
                placeholder="e.g., real-world examples, practical applications, common mistakes..."
                value={emphasis}
                onChange={(e) => setEmphasis(e.target.value)}
                className="text-lg p-4 h-14"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-3">
                <label className="text-sm font-heading block">TONE 🎭</label>
                <select
                  className="w-full h-12 px-4 rounded-base border-2 border-border bg-background font-base shadow-shadow focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-shadow-hover transition-all"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                >
                  {tones.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-heading block">LEVEL 📈</label>
                <select
                  className="w-full h-12 px-4 rounded-base border-2 border-border bg-background font-base shadow-shadow focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-shadow-hover transition-all"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as typeof level)}
                >
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-heading block">CONCEPTS 🎯</label>
                <Input
                  type="number"
                  min={2}
                  max={6}
                  value={conceptCount}
                  onChange={(e) => setConceptCount(Number(e.target.value))}
                  className="h-12"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-heading block">QUIZ Q&apos;S ❓</label>
                <Input
                  type="number"
                  min={3}
                  max={6}
                  value={quizCount}
                  onChange={(e) => setQuizCount(Number(e.target.value))}
                  className="h-12"
                />
              </div>
            </div>

            {error && (
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="p-4">
                  <p className="text-destructive font-base">⚠️ {error}</p>
                </CardContent>
              </Card>
            )}

            {info && (
              <Card className="border-accent bg-accent/10">
                <CardContent className="p-4">
                  <p className="text-accent-foreground font-base">ℹ️ {info}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
              <Button
                type="submit"
                disabled={busy || !topic.trim()}
                size="lg"
                className="w-full sm:w-auto text-lg px-8 py-4 h-auto"
              >
                {busy ? "🤖 AI AGENTS WORKING..." : "🚀 GENERATE MY COURSE!"}
              </Button>

              <div className="flex gap-3">
                <Button asChild variant="outline" size="lg">
                  <Link href="/learn">📚 Go to Learn</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/progress">📊 View Progress</Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
