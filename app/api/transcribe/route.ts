import { getLiveAIConfiguration, getOpenAIClient, missingKeyResponse, runOnce, safeApiErrorResponse } from "../../lib/openai-server";
import { normalizeProviderDiarizedTranscription, validateAudioFile } from "../../lib/audio-domain";

export const runtime = "nodejs";

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
  const validationError = validateAudioFile(value, configuration.maxAudioFileMb * 1024 * 1024);
  if (validationError) {
    return Response.json({ error: { code: "invalid_file", message: validationError } }, { status: 400 });
  }

  const client = getOpenAIClient();
  if (!client) return missingKeyResponse();
  try {
    const result = await runOnce(request.headers.get("x-calllens-request-id"), async () => {
      const transcription = await client.audio.transcriptions.create({
        file: value,
        model: configuration.transcriptionModel,
        response_format: "diarized_json",
        chunking_strategy: "auto",
      });
      return normalizeProviderDiarizedTranscription(transcription, { model: configuration.transcriptionModel });
    });
    if (result.duplicate) {
      return Response.json({ error: { code: "duplicate_submission", message: "This audio file is already being processed." } }, { status: 409 });
    }
    return Response.json({ transcription: result.value });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_diarized_transcription") {
      return Response.json(
        { error: { code: "invalid_transcription", message: "OpenAI returned an invalid diarized transcript. Nothing was displayed." } },
        { status: 502 },
      );
    }
    return safeApiErrorResponse(error);
  }
}
