import { getLiveAIConfiguration } from "../../lib/openai-server";

export const runtime = "nodejs";

export async function GET() {
  const configuration = getLiveAIConfiguration();
  return Response.json({
    transcriptionConfigured: configuration.configured,
    analysisConfigured: configuration.configured,
    transcriptionModel: configuration.transcriptionModel,
    maxAudioFileMb: configuration.maxAudioFileMb,
  }, {
    headers: { "cache-control": "no-store" },
  });
}
