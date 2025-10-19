"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { LoadingPage } from "@/lib/components/ui/loading";
import { ErrorState } from "@/lib/components/ui/error-state";
import { useSession } from "@/lib/hooks/use-session";
import Link from "next/link";

interface StudyRoom {
  id: string;
  name: string;
  description: string;
  hostName: string;
  participants: any[];
  currentParticipants: number;
  maxParticipants: number;
  avgAttentionScore: number;
  totalFocusTime: number;
  requireCamera: number;
  requireMicrophone: number;
  isActive: number;
  createdAt: Date;
}

export default function StudyRoomsPage() {
  const { learnerId, isLoading: sessionLoading, error: sessionError } = useSession();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxParticipants: 20,
    requireCamera: true,
    requireMicrophone: false,
    attentionThreshold: 0.7,
  });

  useEffect(() => {
    if (!sessionLoading) {
      fetchStudyRooms();
    }
  }, [sessionLoading]);

  const fetchStudyRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/study-rooms?action=list");
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error("Failed to fetch study rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const createStudyRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!learnerId) {
      alert("No session found. Please refresh the page.");
      return;
    }

    try {
      setCreateLoading(true);
      const response = await fetch("/api/study-rooms?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: learnerId,
          name: formData.name,
          description: formData.description,
          settings: {
            maxParticipants: formData.maxParticipants,
            requireCamera: formData.requireCamera,
            requireMicrophone: formData.requireMicrophone,
            attentionThreshold: formData.attentionThreshold,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateForm(false);
        setFormData({
          name: "",
          description: "",
          maxParticipants: 20,
          requireCamera: true,
          requireMicrophone: false,
          attentionThreshold: 0.7,
        });
        await fetchStudyRooms();

        // Redirect to the created room
        window.location.href = `/study-room/${data.room.id}`;
      }
    } catch (error) {
      console.error("Failed to create study room:", error);
    } finally {
      setCreateLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 60);
    const mins = seconds % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getAttentionColor = (score: number) => {
    if (score >= 0.7) return "text-green-600";
    if (score >= 0.4) return "text-yellow-600";
    return "text-red-600";
  };

  if (sessionLoading || loading) {
    return (
      <LoadingPage
        title="📚 LOADING STUDY ROOMS"
        description="Finding the perfect focused learning spaces"
        icon="📚"
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
          📚 AI-POWERED STUDY ROOMS
        </Badge>
        <h1 className="text-6xl font-heading tracking-tight">
          FOCUSED
          <span className="block text-7xl bg-gradient-to-r from-accent to-main bg-clip-text text-transparent">
            LEARNING
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Join AI-monitored study rooms where attention tracking keeps you focused and voice AI helps answer your questions
        </p>
      </section>

      <div className="flex justify-center gap-4">
        <Button
          onClick={() => setShowCreateForm(true)}
          size="lg"
          className="text-lg px-8"
        >
          🏗️ CREATE STUDY ROOM
        </Button>
        <Button onClick={fetchStudyRooms} variant="outline" size="lg">
          🔄 REFRESH
        </Button>
      </div>

      {showCreateForm && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>🏗️ Create New Study Room</CardTitle>
            <CardDescription>Set up your AI-monitored learning environment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createStudyRoom} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="name" className="text-sm font-heading block">ROOM NAME</label>
                <Input
                  id="name"
                  placeholder="e.g., Physics Study Group, Math Homework Session..."
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-3">
                <label htmlFor="description" className="text-sm font-heading block">DESCRIPTION (Optional)</label>
                <Input
                  id="description"
                  placeholder="What will you be studying in this room?"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-sm font-heading block">MAX PARTICIPANTS</label>
                  <Input
                    type="number"
                    min={2}
                    max={100}
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: Number(e.target.value) }))}
                    className="h-12"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-heading block">ATTENTION THRESHOLD</label>
                  <Input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={formData.attentionThreshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, attentionThreshold: Number(e.target.value) }))}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-heading block">ROOM REQUIREMENTS</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.requireCamera}
                      onChange={(e) => setFormData(prev => ({ ...prev, requireCamera: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>📷 Require Camera (for attention monitoring)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.requireMicrophone}
                      onChange={(e) => setFormData(prev => ({ ...prev, requireMicrophone: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>🎤 Require Microphone (for voice interactions)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createLoading || !formData.name.trim()}
                  className="flex-1"
                >
                  {createLoading ? "🔄 Creating..." : "🚀 CREATE ROOM"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  variant="outline"
                >
                  CANCEL
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rooms.length === 0 ? (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🏫</div>
            <h3 className="text-2xl font-heading mb-4">No Active Study Rooms</h3>
            <p className="text-muted-foreground mb-6">
              Be the first to create an AI-monitored study room and invite others to join!
            </p>
            <Button onClick={() => setShowCreateForm(true)} size="lg">
              🏗️ CREATE FIRST ROOM
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="neo-hover">
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="text-lg">{room.name}</span>
                  <Badge
                    variant={room.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {room.isActive ? "🟢 ACTIVE" : "🔴 ENDED"}
                  </Badge>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {room.description || "Join this focused study session"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>Host:</span>
                    <span className="font-heading">{room.hostName}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span>Participants:</span>
                    <span className="font-heading">
                      {room.currentParticipants}/{room.maxParticipants}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span>Avg Attention:</span>
                    <span className={`font-heading ${getAttentionColor(room.avgAttentionScore)}`}>
                      {(room.avgAttentionScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span>Focus Time:</span>
                    <span className="font-heading">{formatTime(room.totalFocusTime)}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {room.requireCamera === 1 && (
                    <Badge variant="outline" className="text-xs">📷 Camera</Badge>
                  )}
                  {room.requireMicrophone === 1 && (
                    <Badge variant="outline" className="text-xs">🎤 Mic</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    🧠 AI Monitor
                  </Badge>
                </div>

                <div className="pt-2">
                  {room.isActive && room.currentParticipants < room.maxParticipants ? (
                    <Button asChild className="w-full">
                      <Link href={`/study-room/${room.id}`}>
                        🚪 JOIN ROOM
                      </Link>
                    </Button>
                  ) : room.currentParticipants >= room.maxParticipants ? (
                    <Button disabled className="w-full">
                      🔒 ROOM FULL
                    </Button>
                  ) : (
                    <Button disabled className="w-full">
                      📊 ROOM ENDED
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🧠</CardTitle>
            <CardDescription>AI Attention Monitoring</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Advanced computer vision tracks your focus and provides real-time feedback
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🗣️</CardTitle>
            <CardDescription>Voice AI Assistant</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Ask questions and get instant help from OpenAI-powered voice interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">👥</CardTitle>
            <CardDescription>Collaborative Learning</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Study together with peers while maintaining focused attention
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}