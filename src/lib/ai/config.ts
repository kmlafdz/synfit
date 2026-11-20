/**
 * SYNFIT AI FOUNDATION - CONFIGURATION BOUNDARY
 * Safe, validated configuration access for future AI integrations.
 * Strictly prevents secret leaks to the client browser bundle.
 */

export interface AIProviderConfig {
  provider: "gemini" | "local" | "none";
  apiKey?: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  rateLimitPerMinute: number;
}

/**
 * Returns server-side verified AI configuration.
 * Must only be called in server environments (API routes / server actions).
 */
export function getAIServerConfig(): AIProviderConfig {
  const isServer = typeof window === "undefined";
  if (!isServer) {
    throw new Error("getAIServerConfig must never be invoked in client-side bundles.");
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.FIREBASE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";
  const provider = apiKey ? "gemini" : "none";

  return {
    provider,
    apiKey: apiKey || undefined,
    model: process.env.AI_MODEL_NAME || "gemini-3.8-flash",
    temperature: 0.2, // Low temperature for deterministic fitness/business advice
    maxOutputTokens: 1024,
    rateLimitPerMinute: 20,
  };
}
