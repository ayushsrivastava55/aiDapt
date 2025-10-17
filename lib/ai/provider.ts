import { setDefaultOpenAIKey } from "@openai/agents";

import { getRequiredServerEnv, hasEnv } from "@/lib/env";

let configured = false;

export const ensureOpenAIConfigured = () => {
  if (configured) {
    return;
  }

  const apiKey = getRequiredServerEnv("OPENAI_API_KEY");
  setDefaultOpenAIKey(apiKey);

  configured = true;
};

export const isOpenAIConfigured = () => hasEnv("OPENAI_API_KEY");
