import { zodTextFormat } from "openai/helpers/zod";
import { getLiveAIConfiguration, getOpenAIClient, missingKeyResponse, runOnce, safeApiErrorResponse } from "../../lib/openai-server";
import {
  ARABIC_VAD_SETTINGS,
  applyHighConfidenceSegmentCorrections,
  arabicEnrichmentResponseSchema,
  arabicIntelligenceMetadataSchema,
  createDeterministicArabicIntelligence,
  createRawProviderTranscriptSnapshot,
  parseTranscriptionRequestSettings,
  resolveOptionalArabicEnrichment,
  type ArabicEnrichmentResponse,
  type TranscriptSnapshot,
  type TranscriptionDialectHint,
  type WorkspaceVocabulary,
} from "../../lib/arabic-intelligence.ts";
import { markTemporaryAudioDeleted, prepareAudioForTranscription } from "../../lib/audio-preprocessing.ts";
import { InvalidDiarizedTranscriptionError, applyArabicIntelligence, normalizeProviderDiarizedTranscription, validateAudioFile } from "../../lib/audio-domain";

export const runtime = "nodejs";

const arabicEnrichmentInstructions = `You are the optional Arabic Transcription Intelligence enrichment stage for a contact-centre transcript.
Return only conservative, evidence-linked linguistic observations using the supplied segment IDs.
Classify broad dialect families only: Egyptian, Gulf, Levantine, Sudanese, Yemeni, Modern Standard Arabic, Mixed Arabic, or Uncertain.
Never infer nationality, ethnicity, religion, identity, or origin. Low-confidence dialect evidence must be Uncertain with alternatives.
The selected dialect is a user-provided linguistic hint, not proof. Auto Detect must not be treated as Egyptian. If evidence is weak, return Uncertain.
Segment corrections are optional. Return an empty segmentCorrections array unless the error is obvious and confidence is at least 0.95.
For obvious_recognition corrections, confidence must be at least 0.98 and the selected dialect must be Egyptian Arabic.
originalText must exactly match the supplied raw segment. correctedText may change only an obvious recognition error, punctuation, spacing, or an approved vocabulary form.
Never rewrite, translate into Modern Standard Arabic, formalize, summarize, add missing speech, or paraphrase transcript text.
Preserve Egyptian colloquial expressions, Arabic-English code switching, and every existing Latin-script term exactly.
Use nearby segments only as supporting context. Every correction must reference its own segment plus any nearby evidence segments used.
Do not label approved English vocabulary as a mistake or convert an approved Latin term to Arabic script.
Code-switching observations must name the scripts/languages actually present and list preserved Latin terms when supported.
Unclear, overlap, or laughter annotations require explicit transcript evidence or timestamp evidence. Never infer laughter from tone.
Every observation and annotation must reference valid supplied segment IDs. Use source ai_inference for all returned items.`;

function logTranscriptionResponseShape(value: unknown) {
  if (process.env.NODE_ENV === "production") return;
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const segments = Array.isArray(record.segments) ? record.segments : [];
  const first = segments[0] && typeof segments[0] === "object" ? segments[0] as Record<string, unknown> : {};
  const last = segments.at(-1) && typeof segments.at(-1) === "object" ? segments.at(-1) as Record<string, unknown> : {};
  console.info("[CallLens] OpenAI transcription response diagnostics", {
    keys: Object.keys(record).sort(),
    segmentCount: segments.length,
    segmentKeys: Object.keys(first).sort(),
    firstStart: typeof first.start === "number" ? first.start : null,
    lastEnd: typeof last.end === "number" ? last.end : null,
    hasText: typeof record.text === "string" && record.text.length > 0,
    hasDuration: typeof record.duration === "number",
    usageType: record.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>).type ?? null : null,
  });
}

async function enrichArabicTranscript(
  client: NonNullable<ReturnType<typeof getOpenAIClient>>,
  model: string,
  transcript: TranscriptSnapshot,
  selectedDialect: TranscriptionDialectHint,
  vocabulary: WorkspaceVocabulary,
): Promise<ArabicEnrichmentResponse> {
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "low" },
    input: [
      { role: "developer", content: arabicEnrichmentInstructions },
      {
        role: "user",
        content: JSON.stringify({
          selectedDialect,
          approvedVocabulary: vocabulary.entries.map(({ canonicalForm, aliases, category, preferredScript, context }) => ({
            canonicalForm,
            aliases,
            category,
            preferredScript,
            context,
          })),
          segments: transcript.segments.map(({ id, speakerId, start, end, text }) => ({ id, speakerId, start, end, text })),
          constraint: "Correct only high-confidence recognition, punctuation, spacing, or configured vocabulary errors. Otherwise preserve raw wording. Interpret language only; never infer personal identity or origin.",
        }),
      },
    ],
    text: { format: zodTextFormat(arabicEnrichmentResponseSchema, "arabic_transcription_enrichment") },
  }, { timeout: 15_000, maxRetries: 0 });
  const parsed = arabicEnrichmentResponseSchema.parse(response.output_parsed);
  return arabicEnrichmentResponseSchema.parse({
    segmentCorrections: parsed.segmentCorrections.map((item) => ({ ...item, source: "ai_inference" })),
    dialectObservations: parsed.dialectObservations.map((item) => ({ ...item, source: "ai_inference" })),
    codeSwitchingObservations: parsed.codeSwitchingObservations.map((item) => ({ ...item, source: "ai_inference" })),
    annotations: parsed.annotations.map((item) => ({ ...item, source: "ai_inference" })),
  });
}

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

  const requestSettings = parseTranscriptionRequestSettings(form);
  if (!requestSettings.success) {
    const messages = {
      invalid_mode: "Choose a supported transcription mode.",
      invalid_dialect: "Choose a supported Arabic dialect hint.",
      invalid_vocabulary: "The workspace vocabulary configuration is invalid.",
    } as const;
    return Response.json({ error: { code: requestSettings.code, message: messages[requestSettings.code] } }, { status: 400 });
  }
  const { mode, selectedDialect, preprocessingRequested, vocabulary } = requestSettings.data;

  const client = getOpenAIClient();
  if (!client) return missingKeyResponse();
  try {
    const result = await runOnce(request.headers.get("x-calllens-request-id"), async () => {
      const prepared = await prepareAudioForTranscription(value, preprocessingRequested);
      let preprocessing = prepared.diagnostic;
      let transcription: Awaited<ReturnType<typeof client.audio.transcriptions.create>>;
      try {
        transcription = await client.audio.transcriptions.create({
          file: prepared.file,
          model: configuration.transcriptionModel,
          response_format: "diarized_json",
          // The diarized model accepts ISO language and VAD controls, but not prompts or vocabulary guidance.
          chunking_strategy: mode === "arabic_intelligence"
            ? ARABIC_VAD_SETTINGS
            : "auto",
          ...(mode === "arabic_intelligence" ? { language: "ar" } : {}),
        });
      } finally {
        try {
          await prepared.cleanup();
          preprocessing = markTemporaryAudioDeleted(preprocessing);
        } catch {
          preprocessing = arabicIntelligenceMetadataSchema.shape.preprocessing.parse({
            ...preprocessing,
            status: "fallback",
            temporaryFilesDeleted: false,
            reason: "Temporary preprocessing cleanup could not be confirmed; transcription used the original-safe fallback.",
          });
        }
      }
      logTranscriptionResponseShape(transcription);
      const normalized = normalizeProviderDiarizedTranscription(transcription, { model: configuration.transcriptionModel });
      if (mode === "standard") return normalized;

      const rawProviderTranscript = createRawProviderTranscriptSnapshot(transcription);
      const deterministic = createDeterministicArabicIntelligence(rawProviderTranscript, vocabulary, preprocessing, selectedDialect);
      const metadata = await resolveOptionalArabicEnrichment(
        deterministic.metadata,
        rawProviderTranscript,
        configuration.analysisModel,
        () => enrichArabicTranscript(client, configuration.analysisModel, rawProviderTranscript, selectedDialect, vocabulary),
      );
      if (metadata.enrichment.status === "fallback") {
        console.warn("[CallLens] Arabic enrichment fallback", { reason: metadata.enrichment.reason });
      }
      const corrected = applyHighConfidenceSegmentCorrections(
        deterministic.rawTranscript,
        deterministic.enhancedTranscript,
        metadata.transcriptCorrections,
        vocabulary,
        selectedDialect,
      );
      const finalMetadata = arabicIntelligenceMetadataSchema.parse({
        ...metadata,
        transcriptCorrections: corrected.transcriptCorrections,
        vocabularyChanges: corrected.vocabularyChanges,
      });
      return applyArabicIntelligence(normalized, deterministic.rawTranscript, corrected.enhancedTranscript, finalMetadata);
    });
    if (result.duplicate) {
      return Response.json({ error: { code: "duplicate_submission", message: "This audio file is already being processed." } }, { status: 409 });
    }
    return Response.json({ transcription: result.value });
  } catch (error) {
    if (error instanceof InvalidDiarizedTranscriptionError || (error instanceof Error && error.message === "invalid_diarized_transcription")) {
      if (error instanceof InvalidDiarizedTranscriptionError) {
        console.error("[CallLens] Rejected OpenAI diarized transcription:", error.issues);
      }
      return Response.json(
        { error: { code: "invalid_transcription", message: "OpenAI returned an invalid diarized transcript. Nothing was displayed." } },
        { status: 502 },
      );
    }
    return safeApiErrorResponse(error);
  }
}
