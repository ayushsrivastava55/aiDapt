import { getDb } from "@/lib/db/client";
import { getOrCreateLearner } from "@/lib/session";
import { eq } from "drizzle-orm";
import { skillStates } from "@/lib/db/schema";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "mastered":
      return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-900/40";
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-900/40";
    case "review_needed":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-900/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-200 dark:border-gray-900/40";
  }
}

export default async function ProgressPage() {
  const db = getDb();
  const learner = await getOrCreateLearner();

  const states = await db.query.skillStates.findMany({
    where: eq(skillStates.learnerId, learner.id),
    with: {
      skill: true,
    },
    orderBy: (fields, operators) => [operators.desc(skillStates.updatedAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Your Progress</h2>
          <p className="text-sm text-muted-foreground">Track progress across skills. This is tied to your anonymous session.</p>
        </div>
        <Link className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium" href="/learn">
          Continue Learning
        </Link>
      </div>

      {states.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-surface/70 p-6">
          <p className="text-sm text-muted-foreground">No skills yet. Generate a course to begin.</p>
          <div>
            <Link className="rounded-md bg-foreground/10 px-3 py-2 text-sm" href="/">Create a course</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {states.map((s) => {
            const progressPct = Math.round((s.progress ?? 0) * 100);
            return (
              <div key={s.id} className="space-y-3 rounded-xl border border-border/60 bg-surface/70 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Skill</div>
                    <div className="text-lg font-semibold">{s.skill?.name ?? "Untitled"}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs ${statusBadgeClasses(s.status)}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{s.skill?.description}</p>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-foreground/10">
                    <div
                      className="h-2 rounded-full bg-foreground/70"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {new Date(s.updatedAt as unknown as string).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
