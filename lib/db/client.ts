import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getRequiredServerEnv } from "@/lib/env";
import * as schema from "./schema";

const createDb = () => {
  const databaseUrl = getRequiredServerEnv("DATABASE_URL");
  const sql = neon(databaseUrl);

  return drizzle(sql, { schema });
};

let dbInstance: ReturnType<typeof createDb> | null = null;

export const getDb = () => {
  if (!dbInstance) {
    dbInstance = createDb();
  }

  return dbInstance;
};

export type Database = ReturnType<typeof getDb>;
