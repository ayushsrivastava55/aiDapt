type EnvKey = "OPENAI_API_KEY" | "DATABASE_URL";

type EnvRecord = Record<EnvKey, string | undefined>;

const readEnv = (): EnvRecord => ({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
});

export const env: EnvRecord = readEnv();

export const getRequiredServerEnv = (key: EnvKey): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Create a .env file (see .env.example) and define the value before running the app.`,
    );
  }

  return value;
};

export const hasEnv = (key: EnvKey): boolean => {
  const value = process.env[key];
  return typeof value === "string" && value.length > 0;
};
