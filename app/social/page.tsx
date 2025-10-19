"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";

interface SocialFeed {
  id: string;
  type: 'progress_share' | 'achievement' | 'challenge_completed' | 'group_activity';
  learnerName: string;
  content: string;
  metadata?: any;
  timestamp: Date;
  reactions?: Record<string, number>;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
  focusSkills: string[];
}

interface Friend {
  id: string;
  name: string;
  status: string;
}

interface PeerChallenge {
  id: string;
  challengerId: string;
  challengeeId: string;
  skillId: string;
  challengeType: string;
  status: string;
  createdAt: Date;
}

export default function SocialPage() {
  const [feed, setFeed] = useState<SocialFeed[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [challenges, setChallenges] = useState<PeerChallenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'challenges' | 'leaderboard'>('feed');

  const mockLearnerId = "550e8400-e29b-41d4-a716-446655440000";

  useEffect(() => {
    fetchSocialData();
  }, []);

  const fetchSocialData = async () => {
    try {
      setLoading(true);
      const [feedRes, friendsRes, groupsRes, challengesRes, leaderboardRes] = await Promise.all([
        fetch(`/api/social?learnerId=${mockLearnerId}&action=feed`),
        fetch(`/api/social?learnerId=${mockLearnerId}&action=friends`),
        fetch(`/api/social?learnerId=${mockLearnerId}&action=groups`),
        fetch(`/api/social?learnerId=${mockLearnerId}&action=challenges`),
        fetch(`/api/social?learnerId=${mockLearnerId}&action=leaderboard`),
      ]);

      if (feedRes.ok) {
        const data = await feedRes.json();
        setFeed(data.feed || []);
      }

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      }

      if (challengesRes.ok) {
        const data = await challengesRes.json();
        setChallenges(data.challenges || []);
      }

      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Failed to fetch social data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "progress_share": return "📈";
      case "achievement": return "🏆";
      case "challenge_completed": return "⚔️";
      case "group_activity": return "👥";
      default: return "📖";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge variant="default">ACTIVE</Badge>;
      case "pending": return <Badge variant="secondary">PENDING</Badge>;
      case "completed": return <Badge variant="accent">COMPLETED</Badge>;
      default: return <Badge variant="outline">{status.toUpperCase()}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-heading tracking-tight">👥 LOADING SOCIAL...</h1>
          <p className="text-lg text-muted-foreground mt-4">Connecting with your learning community</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center space-y-4">
        <Badge variant="accent" className="text-lg px-6 py-2 font-heading">
          👥 SOCIAL LEARNING
        </Badge>
        <h1 className="text-6xl font-heading tracking-tight">
          LEARN WITH
          <span className="block text-7xl bg-gradient-to-r from-accent to-main bg-clip-text text-transparent">
            FRIENDS
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Connect, compete, and collaborate with fellow learners around the world
        </p>
      </section>

      <div className="flex justify-center gap-4 flex-wrap">
        <Button
          onClick={() => setActiveTab('feed')}
          variant={activeTab === 'feed' ? 'default' : 'outline'}
        >
          🗞️ FEED
        </Button>
        <Button
          onClick={() => setActiveTab('groups')}
          variant={activeTab === 'groups' ? 'default' : 'outline'}
        >
          👥 GROUPS ({groups.length})
        </Button>
        <Button
          onClick={() => setActiveTab('challenges')}
          variant={activeTab === 'challenges' ? 'default' : 'outline'}
        >
          ⚔️ CHALLENGES ({challenges.filter(c => c.status === 'active' || c.status === 'pending').length})
        </Button>
        <Button
          onClick={() => setActiveTab('leaderboard')}
          variant={activeTab === 'leaderboard' ? 'default' : 'outline'}
        >
          🏆 LEADERBOARD
        </Button>
      </div>

      {activeTab === 'feed' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>📡 Learning Feed</CardTitle>
              <CardDescription>See what your friends are learning and achieving</CardDescription>
            </CardHeader>
            <CardContent>
              {feed.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-heading mb-4">No activity yet!</h3>
                  <p className="text-muted-foreground mb-6">
                    Connect with friends and join study groups to see their learning progress
                  </p>
                  <Button onClick={() => setActiveTab('groups')}>
                    🔍 FIND STUDY GROUPS
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {feed.map((item) => (
                    <div key={item.id} className="p-4 border-2 border-border rounded-base shadow-shadow">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getTypeIcon(item.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-heading text-sm">{item.learnerName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>
                          <p className="font-base text-sm mb-3">{item.content}</p>
                          {item.metadata && (
                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                              Progress: {((item.metadata.progress || 0) * 100).toFixed(0)}% •
                              Status: {item.metadata.status}
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline" className="text-xs">
                              👍 Like
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs">
                              🎉 Celebrate
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs">
                              💬 Comment
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>👥 Study Groups</CardTitle>
              <CardDescription>Join collaborative learning communities</CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-heading mb-4">No study groups found!</h3>
                  <p className="text-muted-foreground mb-6">
                    Create or discover study groups to learn with others
                  </p>
                  <Button>🏗️ CREATE STUDY GROUP</Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {groups.map((group) => (
                    <div key={group.id} className="p-4 border-2 border-border rounded-base shadow-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-heading text-lg">{group.name}</h4>
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        </div>
                        {group.isJoined ? (
                          <Badge variant="default">JOINED</Badge>
                        ) : (
                          <Button size="sm">JOIN</Button>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>👥 {group.memberCount} members</span>
                        {group.focusSkills.length > 0 && (
                          <span>🎯 {group.focusSkills.length} focus skills</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>⚔️ Peer Challenges</CardTitle>
              <CardDescription>Challenge friends and compete in learning goals</CardDescription>
            </CardHeader>
            <CardContent>
              {challenges.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-heading mb-4">No challenges yet!</h3>
                  <p className="text-muted-foreground mb-6">
                    Challenge your friends to learning competitions
                  </p>
                  <Button>⚔️ CREATE CHALLENGE</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {challenges.map((challenge) => (
                    <div key={challenge.id} className="p-4 border-2 border-border rounded-base shadow-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-heading text-sm">
                              {challenge.challengeType.replace('_', ' ').toUpperCase()}
                            </span>
                            {getStatusBadge(challenge.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {formatTimeAgo(challenge.createdAt)}
                          </p>
                        </div>
                        {challenge.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default">ACCEPT</Button>
                            <Button size="sm" variant="outline">DECLINE</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>🏆 Global Leaderboard</CardTitle>
              <CardDescription>See how you rank among fellow learners</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-heading mb-4">No rankings available!</h3>
                  <p className="text-muted-foreground">Start learning to appear on the leaderboard</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.slice(0, 10).map((entry, index) => (
                    <div key={entry.learnerId} className="flex items-center gap-4 p-3 border-2 border-border rounded-base">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-main text-main-foreground font-heading">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <span className="font-heading text-sm">{entry.learnerName}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-heading text-sm">{entry.totalXp.toLocaleString()} XP</div>
                      </div>
                      {index < 3 && (
                        <span className="text-2xl">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">👫</CardTitle>
            <CardDescription>Friends</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{friends.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">👥</CardTitle>
            <CardDescription>Study Groups</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">{groups.filter(g => g.isJoined).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">⚔️</CardTitle>
            <CardDescription>Active Challenges</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-3xl font-heading">
              {challenges.filter(c => c.status === 'active' || c.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}