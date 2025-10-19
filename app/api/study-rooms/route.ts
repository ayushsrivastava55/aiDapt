import { NextRequest, NextResponse } from "next/server";
import { StudyRoomsService } from "@/lib/services/study-rooms";
import { z } from "zod";

const CreateRoomSchema = z.object({
  hostId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  settings: z.object({
    maxParticipants: z.number().min(2).max(100).optional(),
    requireCamera: z.boolean().optional(),
    requireMicrophone: z.boolean().optional(),
    attentionThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
});

const JoinRoomSchema = z.object({
  roomId: z.string().uuid(),
  learnerId: z.string().uuid(),
  role: z.enum(["host", "participant"]).optional(),
});

const LeaveRoomSchema = z.object({
  roomId: z.string().uuid(),
  learnerId: z.string().uuid(),
});

const AttentionLogSchema = z.object({
  participantId: z.string().uuid(),
  attentionScore: z.number().min(0).max(1),
  faceDetected: z.boolean(),
  eyesDetected: z.boolean(),
  headPose: z.object({
    pitch: z.number(),
    yaw: z.number(),
    roll: z.number(),
  }).optional(),
  emotionData: z.any().optional(),
});

const UpdateStatusSchema = z.object({
  participantId: z.string().uuid(),
  enabled: z.boolean(),
});

const VoiceInteractionSchema = z.object({
  roomId: z.string().uuid(),
  learnerId: z.string().uuid(),
  query: z.string(),
  response: z.string(),
  duration: z.number().min(0),
  confidence: z.number().min(0).max(1),
  metadata: z.any().optional(),
});

const EndRoomSchema = z.object({
  roomId: z.string().uuid(),
  hostId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const body = await request.json();

    const service = new StudyRoomsService();

    switch (action) {
      case "create":
        const createData = CreateRoomSchema.parse(body);
        const room = await service.createStudyRoom(
          createData.hostId,
          createData.name,
          createData.description || "",
          createData.settings || {}
        );
        return NextResponse.json({
          success: true,
          room,
          message: "Study room created successfully",
        });

      case "join":
        const joinData = JoinRoomSchema.parse(body);
        const participant = await service.joinStudyRoom(
          joinData.roomId,
          joinData.learnerId,
          joinData.role
        );
        return NextResponse.json({
          success: true,
          participant,
          message: "Joined study room successfully",
        });

      case "leave":
        const leaveData = LeaveRoomSchema.parse(body);
        await service.leaveStudyRoom(leaveData.roomId, leaveData.learnerId);
        return NextResponse.json({
          success: true,
          message: "Left study room successfully",
        });

      case "log-attention":
        const attentionData = AttentionLogSchema.parse(body);
        const log = await service.logAttentionData(
          attentionData.participantId,
          attentionData.attentionScore,
          attentionData.faceDetected,
          attentionData.eyesDetected,
          attentionData.headPose,
          attentionData.emotionData
        );
        return NextResponse.json({
          success: true,
          log,
          message: "Attention data logged successfully",
        });

      case "update-camera":
        const cameraData = UpdateStatusSchema.parse(body);
        await service.updateCameraStatus(cameraData.participantId, cameraData.enabled);
        return NextResponse.json({
          success: true,
          message: "Camera status updated successfully",
        });

      case "update-microphone":
        const micData = UpdateStatusSchema.parse(body);
        await service.updateMicrophoneStatus(micData.participantId, micData.enabled);
        return NextResponse.json({
          success: true,
          message: "Microphone status updated successfully",
        });

      case "voice-interaction":
        const voiceData = VoiceInteractionSchema.parse(body);
        const interaction = await service.recordVoiceInteraction(
          voiceData.roomId,
          voiceData.learnerId,
          voiceData.query,
          voiceData.response,
          voiceData.duration,
          voiceData.confidence,
          voiceData.metadata
        );
        return NextResponse.json({
          success: true,
          interaction,
          message: "Voice interaction recorded successfully",
        });

      case "end":
        const endData = EndRoomSchema.parse(body);
        await service.endStudyRoom(endData.roomId, endData.hostId);
        return NextResponse.json({
          success: true,
          message: "Study room ended successfully",
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in study rooms API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const roomId = searchParams.get("roomId");
    const learnerId = searchParams.get("learnerId");
    const participantId = searchParams.get("participantId");

    const service = new StudyRoomsService();

    switch (action) {
      case "list":
        const rooms = await service.getActiveStudyRooms();
        return NextResponse.json({
          success: true,
          rooms,
        });

      case "details":
        if (!roomId) {
          return NextResponse.json(
            { success: false, error: "roomId is required" },
            { status: 400 }
          );
        }
        const roomDetails = await service.getRoomDetails(roomId);
        return NextResponse.json({
          success: true,
          room: roomDetails,
        });

      case "participant-session":
        if (!roomId || !learnerId) {
          return NextResponse.json(
            { success: false, error: "roomId and learnerId are required" },
            { status: 400 }
          );
        }
        const session = await service.getParticipantSession(roomId, learnerId);
        return NextResponse.json({
          success: true,
          session,
        });

      case "attention-analysis":
        if (!participantId) {
          return NextResponse.json(
            { success: false, error: "participantId is required" },
            { status: 400 }
          );
        }
        const analysis = await service.getAttentionAnalysis(participantId);
        return NextResponse.json({
          success: true,
          analysis,
        });

      case "statistics":
        if (!roomId) {
          return NextResponse.json(
            { success: false, error: "roomId is required" },
            { status: 400 }
          );
        }
        const stats = await service.getRoomStatistics(roomId);
        return NextResponse.json({
          success: true,
          statistics: stats,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error fetching study rooms data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}