import { getLiveAIConfiguration, getOpenAIClient, missingKeyResponse, runOnce, safeApiErrorResponse } from "../../lib/openai-server";
import { transcriptSegmentSchema, validateAudioFile } from "../../lib/domain";

export const runtime = "nodejs";

type RawTranscription = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start?: number; end?: number; speaker?: string; text?: string }>;
};

export async function POST(request: Request) {
  const configuration = getLiveAIConfiguration();
  if (!configuration.configured) return missingKeyResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: { code: "invalid_upload", message: "The audio upload could not be read." } }, { status: 400 });
  }
  const value = form.get("audio");
  if (!(value instanceof File)) {
    return Response.json({ error: { code: "missing_file", message: "Choose an audio file to transcribe." } }, { status: 400 });
  }
  const validationError = validateAudioFile(value);
  if (validationError) {
    return Response.json({ error: { code: "invalid_file", message: validationError } }, { status: 400 });
  }

  const client = getOpenAIClient();
  if (!client) return missingKeyResponse();
  const startedAt = Date.now();

  try {
    const result = await runOnce(request.headers.get("x-calllens-request-id"), async () => {
      const transcription = await client.audio.transcriptions.create({
        file: value,
        model: configuration.transcriptionModel,
        response_format: "json",
      });
      const raw = transcription as unknown as RawTranscription;
      if (!raw.text?.trim()) throw new Error("empty_transcription");
      const segments = (raw.segments ?? []).map((segment) => ({
        start: typeof segment.start === "number" ? segment.start : null,
        end: typeof segment.end === "number" ? segment.end : null,
        speaker: segment.speaker?.trim() || "Unknown",
        text: segment.text?.trim() || "",
      })).filter((segment) => transcriptSegmentSchema.safeParse(segment).success);
      return {
        transcript: raw.text.trim(),
        detectedLanguage: raw.language?.trim() || null,
        durationSeconds: raw.duration ?? (Date.now() - startedAt) / 1000,
        durationSource: raw.duration === undefined ? "processing" as const : "audio" as const,
        segments,
        fileName: value.name,
      };
    });
    if (result.duplicate) {
      return Response.json({ error: { code: "duplicate_submission", message: "This audio file is already being processed." } }, { status: 409 });
    }
    return Response.json({ transcription: result.value });
  } catch (error) {
    return safeApiErrorResponse(error);
  }
}
