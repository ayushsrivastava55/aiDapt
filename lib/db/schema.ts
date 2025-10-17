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

export const activityTypeEnum = pgEnum("activity_type", ["practice", "quiz", "test", "challenge"]);

export const skillStateStatusEnum = pgEnum("skill_state_status", [
  "not_started",
  "in_progress",
  "mastered",
  "review_needed",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const learners = pgTable("learners", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).unique().notNull(),
  displayName: varchar("display_name", { length: 128 }),
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

export type SkillState = typeof skillStates.$inferSelect;
export type NewSkillState = typeof skillStates.$inferInsert;
