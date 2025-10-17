import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getOrCreateLearner } from "@/lib/session";
import { getDb } from "@/lib/db/client";
import {
  activities,
  skillStates,
  units,
  type Activity,
  type Skill,
  type SkillState,
  type Unit,
} from "@/lib/db/schema";
import {
  getActivityState,
  isDueForReview,
  type SkillSRSMetadata,
} from "@/lib/srs";

export const dynamic = "force-dynamic";

type CandidateActivity = {
  activity: Activity;
  unit: Unit;
  skill: Skill;
  skillState: SkillState;
  metadata: SkillSRSMetadata | undefined;
  level: number;
  nextReviewAt: string;
  lastAttemptAt: string;
  isDue: boolean;
  unitOrder: number;
  activityOrder: number;
};

function compareCandidates(a: CandidateActivity, b: CandidateActivity): number {
  if (a.isDue && !b.isDue) {
    return -1;
  }

  if (!a.isDue && b.isDue) {
    return 1;
  }

  if (a.isDue && b.isDue) {
    if (a.level !== b.level) {
      return a.level - b.level;
    }

    const aReview = new Date(a.nextReviewAt).getTime();
    const bReview = new Date(b.nextReviewAt).getTime();
    if (aReview !== bReview) {
      return aReview - bReview;
    }
  } else {
    const aReview = new Date(a.nextReviewAt).getTime();
    const bReview = new Date(b.nextReviewAt).getTime();
    if (aReview !== bReview) {
      return aReview - bReview;
    }
  }

  if (a.unitOrder !== b.unitOrder) {
    return a.unitOrder - b.unitOrder;
  }

  if (a.activityOrder !== b.activityOrder) {
    return a.activityOrder - b.activityOrder;
  }

  return a.activity.name.localeCompare(b.activity.name);
}

export async function GET() {
  try {
    const learner = await getOrCreateLearner();
    const db = getDb();

    const skillStateRecords = await db.query.skillStates.findMany({
      where: eq(skillStates.learnerId, learner.id),
      with: {
        skill: {
          with: {
            units: {
              with: {
                activities: true,
              },
            },
          },
        },
      },
      orderBy: (fields, operators) => [operators.asc(skillStates.updatedAt)],
    });

    const candidates: CandidateActivity[] = [];
    const now = new Date();

    for (const state of skillStateRecords) {
      const metadata = (state.metadata as SkillSRSMetadata | null) ?? undefined;
      const skill = state.skill;

      if (!skill || !skill.units || skill.units.length === 0) {
        continue;
      }

      for (const unit of skill.units) {
        if (!unit.activities || unit.activities.length === 0) {
          continue;
        }

        for (const activity of unit.activities) {
          const activityState = getActivityState(metadata, activity.id);
          const isDue = isDueForReview(activityState.nextReviewAt, now);

          candidates.push({
            activity,
            unit,
            skill,
            skillState: state,
            metadata,
            level: activityState.level,
            nextReviewAt: activityState.nextReviewAt,
            lastAttemptAt: activityState.lastAttemptAt,
            isDue,
            unitOrder: unit.order ?? 0,
            activityOrder: activity.order ?? 0,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          activity: null,
          reason: "no-activities",
        },
        { status: 200 },
      );
    }

    candidates.sort(compareCandidates);
    const [chosen] = candidates;

    return NextResponse.json(
      {
        activity: {
          id: chosen.activity.id,
          name: chosen.activity.name,
          description: chosen.activity.description,
          type: chosen.activity.type,
          content: chosen.activity.content,
          metadata: chosen.activity.metadata,
          order: chosen.activity.order,
          unit: {
            id: chosen.unit.id,
            name: chosen.unit.name,
            description: chosen.unit.description,
            order: chosen.unit.order,
          },
          skill: {
            id: chosen.skill.id,
            name: chosen.skill.name,
            description: chosen.skill.description,
            level: chosen.skill.level,
          },
        },
        scheduling: {
          level: chosen.level,
          nextReviewAt: chosen.nextReviewAt,
          lastAttemptAt: chosen.lastAttemptAt,
          isDue: chosen.isDue,
          reason: chosen.isDue ? "due" : "upcoming",
        },
        skillState: {
          id: chosen.skillState.id,
          status: chosen.skillState.status,
          progress: chosen.skillState.progress,
          masteryScore: chosen.skillState.masteryScore,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error determining next activity:", error);
    return NextResponse.json(
      {
        error: "failed_to_determine_next_activity",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
