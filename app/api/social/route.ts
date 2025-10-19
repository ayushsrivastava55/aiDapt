import { NextRequest, NextResponse } from "next/server";
import { SocialService } from "@/lib/services/social";
import { z } from "zod";

const FriendRequestSchema = z.object({
  followerId: z.string().uuid(),
  followeeId: z.string().uuid(),
});

const ShareProgressSchema = z.object({
  learnerId: z.string().uuid(),
  skillId: z.string().uuid(),
  message: z.string(),
  visibility: z.enum(["public", "friends", "group"]).default("friends"),
});

const CreateGroupSchema = z.object({
  creatorId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().min(2).max(500).default(50),
  focusSkills: z.array(z.string()).default([]),
});

const JoinGroupSchema = z.object({
  groupId: z.string().uuid(),
  learnerId: z.string().uuid(),
});

const CreateChallengeSchema = z.object({
  challengerId: z.string().uuid(),
  challengeeId: z.string().uuid(),
  skillId: z.string().uuid(),
  challengeType: z.string(),
  targetScore: z.number().min(0).max(1).optional(),
  deadline: z.string().datetime().optional(),
});

const ReactionSchema = z.object({
  progressId: z.string().uuid(),
  reaction: z.string(),
  learnerId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const body = await request.json();

    const service = new SocialService();

    switch (action) {
      case "friend-request":
        const { followerId, followeeId } = FriendRequestSchema.parse(body);
        const connection = await service.sendFriendRequest(followerId, followeeId);
        return NextResponse.json({
          success: true,
          connection,
          message: "Friend request sent successfully",
        });

      case "accept-friend":
        const acceptData = FriendRequestSchema.parse(body);
        const accepted = await service.acceptFriendRequest(acceptData.followerId, acceptData.followeeId);
        return NextResponse.json({
          success: true,
          connection: accepted,
          message: "Friend request accepted",
        });

      case "share-progress":
        const shareData = ShareProgressSchema.parse(body);
        const shared = await service.shareProgress(
          shareData.learnerId,
          shareData.skillId,
          shareData.message,
          shareData.visibility
        );
        return NextResponse.json({
          success: true,
          shared,
          message: "Progress shared successfully",
        });

      case "create-group":
        const groupData = CreateGroupSchema.parse(body);
        const group = await service.createStudyGroup(
          groupData.creatorId,
          groupData.name,
          groupData.description || "",
          groupData.isPublic,
          groupData.maxMembers,
          groupData.focusSkills
        );
        return NextResponse.json({
          success: true,
          group,
          message: "Study group created successfully",
        });

      case "join-group":
        const joinData = JoinGroupSchema.parse(body);
        const member = await service.joinStudyGroup(joinData.groupId, joinData.learnerId);
        return NextResponse.json({
          success: true,
          member,
          message: "Joined study group successfully",
        });

      case "create-challenge":
        const challengeData = CreateChallengeSchema.parse(body);
        const challenge = await service.createPeerChallenge(
          challengeData.challengerId,
          challengeData.challengeeId,
          challengeData.skillId,
          challengeData.challengeType,
          challengeData.targetScore,
          challengeData.deadline ? new Date(challengeData.deadline) : undefined
        );
        return NextResponse.json({
          success: true,
          challenge,
          message: "Peer challenge created successfully",
        });

      case "accept-challenge":
        const challengeId = z.string().uuid().parse(body.challengeId);
        const acceptedChallenge = await service.acceptChallenge(challengeId);
        return NextResponse.json({
          success: true,
          challenge: acceptedChallenge,
          message: "Challenge accepted successfully",
        });

      case "react":
        const reactionData = ReactionSchema.parse(body);
        await service.addReactionToProgress(
          reactionData.progressId,
          reactionData.reaction,
          reactionData.learnerId
        );
        return NextResponse.json({
          success: true,
          message: "Reaction added successfully",
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in social API:", error);
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
    const learnerId = searchParams.get("learnerId");

    if (!learnerId) {
      return NextResponse.json(
        { success: false, error: "learnerId is required" },
        { status: 400 }
      );
    }

    const service = new SocialService();

    switch (action) {
      case "friends":
        const friends = await service.getFriends(learnerId);
        return NextResponse.json({
          success: true,
          friends,
        });

      case "feed":
        const limit = parseInt(searchParams.get("limit") || "20");
        const feed = await service.getSocialFeed(learnerId, limit);
        return NextResponse.json({
          success: true,
          feed,
        });

      case "groups":
        const groups = await service.getStudyGroups(learnerId);
        return NextResponse.json({
          success: true,
          groups,
        });

      case "challenges":
        const challenges = await service.getPeerChallenges(learnerId);
        return NextResponse.json({
          success: true,
          challenges,
        });

      case "leaderboard":
        const skillId = searchParams.get("skillId") || undefined;
        const timeframe = parseInt(searchParams.get("timeframe") || "30");
        const leaderboard = await service.getLeaderboard(skillId, timeframe);
        return NextResponse.json({
          success: true,
          leaderboard,
        });

      case "recommendations":
        const recommendations = await service.getCollaborativeRecommendations(learnerId);
        return NextResponse.json({
          success: true,
          recommendations,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error fetching social data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}