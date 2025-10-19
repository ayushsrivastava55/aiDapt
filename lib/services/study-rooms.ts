import { getDb } from "@/lib/db";
import {
  studyRooms,
  studyRoomParticipants,
  attentionLogs,
  voiceInteractions,
  learners,
  type StudyRoom,
  type NewStudyRoom,
  type StudyRoomParticipant,
  type NewStudyRoomParticipant,
  type AttentionLog,
  type NewAttentionLog,
  type VoiceInteraction,
  type NewVoiceInteraction,
} from "@/lib/db/schema";
import { eq, and, desc, avg, sum, count, gte } from "drizzle-orm";

const db = getDb();

export interface StudyRoomInfo extends StudyRoom {
  participants: StudyRoomParticipant[];
  hostName: string;
  avgAttentionScore: number;
  totalFocusTime: number;
}

export interface AttentionAnalysis {
  currentScore: number;
  averageScore: number;
  focusPercentage: number;
  totalSessionTime: number;
  recommendations: string[];
  alertTriggered: boolean;
}

export interface VoiceSessionData {
  isActive: boolean;
  participantId: string;
  startTime: Date;
  query?: string;
}

export class StudyRoomsService {
  async createStudyRoom(
    hostId: string,
    name: string,
    description: string,
    settings: {
      maxParticipants?: number;
      requireCamera?: boolean;
      requireMicrophone?: boolean;
      attentionThreshold?: number;
    } = {}
  ): Promise<StudyRoom> {
    const [room] = await db.insert(studyRooms).values({
      name,
      description,
      hostId,
      maxParticipants: settings.maxParticipants || 20,
      requireCamera: settings.requireCamera ? 1 : 0,
      requireMicrophone: settings.requireMicrophone ? 1 : 0,
      attentionThreshold: settings.attentionThreshold || 0.7,
      settings,
      startedAt: new Date(),
    }).returning();

    // Host automatically joins as participant
    await this.joinStudyRoom(room.id, hostId, "host");

    return room;
  }

  async joinStudyRoom(roomId: string, learnerId: string, role: "host" | "participant" = "participant"): Promise<StudyRoomParticipant> {
    // Check if room exists and has space
    const [room] = await db
      .select()
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .limit(1);

    if (!room) {
      throw new Error("Study room not found");
    }

    if (room.currentParticipants >= room.maxParticipants) {
      throw new Error("Study room is full");
    }

    // Check if already joined
    const existing = await db
      .select()
      .from(studyRoomParticipants)
      .where(and(
        eq(studyRoomParticipants.roomId, roomId),
        eq(studyRoomParticipants.learnerId, learnerId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing participant as present
      const [updated] = await db
        .update(studyRoomParticipants)
        .set({
          isPresent: 1,
          lastActivityAt: new Date(),
          leftAt: null,
        })
        .where(eq(studyRoomParticipants.id, existing[0].id))
        .returning();

      return updated;
    }

    // Create new participant
    const [participant] = await db.insert(studyRoomParticipants).values({
      roomId,
      learnerId,
      role,
      cameraEnabled: room.requireCamera,
      microphoneEnabled: room.requireMicrophone ? 1 : 0,
    }).returning();

    // Update room participant count
    await db
      .update(studyRooms)
      .set({ currentParticipants: room.currentParticipants + 1 })
      .where(eq(studyRooms.id, roomId));

    return participant;
  }

  async leaveStudyRoom(roomId: string, learnerId: string): Promise<void> {
    const [participant] = await db
      .select()
      .from(studyRoomParticipants)
      .where(and(
        eq(studyRoomParticipants.roomId, roomId),
        eq(studyRoomParticipants.learnerId, learnerId),
        eq(studyRoomParticipants.isPresent, 1)
      ))
      .limit(1);

    if (!participant) {
      return; // Already left or not joined
    }

    // Mark as left
    await db
      .update(studyRoomParticipants)
      .set({
        isPresent: 0,
        leftAt: new Date(),
        cameraEnabled: 0,
        microphoneEnabled: 0,
      })
      .where(eq(studyRoomParticipants.id, participant.id));

    // Update room participant count
    const [room] = await db
      .select({ currentParticipants: studyRooms.currentParticipants })
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .limit(1);

    if (room) {
      await db
        .update(studyRooms)
        .set({ currentParticipants: Math.max(0, room.currentParticipants - 1) })
        .where(eq(studyRooms.id, roomId));
    }
  }

  async logAttentionData(
    participantId: string,
    attentionScore: number,
    faceDetected: boolean,
    eyesDetected: boolean,
    headPose?: any,
    emotionData?: any
  ): Promise<AttentionLog> {
    const [log] = await db.insert(attentionLogs).values({
      participantId,
      attentionScore,
      faceDetected: faceDetected ? 1 : 0,
      eyesDetected: eyesDetected ? 1 : 0,
      headPose,
      emotionData,
    }).returning();

    // Update participant's running attention score
    await this.updateParticipantAttention(participantId, attentionScore);

    return log;
  }

  private async updateParticipantAttention(participantId: string, currentScore: number): Promise<void> {
    // Get recent attention logs (last 30 entries) for running average
    const recentLogs = await db
      .select({ attentionScore: attentionLogs.attentionScore })
      .from(attentionLogs)
      .where(eq(attentionLogs.participantId, participantId))
      .orderBy(desc(attentionLogs.timestamp))
      .limit(30);

    if (recentLogs.length === 0) return;

    const avgScore = recentLogs.reduce((sum, log) => sum + log.attentionScore, 0) / recentLogs.length;

    // Update participant's attention score and focus time
    const [participant] = await db
      .select({ focusTime: studyRoomParticipants.focusTime })
      .from(studyRoomParticipants)
      .where(eq(studyRoomParticipants.id, participantId))
      .limit(1);

    if (participant) {
      const focusIncrement = currentScore > 0.7 ? 5 : 0; // 5 seconds of focus time if attention > 70%

      await db
        .update(studyRoomParticipants)
        .set({
          attentionScore: avgScore,
          focusTime: participant.focusTime + focusIncrement,
          lastActivityAt: new Date(),
        })
        .where(eq(studyRoomParticipants.id, participantId));
    }
  }

  async getAttentionAnalysis(participantId: string): Promise<AttentionAnalysis> {
    // Get recent attention data (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentLogs = await db
      .select()
      .from(attentionLogs)
      .where(and(
        eq(attentionLogs.participantId, participantId),
        gte(attentionLogs.timestamp, fiveMinutesAgo)
      ))
      .orderBy(desc(attentionLogs.timestamp));

    if (recentLogs.length === 0) {
      return {
        currentScore: 0,
        averageScore: 0,
        focusPercentage: 0,
        totalSessionTime: 0,
        recommendations: ["Start your study session to begin attention tracking"],
        alertTriggered: false,
      };
    }

    const currentScore = recentLogs[0].attentionScore;
    const averageScore = recentLogs.reduce((sum, log) => sum + log.attentionScore, 0) / recentLogs.length;
    const focusedCount = recentLogs.filter(log => log.attentionScore > 0.7).length;
    const focusPercentage = (focusedCount / recentLogs.length) * 100;

    // Get total session time
    const [participant] = await db
      .select({
        joinedAt: studyRoomParticipants.joinedAt,
        focusTime: studyRoomParticipants.focusTime,
      })
      .from(studyRoomParticipants)
      .where(eq(studyRoomParticipants.id, participantId))
      .limit(1);

    const totalSessionTime = participant
      ? Math.floor((Date.now() - participant.joinedAt.getTime()) / 1000)
      : 0;

    // Generate recommendations
    const recommendations: string[] = [];
    let alertTriggered = false;

    if (currentScore < 0.5) {
      recommendations.push("📱 Please look at the camera and focus on your studies");
      alertTriggered = true;
    }

    if (averageScore < 0.6) {
      recommendations.push("🧘 Take a short break to reset your focus");
    }

    if (focusPercentage < 70) {
      recommendations.push("🎯 Try to maintain better posture and eye contact with the screen");
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Great focus! Keep up the excellent work");
    }

    return {
      currentScore,
      averageScore,
      focusPercentage,
      totalSessionTime,
      recommendations,
      alertTriggered,
    };
  }

  async updateCameraStatus(participantId: string, enabled: boolean): Promise<void> {
    await db
      .update(studyRoomParticipants)
      .set({
        cameraEnabled: enabled ? 1 : 0,
        lastActivityAt: new Date(),
      })
      .where(eq(studyRoomParticipants.id, participantId));
  }

  async updateMicrophoneStatus(participantId: string, enabled: boolean): Promise<void> {
    await db
      .update(studyRoomParticipants)
      .set({
        microphoneEnabled: enabled ? 1 : 0,
        lastActivityAt: new Date(),
      })
      .where(eq(studyRoomParticipants.id, participantId));
  }

  async recordVoiceInteraction(
    roomId: string,
    learnerId: string,
    query: string,
    response: string,
    duration: number,
    confidence: number,
    metadata?: any
  ): Promise<VoiceInteraction> {
    const [interaction] = await db.insert(voiceInteractions).values({
      roomId,
      learnerId,
      query,
      response,
      duration,
      confidence,
      metadata,
    }).returning();

    return interaction;
  }

  async getActiveStudyRooms(): Promise<StudyRoomInfo[]> {
    const rooms = await db
      .select({
        room: studyRooms,
        hostName: learners.displayName,
      })
      .from(studyRooms)
      .innerJoin(learners, eq(learners.id, studyRooms.hostId))
      .where(eq(studyRooms.isActive, 1))
      .orderBy(desc(studyRooms.createdAt));

    const roomsWithDetails: StudyRoomInfo[] = [];

    for (const { room, hostName } of rooms) {
      const participants = await db
        .select()
        .from(studyRoomParticipants)
        .where(and(
          eq(studyRoomParticipants.roomId, room.id),
          eq(studyRoomParticipants.isPresent, 1)
        ));

      const avgAttentionScore = participants.length > 0
        ? participants.reduce((sum, p) => sum + (p.attentionScore || 0), 0) / participants.length
        : 0;

      const totalFocusTime = participants.reduce((sum, p) => sum + (p.focusTime || 0), 0);

      roomsWithDetails.push({
        ...room,
        participants,
        hostName: hostName || `Host ${room.hostId.slice(0, 8)}`,
        avgAttentionScore,
        totalFocusTime,
      });
    }

    return roomsWithDetails;
  }

  async getRoomDetails(roomId: string): Promise<StudyRoomInfo | null> {
    const [roomData] = await db
      .select({
        room: studyRooms,
        hostName: learners.displayName,
      })
      .from(studyRooms)
      .innerJoin(learners, eq(learners.id, studyRooms.hostId))
      .where(eq(studyRooms.id, roomId))
      .limit(1);

    if (!roomData) return null;

    const participants = await db
      .select()
      .from(studyRoomParticipants)
      .where(eq(studyRoomParticipants.roomId, roomId));

    const activeParticipants = participants.filter(p => p.isPresent === 1);

    const avgAttentionScore = activeParticipants.length > 0
      ? activeParticipants.reduce((sum, p) => sum + (p.attentionScore || 0), 0) / activeParticipants.length
      : 0;

    const totalFocusTime = activeParticipants.reduce((sum, p) => sum + (p.focusTime || 0), 0);

    return {
      ...roomData.room,
      participants: activeParticipants,
      hostName: roomData.hostName || `Host ${roomData.room.hostId.slice(0, 8)}`,
      avgAttentionScore,
      totalFocusTime,
    };
  }

  async endStudyRoom(roomId: string, hostId: string): Promise<void> {
    // Verify host permission
    const [room] = await db
      .select()
      .from(studyRooms)
      .where(and(
        eq(studyRooms.id, roomId),
        eq(studyRooms.hostId, hostId)
      ))
      .limit(1);

    if (!room) {
      throw new Error("Study room not found or insufficient permissions");
    }

    // Mark room as inactive and set end time
    await db
      .update(studyRooms)
      .set({
        isActive: 0,
        endedAt: new Date(),
      })
      .where(eq(studyRooms.id, roomId));

    // Mark all participants as left
    await db
      .update(studyRoomParticipants)
      .set({
        isPresent: 0,
        leftAt: new Date(),
        cameraEnabled: 0,
        microphoneEnabled: 0,
      })
      .where(eq(studyRoomParticipants.roomId, roomId));
  }

  async getParticipantSession(roomId: string, learnerId: string): Promise<StudyRoomParticipant | null> {
    const [participant] = await db
      .select()
      .from(studyRoomParticipants)
      .where(and(
        eq(studyRoomParticipants.roomId, roomId),
        eq(studyRoomParticipants.learnerId, learnerId),
        eq(studyRoomParticipants.isPresent, 1)
      ))
      .limit(1);

    return participant || null;
  }

  async getRoomStatistics(roomId: string): Promise<{
    totalParticipants: number;
    averageAttention: number;
    totalFocusTime: number;
    totalInteractions: number;
    sessionDuration: number;
  }> {
    const [room] = await db
      .select({
        startedAt: studyRooms.startedAt,
        endedAt: studyRooms.endedAt,
      })
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .limit(1);

    if (!room) {
      throw new Error("Study room not found");
    }

    const [stats] = await db
      .select({
        totalParticipants: count(studyRoomParticipants.id),
        averageAttention: avg(studyRoomParticipants.attentionScore),
        totalFocusTime: sum(studyRoomParticipants.focusTime),
      })
      .from(studyRoomParticipants)
      .where(eq(studyRoomParticipants.roomId, roomId));

    const [interactionCount] = await db
      .select({ count: count(voiceInteractions.id) })
      .from(voiceInteractions)
      .where(eq(voiceInteractions.roomId, roomId));

    const sessionDuration = room.endedAt
      ? Math.floor((room.endedAt.getTime() - (room.startedAt?.getTime() || 0)) / 1000)
      : Math.floor((Date.now() - (room.startedAt?.getTime() || 0)) / 1000);

    return {
      totalParticipants: stats.totalParticipants || 0,
      averageAttention: Number(stats.averageAttention) || 0,
      totalFocusTime: Number(stats.totalFocusTime) || 0,
      totalInteractions: interactionCount.count || 0,
      sessionDuration,
    };
  }
}