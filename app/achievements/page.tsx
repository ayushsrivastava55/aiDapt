"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { LoadingPage } from "@/lib/components/ui/loading";
import { ErrorState } from "@/lib/components/ui/error-state";
import { useSession } from "@/lib/hooks/use-session";
import { Achievement, AchievementProgress, LearnerStats } from "@/lib/types/api";

export default function AchievementsPage() {
  const { learnerId, isLoading: sessionLoading, error: sessionError } = useSession();
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([]);
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked'>('all');

  useEffect(() => {
    if (learnerId && !sessionLoading) {
      fetchAchievementsData();
    }
  }, [learnerId, sessionLoading]);

  const fetchAchievementsData = async () => {
    if (!learnerId) return;

    try {
      setLoading(true);
      const [progressRes, statsRes, recentRes] = await Promise.all([
        fetch(`/api/achievements?learnerId=${learnerId}&action=progress`),
        fetch(`/api/achievements?learnerId=${learnerId}&action=stats`),
        fetch(`/api/achievements?learnerId=${learnerId}&action=recent&limit=5`),
      ]);

      if (progressRes.ok) {
        const data = await progressRes.json();
        setAchievementProgress(data.progress || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecent(data.recent || []);
      }
    } catch (error) {
      console.error("Failed to fetch achievements data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAchievements = async () => {
    if (!learnerId) return;

    try {
      const response = await fetch("/api/achievements?action=check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.newUnlocks.length > 0) {
          await fetchAchievementsData(); // Refresh data
        }
      }
    } catch (error) {
      console.error("Failed to check achievements:", error);
    }
  };

  const initializeAchievements = async () => {
    try {
      const response = await fetch("/api/achievements?action=initialize", {
        method: "POST",
      });

      if (response.ok) {
        await fetchAchievementsData();
      }
    } catch (error) {
      console.error("Failed to initialize achievements:", error);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-gray-100 text-gray-800 border-gray-300";
      case "uncommon": return "bg-green-100 text-green-800 border-green-300";
      case "rare": return "bg-blue-100 text-blue-800 border-blue-300";
      case "epic": return "bg-purple-100 text-purple-800 border-purple-300";
      case "legendary": return "bg-orange-100 text-orange-800 border-orange-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getRequirementText = (achievement: Achievement) => {
    const req = achievement.requirement;
    switch (achievement.type) {
      case "milestone":
        if (req.activitiesCompleted) return `Complete ${req.activitiesCompleted} activities`;
        if (req.totalXp) return `Earn ${req.totalXp.toLocaleString()} total XP`;
        break;
      case "streak":
        if (req.streakDays) return `Maintain ${req.streakDays}-day streak`;
        break;
      case "performance":
        if (req.perfectScores) return `Achieve ${req.perfectScores} perfect scores`;
        if (req.activitiesPerSession) return `Complete ${req.activitiesPerSession} activities in one session`;
        break;
      case "mastery":
        if (req.masteredSkills) return `Master ${req.masteredSkills} skills`;
        break;
      case "social":
        if (req.friendsCount) return `Connect with ${req.friendsCount} friends`;
        if (req.studyGroupLeaderDays) return `Lead study group for ${req.studyGroupLeaderDays} days`;
        break;
    }
    return "Complete the requirement";
  };

  const filteredAchievements = achievementProgress.filter(ap => {
    switch (activeTab) {
      case 'unlocked': return ap.isUnlocked;
      case 'locked': return !ap.isUnlocked;
      default: return true;
    }
  });

  if (sessionLoading || loading) {
    return (
      <LoadingPage
        title="🏆 LOADING ACHIEVEMENTS"
        description="Preparing your trophy collection"
        icon="🏆"
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
      <ErrorState
        title="🔐 NO SESSION"
        message="Please refresh the page to create a session."
        icon="🔑"
        actionLabel="🔄 RELOAD PAGE"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center space-y-4">
        <Badge variant="accent" className="text-lg px-6 py-2 font-heading">
          🏆 ACHIEVEMENT SYSTEM
        </Badge>
        <h1 className="text-6xl font-heading tracking-tight">
          YOUR
          <span className="block text-7xl bg-gradient-to-r from-accent to-main bg-clip-text text-transparent">
            TROPHIES
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Unlock achievements, earn XP, and celebrate your learning milestones
        </p>
      </section>

      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="neo-hover">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-4xl">⭐</CardTitle>
              <CardDescription>Total XP</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-heading">{stats.totalXp.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="neo-hover">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-4xl">🎯</CardTitle>
              <CardDescription>Level</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-heading">{stats.level}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.nextLevelXp - stats.totalXp} XP to next level
              </div>
            </CardContent>
          </Card>

          <Card className="neo-hover">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-4xl">🏆</CardTitle>
              <CardDescription>Achievements</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-heading">{stats.achievementCount}</div>
            </CardContent>
          </Card>

          <Card className="neo-hover">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-4xl">🥇</CardTitle>
              <CardDescription>Global Rank</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-heading">#{stats.rank}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🎉 Recent Achievements</CardTitle>
            <CardDescription>Your latest unlocks and milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recent.map((item, index) => (
                <div key={index} className="flex-shrink-0 p-4 border-2 border-border rounded-base shadow-shadow w-64">
                  <div className="text-center">
                    <div className="text-4xl mb-2">{item.achievement.icon}</div>
                    <h4 className="font-heading text-sm mb-1">{item.achievement.name}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{item.achievement.description}</p>
                    <Badge className={getRarityColor(item.achievement.rarity)} variant="outline">
                      {item.achievement.rarity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-4 flex-wrap">
        <Button
          onClick={() => setActiveTab('all')}
          variant={activeTab === 'all' ? 'default' : 'outline'}
        >
          🏆 ALL ({achievementProgress.length})
        </Button>
        <Button
          onClick={() => setActiveTab('unlocked')}
          variant={activeTab === 'unlocked' ? 'default' : 'outline'}
        >
          ✅ UNLOCKED ({achievementProgress.filter(ap => ap.isUnlocked).length})
        </Button>
        <Button
          onClick={() => setActiveTab('locked')}
          variant={activeTab === 'locked' ? 'default' : 'outline'}
        >
          🔒 LOCKED ({achievementProgress.filter(ap => !ap.isUnlocked).length})
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((ap) => (
          <Card key={ap.achievement.id} className={`${ap.isUnlocked ? 'neo-hover' : 'opacity-75'}`}>
            <CardHeader className="text-center">
              <div className={`text-6xl mb-4 ${ap.isUnlocked ? '' : 'grayscale'}`}>{ap.achievement.icon}</div>
              <CardTitle className="text-lg">{ap.achievement.name}</CardTitle>
              <CardDescription>{ap.achievement.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <Badge className={getRarityColor(ap.achievement.rarity)} variant="outline">
                  {ap.achievement.rarity.toUpperCase()}
                </Badge>
                <span className="text-sm font-heading text-accent">
                  +{ap.achievement.xpReward} XP
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{getRequirementText(ap.achievement)}</span>
                  <span className="font-heading">
                    {ap.isUnlocked ? "✅" : `${(ap.progress * 100).toFixed(0)}%`}
                  </span>
                </div>
                {!ap.isUnlocked && (
                  <div className="w-full h-2 bg-secondary rounded-full">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-300"
                      style={{ width: `${ap.progress * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {ap.isUnlocked && ap.unlockedAt && (
                <div className="text-xs text-muted-foreground text-center">
                  Unlocked {new Date(ap.unlockedAt).toLocaleDateString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4">
        <div className="flex gap-4 justify-center">
          <Button onClick={checkAchievements} size="lg">
            🔄 CHECK FOR NEW ACHIEVEMENTS
          </Button>
          <Button onClick={initializeAchievements} variant="outline" size="lg">
            🏗️ INITIALIZE ACHIEVEMENTS
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Keep learning to unlock more achievements and climb the leaderboards!
        </p>
      </div>
    </div>
  );
}