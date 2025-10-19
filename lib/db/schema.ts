import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const activityTypeEnum = pgEnum("activity_type", ["practice", "quiz", "test", "challenge", "adaptive_review", "spaced_repetition"]);

export const skillStateStatusEnum = pgEnum("skill_state_status", [
  "not_started",
  "in_progress",
  "mastered",
  "review_needed",
  "forgotten",
  "strengthening",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "completed",
  "abandoned",
  "timed_out",
]);

export const learners = pgTable("learners", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).unique().notNull(),
  displayName: varchar("display_name", { length: 128 }),
  email: varchar("email", { length: 255 }),
  avatar: text("avatar"),
  preferences: jsonb("preferences"),
  learningStyle: varchar("learning_style", { length: 50 }),
  timezone: varchar("timezone", { length: 50 }),
  streakCount: integer("streak_count").default(0),
  totalXp: integer("total_xp").default(0),
  level: integer("level").default(1),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  level: integer("level").notNull().default(1),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    order: integer("order").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    skillIdIdx: index("units_skill_id_idx").on(table.skillId),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: activityTypeEnum("type").notNull().default("practice"),
    order: integer("order").notNull().default(0),
    content: jsonb("content"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    unitIdIdx: index("activities_unit_id_idx").on(table.unitId),
  }),
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    score: real("score"),
    maxScore: real("max_score"),
    response: jsonb("response"),
    feedback: jsonb("feedback"),
    metadata: jsonb("metadata"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    learnerIdIdx: index("attempts_learner_id_idx").on(table.learnerId),
    activityIdIdx: index("attempts_activity_id_idx").on(table.activityId),
  }),
);

export const skillStates = pgTable(
  "skill_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    status: skillStateStatusEnum("status").notNull().default("not_started"),
    progress: real("progress").notNull().default(0),
    masteryScore: real("mastery_score"),
    stability: real("stability").default(2.5),
    difficulty: real("difficulty").default(0),
    retrievability: real("retrievability").default(0.9),
    lapses: integer("lapses").default(0),
    reps: integer("reps").default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    learnerSkillUnique: uniqueIndex("skill_states_learner_id_skill_id_unique").on(
      table.learnerId,
      table.skillId,
    ),
    statusIdx: index("skill_states_status_idx").on(table.status),
  }),
);

export const learnersRelations = relations(learners, ({ many }) => ({
  attempts: many(attempts),
  skillStates: many(skillStates),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  units: many(units),
  skillStates: many(skillStates),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  skill: one(skills, {
    fields: [units.skillId],
    references: [skills.id],
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  unit: one(units, {
    fields: [activities.unitId],
    references: [units.id],
  }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  learner: one(learners, {
    fields: [attempts.learnerId],
    references: [learners.id],
  }),
  activity: one(activities, {
    fields: [attempts.activityId],
    references: [activities.id],
  }),
}));

export const skillStatesRelations = relations(skillStates, ({ one }) => ({
  learner: one(learners, {
    fields: [skillStates.learnerId],
    references: [learners.id],
  }),
  skill: one(skills, {
    fields: [skillStates.skillId],
    references: [skills.id],
  }),
}));

export type Learner = typeof learners.$inferSelect;
export type NewLearner = typeof learners.$inferInsert;

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;

export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 100 }),
  type: varchar("type", { length: 50 }).notNull(),
  requirement: jsonb("requirement"),
  xpReward: integer("xp_reward").default(0),
  rarity: varchar("rarity", { length: 20 }).default("common"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const learnerAchievements = pgTable(
  "learner_achievements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    learnerAchievementUnique: uniqueIndex("learner_achievements_learner_id_achievement_id_unique").on(
      table.learnerId,
      table.achievementId,
    ),
  }),
);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  duration: integer("duration"),
  xpEarned: integer("xp_earned").default(0),
  activitiesCompleted: integer("activities_completed").default(0),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const learningAnalytics = pgTable("learning_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }).notNull(),
  timeSpent: integer("time_spent").default(0),
  activitiesCompleted: integer("activities_completed").default(0),
  xpEarned: integer("xp_earned").default(0),
  streakMaintained: integer("streak_maintained").default(0),
  averageScore: real("average_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SkillState = typeof skillStates.$inferSelect;
export type NewSkillState = typeof skillStates.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;

export type LearnerAchievement = typeof learnerAchievements.$inferSelect;
export type NewLearnerAchievement = typeof learnerAchievements.$inferInsert;

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;

export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    followerFolloweeUnique: uniqueIndex("social_connections_follower_id_followee_id_unique").on(
      table.followerId,
      table.followeeId,
    ),
  }),
);

export const studyGroups = pgTable("study_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  isPublic: integer("is_public").default(1),
  maxMembers: integer("max_members").default(50),
  currentMembers: integer("current_members").default(1),
  focusSkills: jsonb("focus_skills"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const studyGroupMembers = pgTable(
  "study_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => studyGroups.id, { onDelete: "cascade" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    groupMemberUnique: uniqueIndex("study_group_members_group_id_learner_id_unique").on(
      table.groupId,
      table.learnerId,
    ),
  }),
);

export const sharedProgress = pgTable("shared_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  progressSnapshot: jsonb("progress_snapshot"),
  message: text("message"),
  visibility: varchar("visibility", { length: 20 }).notNull().default("friends"),
  reactions: jsonb("reactions"),
  sharedAt: timestamp("shared_at", { withTimezone: true }).defaultNow().notNull(),
});

export const peerChallenges = pgTable("peer_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengerId: uuid("challenger_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  challengeeId: uuid("challengee_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  challengeType: varchar("challenge_type", { length: 50 }).notNull(),
  targetScore: real("target_score"),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  winnerIds: jsonb("winner_ids"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type LearningAnalytics = typeof learningAnalytics.$inferSelect;
export type NewLearningAnalytics = typeof learningAnalytics.$inferInsert;

export type SocialConnection = typeof socialConnections.$inferSelect;
export type NewSocialConnection = typeof socialConnections.$inferInsert;

export type StudyGroup = typeof studyGroups.$inferSelect;
export type NewStudyGroup = typeof studyGroups.$inferInsert;

export type StudyGroupMember = typeof studyGroupMembers.$inferSelect;
export type NewStudyGroupMember = typeof studyGroupMembers.$inferInsert;

export type SharedProgress = typeof sharedProgress.$inferSelect;
export type NewSharedProgress = typeof sharedProgress.$inferInsert;

export const studyRooms = pgTable("study_rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  hostId: uuid("host_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  maxParticipants: integer("max_participants").default(20),
  currentParticipants: integer("current_participants").default(0),
  isActive: integer("is_active").default(1),
  requireCamera: integer("require_camera").default(1),
  requireMicrophone: integer("require_microphone").default(0),
  attentionThreshold: real("attention_threshold").default(0.7),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const studyRoomParticipants = pgTable(
  "study_room_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull().default("participant"),
    attentionScore: real("attention_score").default(0),
    focusTime: integer("focus_time").default(0),
    totalTime: integer("total_time").default(0),
    isPresent: integer("is_present").default(1),
    cameraEnabled: integer("camera_enabled").default(0),
    microphoneEnabled: integer("microphone_enabled").default(0),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => ({
    roomParticipantUnique: uniqueIndex("study_room_participants_room_id_learner_id_unique").on(
      table.roomId,
      table.learnerId,
    ),
  }),
);

export const attentionLogs = pgTable("attention_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => studyRoomParticipants.id, { onDelete: "cascade" }),
  attentionScore: real("attention_score").notNull(),
  faceDetected: integer("face_detected").notNull(),
  eyesDetected: integer("eyes_detected").notNull(),
  headPose: jsonb("head_pose"),
  emotionData: jsonb("emotion_data"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const voiceInteractions = pgTable("voice_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => studyRooms.id, { onDelete: "cascade" }),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  query: text("query"),
  response: text("response"),
  duration: integer("duration"),
  confidence: real("confidence"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PeerChallenge = typeof peerChallenges.$inferSelect;
export type NewPeerChallenge = typeof peerChallenges.$inferInsert;

export type StudyRoom = typeof studyRooms.$inferSelect;
export type NewStudyRoom = typeof studyRooms.$inferInsert;

export type StudyRoomParticipant = typeof studyRoomParticipants.$inferSelect;
export type NewStudyRoomParticipant = typeof studyRoomParticipants.$inferInsert;

export type AttentionLog = typeof attentionLogs.$inferSelect;
export type NewAttentionLog = typeof attentionLogs.$inferInsert;

export type VoiceInteraction = typeof voiceInteractions.$inferSelect;
export type NewVoiceInteraction = typeof voiceInteractions.$inferInsert;
