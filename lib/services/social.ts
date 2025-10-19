import { getDb } from "@/lib/db";

const db = getDb();
import {
  socialConnections,
  studyGroups,
  studyGroupMembers,
  sharedProgress,
  peerChallenges,
  learners,
  skillStates,
  type SocialConnection,
  type NewSocialConnection,
  type StudyGroup,
  type NewStudyGroup,
  type StudyGroupMember,
  type NewStudyGroupMember,
  type SharedProgress,
  type NewSharedProgress,
  type PeerChallenge,
  type NewPeerChallenge,
} from "@/lib/db/schema";
import { eq, and, or, desc, sql, count } from "drizzle-orm";

export interface SocialFeed {
  id: string;
  type: 'progress_share' | 'achievement' | 'challenge_completed' | 'group_activity';
  learnerName: string;
  content: string;
  metadata?: any;
  timestamp: Date;
  reactions?: Record<string, number>;
}

export interface StudyGroupInfo extends StudyGroup {
  memberCount: number;
  isJoined: boolean;
  recentActivity: string[];
}

export class SocialService {
  async sendFriendRequest(followerId: string, followeeId: string): Promise<SocialConnection> {
    const [connection] = await db.insert(socialConnections).values({
      followerId,
      followeeId,
      status: "pending",
    }).returning();

    return connection;
  }

  async acceptFriendRequest(followerId: string, followeeId: string): Promise<SocialConnection> {
    const [updated] = await db
      .update(socialConnections)
      .set({ status: "accepted" })
      .where(and(
        eq(socialConnections.followerId, followerId),
        eq(socialConnections.followeeId, followeeId)
      ))
      .returning();

    await db.insert(socialConnections).values({
      followerId: followeeId,
      followeeId: followerId,
      status: "accepted",
    });

    return updated;
  }

  async getFriends(learnerId: string): Promise<Array<{ id: string; name: string; status: string }>> {
    const friends = await db
      .select({
        id: learners.id,
        name: learners.displayName,
        status: socialConnections.status,
      })
      .from(socialConnections)
      .innerJoin(learners, eq(learners.id, socialConnections.followeeId))
      .where(and(
        eq(socialConnections.followerId, learnerId),
        eq(socialConnections.status, "accepted")
      ));

    return friends.map((f: any) => ({
      id: f.id,
      name: f.name || `User ${f.id.slice(0, 8)}`,
      status: f.status,
    }));
  }

  async shareProgress(
    learnerId: string,
    skillId: string,
    message: string,
    visibility: 'public' | 'friends' | 'group' = 'friends'
  ): Promise<SharedProgress> {
    const skillState = await db
      .select()
      .from(skillStates)
      .where(and(
        eq(skillStates.learnerId, learnerId),
        eq(skillStates.skillId, skillId)
      ))
      .limit(1);

    const progressSnapshot = skillState[0] ? {
      progress: skillState[0].progress,
      status: skillState[0].status,
      masteryScore: skillState[0].masteryScore,
    } : null;

    const [shared] = await db.insert(sharedProgress).values({
      learnerId,
      skillId,
      progressSnapshot,
      message,
      visibility,
      reactions: {},
    }).returning();

    return shared;
  }

  async getSocialFeed(learnerId: string, limit = 20): Promise<SocialFeed[]> {
    const friends = await this.getFriends(learnerId);
    const friendIds = friends.map(f => f.id);

    const progressShares = await db
      .select({
        id: sharedProgress.id,
        learnerName: learners.displayName,
        message: sharedProgress.message,
        progressSnapshot: sharedProgress.progressSnapshot,
        reactions: sharedProgress.reactions,
        sharedAt: sharedProgress.sharedAt,
      })
      .from(sharedProgress)
      .innerJoin(learners, eq(learners.id, sharedProgress.learnerId))
      .where(or(
        eq(sharedProgress.visibility, "public"),
        and(
          eq(sharedProgress.visibility, "friends"),
          sql`${sharedProgress.learnerId} IN (${friendIds.map(id => `'${id}'`).join(',')})`
        )
      ))
      .orderBy(desc(sharedProgress.sharedAt))
      .limit(limit);

    return progressShares.map((share: any) => ({
      id: share.id,
      type: 'progress_share' as const,
      learnerName: share.learnerName || `User ${share.id.slice(0, 8)}`,
      content: share.message || "Shared learning progress",
      metadata: share.progressSnapshot,
      timestamp: share.sharedAt,
      reactions: share.reactions as Record<string, number> || {},
    }));
  }

  async createStudyGroup(
    creatorId: string,
    name: string,
    description: string,
    isPublic = true,
    maxMembers = 50,
    focusSkills: string[] = []
  ): Promise<StudyGroup> {
    const [group] = await db.insert(studyGroups).values({
      name,
      description,
      creatorId,
      isPublic: isPublic ? 1 : 0,
      maxMembers,
      focusSkills,
    }).returning();

    await db.insert(studyGroupMembers).values({
      groupId: group.id,
      learnerId: creatorId,
      role: "admin",
    });

    return group;
  }

  async joinStudyGroup(groupId: string, learnerId: string): Promise<StudyGroupMember> {
    const group = await db
      .select()
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId))
      .limit(1);

    if (!group[0]) {
      throw new Error("Study group not found");
    }

    if ((group[0].currentMembers || 0) >= (group[0].maxMembers || 50)) {
      throw new Error("Study group is full");
    }

    const [member] = await db.insert(studyGroupMembers).values({
      groupId,
      learnerId,
      role: "member",
    }).returning();

    await db
      .update(studyGroups)
      .set({ currentMembers: (group[0].currentMembers || 0) + 1 })
      .where(eq(studyGroups.id, groupId));

    return member;
  }

  async getStudyGroups(learnerId: string): Promise<StudyGroupInfo[]> {
    const groups = await db
      .select({
        id: studyGroups.id,
        name: studyGroups.name,
        description: studyGroups.description,
        creatorId: studyGroups.creatorId,
        isPublic: studyGroups.isPublic,
        maxMembers: studyGroups.maxMembers,
        currentMembers: studyGroups.currentMembers,
        focusSkills: studyGroups.focusSkills,
        metadata: studyGroups.metadata,
        createdAt: studyGroups.createdAt,
        updatedAt: studyGroups.updatedAt,
        isJoined: sql<number>`CASE WHEN ${studyGroupMembers.learnerId} IS NOT NULL THEN 1 ELSE 0 END`,
      })
      .from(studyGroups)
      .leftJoin(studyGroupMembers, and(
        eq(studyGroupMembers.groupId, studyGroups.id),
        eq(studyGroupMembers.learnerId, learnerId)
      ))
      .where(eq(studyGroups.isPublic, 1))
      .orderBy(desc(studyGroups.updatedAt));

    return groups.map((group: any) => ({
      ...group,
      memberCount: group.currentMembers,
      isJoined: group.isJoined === 1,
      recentActivity: [], // TODO: Implement activity tracking
    }));
  }

  async createPeerChallenge(
    challengerId: string,
    challengeeId: string,
    skillId: string,
    challengeType: string,
    targetScore?: number,
    deadline?: Date
  ): Promise<PeerChallenge> {
    const [challenge] = await db.insert(peerChallenges).values({
      challengerId,
      challengeeId,
      skillId,
      challengeType,
      targetScore,
      deadline,
      status: "pending",
    }).returning();

    return challenge;
  }

  async acceptChallenge(challengeId: string): Promise<PeerChallenge> {
    const [updated] = await db
      .update(peerChallenges)
      .set({ status: "active" })
      .where(eq(peerChallenges.id, challengeId))
      .returning();

    return updated;
  }

  async completeChallenge(
    challengeId: string,
    winnerIds: string[]
  ): Promise<PeerChallenge> {
    const [updated] = await db
      .update(peerChallenges)
      .set({
        status: "completed",
        winnerIds,
        completedAt: new Date(),
      })
      .where(eq(peerChallenges.id, challengeId))
      .returning();

    return updated;
  }

  async getPeerChallenges(learnerId: string): Promise<PeerChallenge[]> {
    return await db
      .select()
      .from(peerChallenges)
      .where(or(
        eq(peerChallenges.challengerId, learnerId),
        eq(peerChallenges.challengeeId, learnerId)
      ))
      .orderBy(desc(peerChallenges.createdAt));
  }

  async addReactionToProgress(
    progressId: string,
    reaction: string,
    learnerId: string
  ): Promise<void> {
    const [progress] = await db
      .select()
      .from(sharedProgress)
      .where(eq(sharedProgress.id, progressId))
      .limit(1);

    if (!progress) {
      throw new Error("Progress share not found");
    }

    const reactions = progress.reactions as Record<string, string[]> || {};

    if (!reactions[reaction]) {
      reactions[reaction] = [];
    }

    if (!reactions[reaction].includes(learnerId)) {
      reactions[reaction].push(learnerId);
    }

    await db
      .update(sharedProgress)
      .set({ reactions })
      .where(eq(sharedProgress.id, progressId));
  }

  async getLeaderboard(skillId?: string, timeframe = 30): Promise<Array<{
    learnerId: string;
    learnerName: string;
    totalXp: number;
    rank: number;
  }>> {
    const query = db
      .select({
        learnerId: learners.id,
        learnerName: learners.displayName,
        totalXp: learners.totalXp,
      })
      .from(learners)
      .orderBy(desc(learners.totalXp))
      .limit(50);

    const results = await query;

    return results.map((result: any, index: number) => ({
      learnerId: result.learnerId,
      learnerName: result.learnerName || `User ${result.learnerId.slice(0, 8)}`,
      totalXp: result.totalXp || 0,
      rank: index + 1,
    }));
  }

  async getCollaborativeRecommendations(learnerId: string): Promise<{
    suggestedFriends: Array<{ id: string; name: string; commonSkills: number }>;
    recommendedGroups: Array<{ id: string; name: string; matchScore: number }>;
    activeChallenges: number;
  }> {
    const friends = await this.getFriends(learnerId);
    const groups = await this.getStudyGroups(learnerId);
    const challenges = await this.getPeerChallenges(learnerId);

    const activeChallenges = challenges.filter(c => c.status === "active" || c.status === "pending").length;

    return {
      suggestedFriends: [], // TODO: Implement friend suggestions based on similar skills
      recommendedGroups: groups.filter((g: any) => !g.isJoined).slice(0, 5).map((g: any) => ({ id: g.id, name: g.name, matchScore: 0.8 })),
      activeChallenges,
    };
  }
}