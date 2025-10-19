"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { LoadingPage } from "@/lib/components/ui/loading";
import { ErrorState } from "@/lib/components/ui/error-state";
import { EmptyState } from "@/lib/components/ui/empty-state";
import { useSession } from "@/lib/hooks/use-session";
import { LearningInsights } from "@/lib/types/api";
import Link from "next/link";

export default function ProgressPage() {
  const { learnerId, isLoading: sessionLoading, error: sessionError } = useSession();
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (learnerId && !sessionLoading) {
      fetchAnalytics();
    }
  }, [learnerId, sessionLoading]);

  const fetchAnalytics = async () => {
    if (!learnerId) return;

    try {
      setLoading(true);
      setError(null);
      const [insightsRes, recommendationsRes] = await Promise.all([
        fetch(`/api/analytics?learnerId=${learnerId}&action=insights&days=30`),
        fetch(`/api/analytics?learnerId=${learnerId}&action=recommendations`),
      ]);

      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data.insights);
      }

      if (recommendationsRes.ok) {
        const data = await recommendationsRes.json();
        setRecommendations(data.recommendations);
      }
    } catch (err) {
      setError("Failed to load analytics data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "mastered": return "default";
      case "in_progress": return "secondary";
      case "review_needed": return "destructive";
      case "forgotten": return "destructive";
      case "strengthening": return "accent";
      default: return "outline";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing": return "📈";
      case "decreasing": return "📉";
      default: return "➡️";
    }
  };

  if (sessionLoading || loading) {
    return (
      <LoadingPage
        title="📊 LOADING PROGRESS"
        description="Analyzing your learning data"
        icon="📈"
      />
    );
  }

  if (sessionError) {
    return (
      <ErrorState
        title="⚠️ SESSION ERROR"
        message={sessionError}
        actionLabel="🔄 RELOAD"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (!learnerId) {
    return (
      <EmptyState
        title="🔐 NO SESSION"
        description="Please refresh the page to create a session."
        icon="🔑"
        actionLabel="🔄 RELOAD PAGE"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (error || !insights) {
    return (
      <ErrorState
        title="⚠️ NO DATA AVAILABLE"
        message={error || "No learning data found. Start learning to see your progress!"}
        icon="📊"
        actionLabel="🔄 TRY AGAIN"
        onAction={fetchAnalytics}
        secondaryActionLabel="🚀 START LEARNING"
        secondaryActionHref="/"
      />
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center space-y-4">
        <Badge variant="accent" className="text-lg px-6 py-2 font-heading">
          📊 LEARNING ANALYTICS
        </Badge>
        <h1 className="text-6xl font-heading tracking-tight">
          YOUR LEARNING
          <span className="block text-7xl bg-gradient-to-r from-accent to-main bg-clip-text text-transparent">
            JOURNEY
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Track your progress, celebrate achievements, and optimize your learning strategy
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="neo-hover">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-4xl">⏱️</CardTitle>
            <CardDescription>Total Study Time</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{formatTime(insights.totalStudyTime)}</div>
          </CardContent>
        </Card>

        <Card className="neo-hover">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-4xl">✅</CardTitle>
            <CardDescription>Activities Completed</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{insights.activitiesCompleted}</div>
          </CardContent>
        </Card>

        <Card className="neo-hover">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-4xl">🔥</CardTitle>
            <CardDescription>Current Streak</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{insights.currentStreak} days</div>
          </CardContent>
        </Card>

        <Card className="neo-hover">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-4xl">⭐</CardTitle>
            <CardDescription>XP Earned</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{insights.xpEarned.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📈 Learning Velocity
              <span className="text-2xl">{getTrendIcon(insights.learningVelocity.trend)}</span>
            </CardTitle>
            <CardDescription>Your learning pace over time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Current Rate:</span>
              <span className="font-heading">{insights.learningVelocity.current.toFixed(1)} activities/day</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Trend:</span>
              <Badge variant={insights.learningVelocity.trend === "increasing" ? "default" :
                             insights.learningVelocity.trend === "decreasing" ? "destructive" : "secondary"}>
                {insights.learningVelocity.trend.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Change:</span>
              <span className={`font-heading ${insights.learningVelocity.comparison > 0 ? "text-green-600" :
                                                 insights.learningVelocity.comparison < 0 ? "text-red-600" : ""}`}>
                {insights.learningVelocity.comparison > 0 ? "+" : ""}{insights.learningVelocity.comparison.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🎯 Performance Summary</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Average Score:</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-secondary rounded-full">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${insights.averageScore * 100}%` }}
                  ></div>
                </div>
                <span className="font-heading">{(insights.averageScore * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Skills in Progress:</span>
              <span className="font-heading">
                {insights.skillsProgress.filter(s => s.status === "in_progress").length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Skills Mastered:</span>
              <span className="font-heading">
                {insights.skillsProgress.filter(s => s.status === "mastered").length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-base">Need Review:</span>
              <span className="font-heading text-accent">
                {insights.recommendedFocus.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {insights.skillsProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🧠 Skills Progress</CardTitle>
            <CardDescription>Your progress across different skills</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.skillsProgress.map((skill) => (
                <div key={skill.skillId} className="p-4 border-2 border-border rounded-base shadow-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-heading text-sm truncate">{skill.skillName}</span>
                    <Badge variant={getStatusBadgeVariant(skill.status)} className="text-xs">
                      {skill.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-2 bg-secondary rounded-full">
                      <div
                        className="h-full bg-main rounded-full transition-all duration-300"
                        style={{ width: `${skill.progress * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{(skill.progress * 100).toFixed(0)}% complete</span>
                      {skill.lastReviewedAt && (
                        <span>
                          Last: {new Date(skill.lastReviewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>💡 Personalized Recommendations</CardTitle>
            <CardDescription>AI-powered suggestions to optimize your learning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-4 bg-accent/10 border-l-4 border-accent rounded-r-base">
                  <p className="font-base">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <Button asChild size="lg">
          <Link href="/learn">📚 CONTINUE LEARNING</Link>
        </Button>
      </div>
    </div>
  );
}
