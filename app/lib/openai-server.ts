import OpenAI from "openai";
import { LIVE_AI_MISSING_MESSAGE } from "./domain";

export function getLiveAIConfiguration() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  return {
    configured: apiKey.length > 0,
    apiKey,
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-5.6-terra",
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-transcribe",
  };
}

export function getOpenAIClient() {
  const configuration = getLiveAIConfiguration();
  if (!configuration.configured) return null;
  return new OpenAI({
    apiKey: configuration.apiKey,
    timeout: 45_000,
    maxRetries: 1,
  });
}

export function missingKeyResponse() {
  return Response.json(
    { error: { code: "live_ai_not_configured", message: LIVE_AI_MISSING_MESSAGE } },
    { status: 503 },
  );
}

export function safeApiErrorResponse(error: unknown) {
  const status = error instanceof OpenAI.APIError ? error.status : undefined;
  if (status === 429) {
    return Response.json({ error: { code: "rate_limited", message: "Live AI is busy. Please wait a moment and try again." } }, { status: 429 });
  }
  if (status === 401 || status === 403 || status === 404) {
    return Response.json({ error: { code: "model_access", message: "The configured OpenAI model or API key is not available to this project." } }, { status: 502 });
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return Response.json({ error: { code: "timeout", message: "The live AI request timed out. Please try again." } }, { status: 504 });
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return Response.json({ error: { code: "network", message: "CallLens could not reach OpenAI. Check the connection and try again." } }, { status: 502 });
  }
  return Response.json({ error: { code: "live_ai_error", message: "Live AI could not complete this request. Please try again." } }, { status: 502 });
}

const activeSubmissions = new Set<string>();

export async function runOnce<T>(requestId: string | null, operation: () => Promise<T>) {
  if (requestId && activeSubmissions.has(requestId)) {
    return { duplicate: true as const, value: null };
  }
  if (requestId) activeSubmissions.add(requestId);
  try {
    return { duplicate: false as const, value: await operation() };
  } finally {
    if (requestId) activeSubmissions.delete(requestId);
  }
}
