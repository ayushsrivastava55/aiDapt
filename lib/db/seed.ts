import "dotenv/config";
import { getDb } from "./client";
import { activities, skills, units } from "./schema";

async function seed() {
  const db = getDb();

  console.log("Starting database seed...");

  const [mathSkill] = await db
    .insert(skills)
    .values({
      name: "Basic Mathematics",
      description: "Fundamental math concepts and operations",
      level: 1,
    })
    .returning();

  console.log(`Created skill: ${mathSkill.name}`);

  const [scienceSkill] = await db
    .insert(skills)
    .values({
      name: "Science Fundamentals",
      description: "Core scientific principles and methods",
      level: 1,
    })
    .returning();

  console.log(`Created skill: ${scienceSkill.name}`);

  const [additionUnit] = await db
    .insert(units)
    .values({
      skillId: mathSkill.id,
      name: "Addition",
      description: "Learn to add numbers together",
      order: 1,
    })
    .returning();

  console.log(`Created unit: ${additionUnit.name}`);

  const [subtractionUnit] = await db
    .insert(units)
    .values({
      skillId: mathSkill.id,
      name: "Subtraction",
      description: "Learn to subtract numbers",
      order: 2,
    })
    .returning();

  console.log(`Created unit: ${subtractionUnit.name}`);

  const [scientificMethodUnit] = await db
    .insert(units)
    .values({
      skillId: scienceSkill.id,
      name: "Scientific Method",
      description: "Understanding the scientific process",
      order: 1,
    })
    .returning();

  console.log(`Created unit: ${scientificMethodUnit.name}`);

  await db.insert(activities).values([
    {
      unitId: additionUnit.id,
      name: "Single Digit Addition",
      description: "Practice adding single-digit numbers",
      type: "practice",
      order: 1,
      content: {
        problems: [
          { question: "3 + 5", answer: 8 },
          { question: "7 + 2", answer: 9 },
          { question: "4 + 6", answer: 10 },
        ],
      },
    },
    {
      unitId: additionUnit.id,
      name: "Double Digit Addition",
      description: "Practice adding double-digit numbers",
      type: "practice",
      order: 2,
      content: {
        problems: [
          { question: "23 + 15", answer: 38 },
          { question: "47 + 32", answer: 79 },
          { question: "56 + 28", answer: 84 },
        ],
      },
    },
    {
      unitId: additionUnit.id,
      name: "Addition Quiz",
      description: "Test your addition skills",
      type: "quiz",
      order: 3,
      content: {
        timeLimit: 300,
        passingScore: 70,
      },
    },
    {
      unitId: subtractionUnit.id,
      name: "Basic Subtraction",
      description: "Practice subtracting single-digit numbers",
      type: "practice",
      order: 1,
      content: {
        problems: [
          { question: "9 - 4", answer: 5 },
          { question: "7 - 3", answer: 4 },
          { question: "8 - 2", answer: 6 },
        ],
      },
    },
    {
      unitId: scientificMethodUnit.id,
      name: "Steps of Scientific Method",
      description: "Learn the key steps in scientific inquiry",
      type: "practice",
      order: 1,
      content: {
        steps: ["Observation", "Question", "Hypothesis", "Experiment", "Analysis", "Conclusion"],
      },
    },
  ]);

  console.log("Created activities");

  console.log("Seed completed successfully!");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
