"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Badge } from "@/lib/components/ui/badge";
import { Button } from "@/lib/components/ui/button";
import { LoadingPage } from "@/lib/components/ui/loading";
import { ErrorState } from "@/lib/components/ui/error-state";
import { useSession } from "@/lib/hooks/use-session";
import { VoiceAssistant } from "@/lib/utils/voice-assistant";
import { AttentionDetector, type AttentionMetrics } from "@/lib/utils/attention-detector";

interface StudyRoom {
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

interface ParticipantSession {
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

interface AttentionAnalysis {
  currentScore: number;
  averageScore: number;
  focusPercentage: number;
  totalSessionTime: number;
  recommendations: string[];
  alertTriggered: boolean;
}

export default function StudyRoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const { learnerId, isLoading: sessionLoading, error: sessionError } = useSession();

  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [session, setSession] = useState<ParticipantSession | null>(null);
  const [analysis, setAnalysis] = useState<AttentionAnalysis | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<AttentionMetrics | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const attentionDetectorRef = useRef<AttentionDetector | null>(null);
  const voiceAssistantRef = useRef<VoiceAssistant | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (roomId && learnerId && !sessionLoading) {
      fetchRoomData();
    }
  }, [roomId, learnerId, sessionLoading]);

  useEffect(() => {
    if (isJoined && session) {
      startAttentionDetection();
      const analysisInterval = setInterval(fetchAttentionAnalysis, 5000);

      return () => {
        clearInterval(analysisInterval);
        stopAttentionDetection();
        // Ensure voice assistant is cleaned up when leaving page
        voiceAssistantRef.current?.endSession().catch(() => {});
      };
    }
  }, [isJoined, session]);

  const fetchRoomData = async () => {
    if (!learnerId) return;

    try {
      setLoading(true);
      const [roomRes, sessionRes] = await Promise.all([
        fetch(`/api/study-rooms?action=details&roomId=${roomId}`),
        fetch(`/api/study-rooms?action=participant-session&roomId=${roomId}&learnerId=${learnerId}`),
      ]);

      if (roomRes.ok) {
        const data = await roomRes.json();
        setRoom(data.room);
      }

      if (sessionRes.ok) {
        const data = await sessionRes.json();
        if (data.session) {
          setSession(data.session);
          setIsJoined(true);
          setCameraEnabled(data.session.cameraEnabled === 1);
          setMicrophoneEnabled(data.session.microphoneEnabled === 1);
        }
      }
    } catch (error) {
      console.error("Failed to fetch room data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttentionAnalysis = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/study-rooms?action=attention-analysis&participantId=${session.id}`);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error("Failed to fetch attention analysis:", error);
    }
  };

  const joinRoom = async () => {
    if (!learnerId) return;

    try {
      const response = await fetch("/api/study-rooms?action=join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          learnerId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.participant);
        setIsJoined(true);

        if (room?.requireCamera) {
          await enableCamera();
        }
      }
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  };

  const leaveRoom = async () => {
    if (!learnerId) return;

    try {
      await fetch("/api/study-rooms?action=leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          learnerId,
        }),
      });

      setIsJoined(false);
      setSession(null);
      stopCamera();
      stopAttentionDetection();
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  };

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraEnabled(true);

        if (session) {
          await updateCameraStatus(true);
        }
      }
    } catch (error) {
      console.error("Failed to enable camera:", error);
      alert("Camera access denied. Please allow camera access to join this study room.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraEnabled(false);

    if (session) {
      updateCameraStatus(false);
    }
  };

  const updateCameraStatus = async (enabled: boolean) => {
    if (!session) return;

    try {
      await fetch("/api/study-rooms?action=update-camera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: session.id,
          enabled,
        }),
      });
    } catch (error) {
      console.error("Failed to update camera status:", error);
    }
  };

  const updateMicrophoneStatus = async (enabled: boolean) => {
    if (!session) return;

    try {
      await fetch("/api/study-rooms?action=update-microphone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: session.id,
          enabled,
        }),
      });

      setMicrophoneEnabled(enabled);
    } catch (error) {
      console.error("Failed to update microphone status:", error);
    }
  };

  const startAttentionDetection = async () => {
    if (!videoRef.current || !session) return;

    try {
      attentionDetectorRef.current = new AttentionDetector({
        attentionThreshold: room?.attentionThreshold || 0.7,
      });

      await attentionDetectorRef.current.initialize();

      detectionIntervalRef.current = setInterval(async () => {
        if (videoRef.current && attentionDetectorRef.current) {
          const metrics = await attentionDetectorRef.current.detectAttention(videoRef.current);
          setCurrentMetrics(metrics);

          // Log attention data
          await fetch("/api/study-rooms?action=log-attention", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              participantId: session.id,
              attentionScore: metrics.attentionScore,
              faceDetected: metrics.faceDetected,
              eyesDetected: metrics.eyesDetected,
              headPose: metrics.headPose,
            }),
          });
        }
      }, 2000); // Every 2 seconds

    } catch (error) {
      console.error("Failed to start attention detection:", error);
    }
  };

  const stopAttentionDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const toggleVoiceMode = async () => {
    const next = !isVoiceActive;
    setIsVoiceActive(next);
    if (next) {
      if (!session) return;
      if (!voiceAssistantRef.current) {
        voiceAssistantRef.current = new VoiceAssistant();
      }
      try {
        await voiceAssistantRef.current.startSession(roomId, session.id);
        // Optional: rely on Realtime mic streaming; also enable browser STT for text queries
        try {
          await voiceAssistantRef.current.startListening();
        } catch (e) {
          console.warn("SpeechRecognition unavailable:", e);
        }
      } catch (e) {
        console.error("Failed to start voice assistant:", e);
        setIsVoiceActive(false);
      }
    } else {
      await voiceAssistantRef.current?.endSession();
    }
  };

  const getAttentionColor = (score: number) => {
    if (score >= 0.7) return "text-green-600";
    if (score >= 0.4) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (sessionLoading || loading) {
    return (
      <LoadingPage
        title="📚 LOADING STUDY ROOM"
        description="Preparing your focused learning environment"
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

  if (!room) {
    return (
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-heading tracking-tight">❌ ROOM NOT FOUND</h1>
        <p className="text-lg text-muted-foreground">The study room you're looking for doesn't exist.</p>
        <Button onClick={() => window.history.back()}>← GO BACK</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Room Header */}
      <div className="text-center space-y-4">
        <Badge variant="accent" className="text-lg px-6 py-2 font-heading">
          📚 STUDY ROOM
        </Badge>
        <h1 className="text-5xl font-heading tracking-tight">{room.name}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{room.description}</p>
        <div className="flex gap-4 justify-center">
          <Badge variant="outline">Host: {room.hostName}</Badge>
          <Badge variant="outline">👥 {room.participants.length} participants</Badge>
          <Badge variant="outline">📊 Avg Attention: {(room.avgAttentionScore * 100).toFixed(0)}%</Badge>
        </div>
      </div>

      {!isJoined ? (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle>🚪 Join Study Room</CardTitle>
            <CardDescription>
              {room.requireCamera ? "📷 Camera required" : "📷 Camera optional"} •
              {room.requireMicrophone ? " 🎤 Microphone required" : " 🎤 Microphone optional"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This study room uses AI-powered attention monitoring to help you stay focused.
            </p>
            <Button onClick={joinRoom} size="lg" className="w-full">
              🚀 JOIN STUDY ROOM
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Video & Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📹 Your Camera Feed
                  <div className="flex gap-2">
                    <Button
                      onClick={cameraEnabled ? stopCamera : enableCamera}
                      variant={cameraEnabled ? "default" : "outline"}
                      size="sm"
                    >
                      {cameraEnabled ? "📷 ON" : "📷 OFF"}
                    </Button>
                    <Button
                      onClick={() => updateMicrophoneStatus(!microphoneEnabled)}
                      variant={microphoneEnabled ? "default" : "outline"}
                      size="sm"
                    >
                      {microphoneEnabled ? "🎤 ON" : "🎤 OFF"}
                    </Button>
                    <Button
                      onClick={toggleVoiceMode}
                      variant={isVoiceActive ? "accent" : "outline"}
                      size="sm"
                    >
                      {isVoiceActive ? "🗣️ VOICE" : "🤫 MUTED"}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-64 bg-black rounded-base border-2 border-border"
                  />
                  {!cameraEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black rounded-base">
                      <div className="text-center text-white">
                        <div className="text-4xl mb-2">📷</div>
                        <div>Camera is off</div>
                      </div>
                    </div>
                  )}
                  {currentMetrics && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      Attention: <span className={getAttentionColor(currentMetrics.attentionScore)}>
                        {(currentMetrics.attentionScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Voice Interaction */}
            {isVoiceActive && (
              <Card>
                <CardHeader>
                  <CardTitle>🤖 AI Study Assistant</CardTitle>
                  <CardDescription>Ask questions or get help with your studies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-accent/10 border-2 border-accent rounded-base text-center">
                    <div className="text-2xl mb-2">🎙️</div>
                    <p className="text-sm">Voice interaction ready - speak your question</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Powered by OpenAI Realtime API (coming soon)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Stats & Analysis */}
          <div className="space-y-6">
            {/* Session Stats */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Your Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Focus Score:</span>
                  <span className={`font-heading ${getAttentionColor(session?.attentionScore || 0)}`}>
                    {((session?.attentionScore || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Focus Time:</span>
                  <span className="font-heading">{formatTime(session?.focusTime || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Time:</span>
                  <span className="font-heading">{formatTime(analysis?.totalSessionTime || 0)}</span>
                </div>
                {analysis && (
                  <div className="flex justify-between">
                    <span>Focus %:</span>
                    <span className="font-heading">{analysis.focusPercentage.toFixed(0)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Analysis */}
            {currentMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle>🔍 Live Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Face:</span>
                    <span className={currentMetrics.faceDetected ? "text-green-600" : "text-red-600"}>
                      {currentMetrics.faceDetected ? "✅ Detected" : "❌ Not Found"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eyes:</span>
                    <span className={currentMetrics.eyesDetected ? "text-green-600" : "text-red-600"}>
                      {currentMetrics.eyesDetected ? "👀 Open" : "😴 Closed"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Head Pose:</span>
                    <span className="text-xs">
                      Y:{currentMetrics.headPose.yaw.toFixed(0)}° P:{currentMetrics.headPose.pitch.toFixed(0)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blink Rate:</span>
                    <span>{currentMetrics.blinkRate}/min</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {analysis?.recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle>💡 Focus Tips</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        {rec}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leave Room */}
            <Button onClick={leaveRoom} variant="destructive" className="w-full">
              🚪 LEAVE ROOM
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}