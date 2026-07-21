import { z } from "zod";

export const SPEAKER_ROLES = ["agent", "customer", "unknown"] as const;
export const speakerRoleSchema = z.enum(SPEAKER_ROLES);

export const audioTranscriptSegmentSchema = z
  .object({
    id: z.string().trim().min(1),
    speakerId: z.string().trim().min(1),
    role: speakerRoleSchema,
    start: z.number().finite().min(0),
    end: z.number().finite().min(0),
    text: z.string().trim().min(1),
    originalText: z.string().trim().min(1),
    editedText: z.string().trim().min(1).nullable(),
    isEdited: z.boolean(),
  })
  .strict()
  .refine((segment) => segment.end >= segment.start, {
    message: "Segment end time must be at or after its start time.",
    path: ["end"],
  })
  .refine(
    (segment) =>
      segment.text === (segment.editedText ?? segment.originalText) &&
      segment.isEdited === (segment.editedText !== null),
    { message: "Segment edit fields are inconsistent.", path: ["text"] },
  );

export const diarizedTranscriptionResultSchema = z
  .object({
    text: z.string().trim().min(1),
    duration: z.number().finite().positive(),
    segments: z.array(audioTranscriptSegmentSchema).min(1).max(10_000),
    detectedLanguage: z.string().trim().min(1).nullable().optional(),
    model: z.string().trim().min(1).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((result, context) => {
    const ids = new Set<string>();
    let previousStart = -1;
    let latestEnd = 0;
    result.segments.forEach((segment, index) => {
      if (ids.has(segment.id)) {
        context.addIssue({ code: "custom", message: "Segment IDs must be unique.", path: ["segments", index, "id"] });
      }
      ids.add(segment.id);
      if (segment.start < previousStart) {
        context.addIssue({ code: "custom", message: "Segments must be ordered by start time.", path: ["segments", index, "start"] });
      }
      previousStart = segment.start;
      latestEnd = Math.max(latestEnd, segment.end);
    });
    if (latestEnd > result.duration + 0.25) {
      context.addIssue({ code: "custom", message: "Audio duration cannot end before its final segment.", path: ["duration"] });
    }
  });

export const speakerMappingEntrySchema = z.object({
  speakerId: z.string().trim().min(1),
  role: speakerRoleSchema,
}).strict();

export const speakerMappingSchema = z.array(speakerMappingEntrySchema).max(100);

export const audioMetricSettingsSchema = z.object({
  shortPauseSeconds: z.number().min(0.25).max(30),
  deadAirSeconds: z.number().min(0.5).max(60),
  severeDeadAirSeconds: z.number().min(1).max(120),
  minimumInterruptionOverlapSeconds: z.number().min(0.05).max(10),
  englishFillerWords: z.array(z.string().trim().min(1)).max(100),
  egyptianFillerWords: z.array(z.string().trim().min(1)).max(100),
  gulfFillerWords: z.array(z.string().trim().min(1)).max(100),
}).strict().superRefine((settings, context) => {
  if (settings.deadAirSeconds < settings.shortPauseSeconds) {
    context.addIssue({ code: "custom", message: "Dead air must be at least the short-pause threshold.", path: ["deadAirSeconds"] });
  }
  if (settings.severeDeadAirSeconds <= settings.deadAirSeconds) {
    context.addIssue({ code: "custom", message: "Severe dead air must exceed the dead-air threshold.", path: ["severeDeadAirSeconds"] });
  }
});

export type AudioMetricSettings = z.infer<typeof audioMetricSettingsSchema>;

export const audioAnalysisSettingsSchema = audioMetricSettingsSchema.safeExtend({
  playbackSpeed: z.union([z.literal(0.75), z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  autoScrollTranscript: z.boolean(),
});

export type AudioAnalysisSettings = z.infer<typeof audioAnalysisSettingsSchema>;

export const DEFAULT_AUDIO_METRIC_SETTINGS: AudioMetricSettings = {
  shortPauseSeconds: 1.5,
  deadAirSeconds: 3,
  severeDeadAirSeconds: 8,
  minimumInterruptionOverlapSeconds: 0.2,
  englishFillerWords: ["um", "uh", "erm", "actually", "basically", "like", "you know"],
  egyptianFillerWords: ["يعني", "طيب", "بصراحة", "أصل", "اممم", "آه يعني"],
  gulfFillerWords: ["يعني", "طيب", "الصراحة", "عاد", "اممم"],
};

export const speakerMetricSchema = z.object({
  id: z.string().min(1),
  role: speakerRoleSchema,
  speakingSeconds: z.number().min(0),
  talkPercentage: z.number().min(0).max(100),
  wordCount: z.number().int().min(0),
  wordsPerMinute: z.number().min(0),
}).strict();

export const pauseEventSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  duration: z.number().positive(),
  severity: z.enum(["short", "dead-air", "severe"]),
}).strict();

export const overlapEventSchema = z.object({
  firstSegmentId: z.string().min(1),
  secondSegmentId: z.string().min(1),
  firstSpeakerId: z.string().min(1),
  secondSpeakerId: z.string().min(1),
  start: z.number().min(0),
  end: z.number().min(0),
  duration: z.number().positive(),
  potentialInterruption: z.boolean(),
}).strict();

export const fillerEvidenceSchema = z.object({
  segmentId: z.string().min(1),
  speakerId: z.string().min(1),
  role: speakerRoleSchema,
  phrase: z.string().min(1),
  quote: z.string().min(1),
  timestamp: z.number().min(0),
}).strict();

export const audioMetricsSchema = z.object({
  callDurationSeconds: z.number().positive(),
  speakingSeconds: z.number().min(0),
  silenceSeconds: z.number().min(0),
  overlapSeconds: z.number().min(0),
  silenceCount: z.number().int().min(0),
  longestSilenceSeconds: z.number().min(0),
  averageSilenceSeconds: z.number().min(0),
  possibleDeadAirCount: z.number().int().min(0),
  overlapEventCount: z.number().int().min(0),
  agentToCustomerTalkRatio: z.number().min(0).nullable(),
  speakers: z.array(speakerMetricSchema),
  roles: z.array(speakerMetricSchema),
  pauses: z.array(pauseEventSchema),
  overlaps: z.array(overlapEventSchema),
  fillerCount: z.number().int().min(0),
  fillerRatePer100Words: z.number().min(0),
  fillers: z.array(fillerEvidenceSchema),
  potentialInterruptions: z.number().int().min(0),
}).strict();

export const evidenceReferenceSchema = z.object({
  segmentId: z.string().min(1),
  quote: z.string().trim().min(1),
  timestamp: z.number().min(0),
  role: speakerRoleSchema,
}).strict();

export const segmentInsightSchema = z.object({
  segmentId: z.string().min(1),
  inferredEmotion: z.string().trim().min(1).optional(),
  emotionConfidence: z.number().min(0).max(1).optional(),
  dialectObservation: z.string().trim().min(1).optional(),
  codeSwitching: z.boolean().optional(),
}).strict();

export type AudioTranscriptSegment = z.infer<typeof audioTranscriptSegmentSchema>;
export type DiarizedTranscriptionResult = z.infer<typeof diarizedTranscriptionResultSchema>;
export type SpeakerMappingEntry = z.infer<typeof speakerMappingEntrySchema>;
export type AudioMetrics = z.infer<typeof audioMetricsSchema>;
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
export type SegmentInsight = z.infer<typeof segmentInsightSchema>;

export const SUPPORTED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "mp4", "mpeg", "mpga", "ogg", "webm", "flac"] as const;
export const DEFAULT_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const AUDIO_FORMAT_LABEL = "MP3, WAV, M4A, MP4, MPEG, MPGA, OGG, WebM, or FLAC";

export function validateAudioFile(
  file: { name: string; size: number; type?: string },
  maxBytes = DEFAULT_MAX_AUDIO_BYTES,
) {
  if (file.size <= 0) return "The selected audio file is empty.";
  if (file.size > maxBytes) return `Audio files must be ${formatMegabytes(maxBytes)} MB or smaller.`;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number])) {
    return `Use an ${AUDIO_FORMAT_LABEL} file.`;
  }
  return null;
}

function formatMegabytes(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

type RawDiarizedSegment = { id?: unknown; speaker?: unknown; start?: unknown; end?: unknown; text?: unknown };
type RawDiarizedTranscription = {
  text?: unknown;
  duration?: unknown;
  language?: unknown;
  segments?: unknown;
  task?: unknown;
  usage?: unknown;
};

export class InvalidDiarizedTranscriptionError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("invalid_diarized_transcription");
    this.name = "InvalidDiarizedTranscriptionError";
    this.issues = issues;
  }
}

export function normalizeProviderDiarizedTranscription(
  value: RawDiarizedTranscription,
  options: { model: string; createdAt?: string },
): DiarizedTranscriptionResult {
  if (!Array.isArray(value.segments)) {
    throw new InvalidDiarizedTranscriptionError(["segments: Expected an array of diarized transcript segments."]);
  }
  const segments = value.segments.map((candidate) => {
    const raw = candidate as RawDiarizedSegment;
    const originalText = typeof raw.text === "string" ? raw.text.trim() : "";
    return {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      speakerId: typeof raw.speaker === "string" && raw.speaker.trim() ? raw.speaker.trim() : "",
      role: "unknown" as const,
      start: raw.start,
      end: raw.end,
      text: originalText,
      originalText,
      editedText: null,
      isEdited: false,
    };
  });
  const latestProviderSegmentEnd = segments.reduce(
    (latest, segment) => typeof segment.end === "number" && Number.isFinite(segment.end) ? Math.max(latest, segment.end) : latest,
    0,
  );
  const providerDuration = typeof value.duration === "number" && Number.isFinite(value.duration) && value.duration > 0
    ? value.duration
    : null;
  const result = {
    text: typeof value.text === "string" ? value.text.trim() : "",
    // Live diarized_json responses can omit the documented top-level duration.
    // Segment end times are provider timestamps, so their maximum is the safest exact fallback.
    duration: Math.max(providerDuration ?? 0, latestProviderSegmentEnd),
    segments,
    detectedLanguage: typeof value.language === "string" && value.language.trim() ? value.language.trim() : null,
    model: options.model,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
  const parsed = diarizedTranscriptionResultSchema.safeParse(result);
  if (!parsed.success) {
    throw new InvalidDiarizedTranscriptionError(parsed.error.issues.map((issue) =>
      `${issue.path.length ? issue.path.join(".") : "response"}: ${issue.message}`));
  }
  return parsed.data;
}

export function getSuggestedSpeakerMapping(result: DiarizedTranscriptionResult): SpeakerMappingEntry[] {
  const unique = [...new Set(result.segments.map((segment) => segment.speakerId))];
  return unique.map((speakerId, index) => ({
    speakerId,
    role: index === 0 ? "agent" : index === 1 ? "customer" : "unknown",
  }));
}

export function applySpeakerMapping(
  result: DiarizedTranscriptionResult,
  mapping: SpeakerMappingEntry[],
): DiarizedTranscriptionResult {
  const validated = speakerMappingSchema.parse(mapping);
  const lookup = new Map(validated.map((entry) => [entry.speakerId, entry.role]));
  return diarizedTranscriptionResultSchema.parse({
    ...result,
    segments: result.segments.map((segment) => ({ ...segment, role: lookup.get(segment.speakerId) ?? "unknown" })),
  });
}

export function editTranscriptSegment(
  result: DiarizedTranscriptionResult,
  segmentId: string,
  nextText: string,
): DiarizedTranscriptionResult {
  const editedText = nextText.trim();
  if (!editedText) throw new Error("Transcript segment text cannot be empty.");
  const segments = result.segments.map((segment) =>
    segment.id === segmentId
      ? { ...segment, text: editedText, editedText, isEdited: true }
      : segment,
  );
  if (!segments.some((segment) => segment.id === segmentId)) throw new Error("Transcript segment was not found.");
  return diarizedTranscriptionResultSchema.parse({ ...result, text: segments.map((segment) => segment.text).join(" "), segments });
}

export function undoTranscriptSegment(
  result: DiarizedTranscriptionResult,
  segmentId: string,
): DiarizedTranscriptionResult {
  const segments = result.segments.map((segment) =>
    segment.id === segmentId
      ? { ...segment, text: segment.originalText, editedText: null, isEdited: false }
      : segment,
  );
  return diarizedTranscriptionResultSchema.parse({ ...result, text: segments.map((segment) => segment.text).join(" "), segments });
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function countWords(text: string) {
  return text.trim().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function roleForSpeaker(result: DiarizedTranscriptionResult, speakerId: string) {
  return result.segments.find((segment) => segment.speakerId === speakerId)?.role ?? "unknown";
}

function createMetric(id: string, role: AudioTranscriptSegment["role"], seconds: number, words: number, denominator: number) {
  return {
    id,
    role,
    speakingSeconds: round(seconds),
    talkPercentage: denominator > 0 ? round((seconds / denominator) * 100, 1) : 0,
    wordCount: words,
    wordsPerMinute: seconds > 0 ? round(words / (seconds / 60), 1) : 0,
  };
}

function fillerDictionary(settings: AudioMetricSettings) {
  return [...new Set([
    ...settings.englishFillerWords,
    ...settings.egyptianFillerWords,
    ...settings.gulfFillerWords,
  ].map((item) => item.trim().toLocaleLowerCase()).filter(Boolean))].sort((a, b) => b.length - a.length);
}

function isLetterOrNumber(value: string | undefined) {
  return Boolean(value && /[\p{L}\p{N}]/u.test(value));
}

function findFillers(segment: AudioTranscriptSegment, dictionary: string[]): z.infer<typeof fillerEvidenceSchema>[] {
  const haystack = segment.text.toLocaleLowerCase();
  const occupied: Array<[number, number]> = [];
  const matches: z.infer<typeof fillerEvidenceSchema>[] = [];
  for (const phrase of dictionary) {
    let cursor = 0;
    while (cursor < haystack.length) {
      const start = haystack.indexOf(phrase, cursor);
      if (start < 0) break;
      const end = start + phrase.length;
      cursor = end;
      if (isLetterOrNumber(haystack[start - 1]) || isLetterOrNumber(haystack[end])) continue;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      occupied.push([start, end]);
      matches.push({
        segmentId: segment.id,
        speakerId: segment.speakerId,
        role: segment.role,
        phrase: segment.text.slice(start, end),
        quote: segment.text,
        timestamp: segment.start,
      });
    }
  }
  return matches.sort((a, b) => a.timestamp - b.timestamp);
}

export function calculateAudioMetrics(
  result: DiarizedTranscriptionResult,
  settings: AudioMetricSettings | AudioAnalysisSettings = DEFAULT_AUDIO_METRIC_SETTINGS,
): AudioMetrics {
  const validatedResult = diarizedTranscriptionResultSchema.parse(result);
  const persistedSettings = audioAnalysisSettingsSchema.safeParse(settings);
  const validatedSettings = persistedSettings.success
    ? audioMetricSettingsSchema.parse({
        shortPauseSeconds: persistedSettings.data.shortPauseSeconds,
        deadAirSeconds: persistedSettings.data.deadAirSeconds,
        severeDeadAirSeconds: persistedSettings.data.severeDeadAirSeconds,
        minimumInterruptionOverlapSeconds: persistedSettings.data.minimumInterruptionOverlapSeconds,
        englishFillerWords: persistedSettings.data.englishFillerWords,
        egyptianFillerWords: persistedSettings.data.egyptianFillerWords,
        gulfFillerWords: persistedSettings.data.gulfFillerWords,
      })
    : audioMetricSettingsSchema.parse(settings);
  const segments = [...validatedResult.segments].sort((a, b) => a.start - b.start || a.end - b.end);
  const speakingBySpeaker = new Map<string, { seconds: number; words: number }>();
  const speakingByRole = new Map<AudioTranscriptSegment["role"], { seconds: number; words: number }>();
  for (const segment of segments) {
    const duration = Math.max(0, segment.end - segment.start);
    const words = countWords(segment.text);
    const speaker = speakingBySpeaker.get(segment.speakerId) ?? { seconds: 0, words: 0 };
    speaker.seconds += duration; speaker.words += words; speakingBySpeaker.set(segment.speakerId, speaker);
    const role = speakingByRole.get(segment.role) ?? { seconds: 0, words: 0 };
    role.seconds += duration; role.words += words; speakingByRole.set(segment.role, role);
  }
  const summedSpeakingSeconds = [...speakingBySpeaker.values()].reduce((sum, value) => sum + value.seconds, 0);

  const pauses: z.infer<typeof pauseEventSchema>[] = [];
  const allSilenceGaps: Array<{ start: number; end: number; duration: number }> = [];
  const merged: Array<{ start: number; end: number }> = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    if (!last || segment.start > last.end) merged.push({ start: segment.start, end: segment.end });
    else last.end = Math.max(last.end, segment.end);
  }
  for (let index = 1; index < merged.length; index += 1) {
    const start = merged[index - 1].end;
    const end = merged[index].start;
    const duration = end - start;
    if (duration > 0) allSilenceGaps.push({ start, end, duration });
    if (duration < validatedSettings.shortPauseSeconds) continue;
    pauses.push({
      start: round(start), end: round(end), duration: round(duration),
      severity: duration >= validatedSettings.severeDeadAirSeconds ? "severe" : duration >= validatedSettings.deadAirSeconds ? "dead-air" : "short",
    });
  }

  const overlaps: z.infer<typeof overlapEventSchema>[] = [];
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      if (segments[second].start >= segments[first].end) break;
      if (segments[first].speakerId === segments[second].speakerId) continue;
      const start = Math.max(segments[first].start, segments[second].start);
      const end = Math.min(segments[first].end, segments[second].end);
      const duration = end - start;
      if (duration <= 0) continue;
      overlaps.push({
        firstSegmentId: segments[first].id,
        secondSegmentId: segments[second].id,
        firstSpeakerId: segments[first].speakerId,
        secondSpeakerId: segments[second].speakerId,
        start: round(start), end: round(end), duration: round(duration),
        potentialInterruption: duration >= validatedSettings.minimumInterruptionOverlapSeconds,
      });
    }
  }

  const dictionary = fillerDictionary(validatedSettings);
  const fillers = segments.flatMap((segment) => findFillers(segment, dictionary));
  const agentSeconds = speakingByRole.get("agent")?.seconds ?? 0;
  const customerSeconds = speakingByRole.get("customer")?.seconds ?? 0;
  const speakers = [...speakingBySpeaker.entries()].map(([id, values]) => createMetric(id, roleForSpeaker(validatedResult, id), values.seconds, values.words, summedSpeakingSeconds));
  const roles = (["agent", "customer", "unknown"] as const)
    .filter((role) => speakingByRole.has(role))
    .map((role) => {
      const values = speakingByRole.get(role)!;
      return createMetric(role, role, values.seconds, values.words, summedSpeakingSeconds);
    });
  const coveredSpeechSeconds = merged.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  return audioMetricsSchema.parse({
    callDurationSeconds: round(validatedResult.duration),
    speakingSeconds: round(coveredSpeechSeconds),
    silenceSeconds: round(allSilenceGaps.reduce((sum, pause) => sum + pause.duration, 0)),
    overlapSeconds: round(overlaps.reduce((sum, overlap) => sum + overlap.duration, 0)),
    silenceCount: pauses.length,
    longestSilenceSeconds: round(Math.max(0, ...allSilenceGaps.map((pause) => pause.duration))),
    averageSilenceSeconds: allSilenceGaps.length ? round(allSilenceGaps.reduce((sum, pause) => sum + pause.duration, 0) / allSilenceGaps.length) : 0,
    possibleDeadAirCount: pauses.filter((pause) => pause.severity !== "short").length,
    overlapEventCount: overlaps.length,
    agentToCustomerTalkRatio: customerSeconds > 0 ? round(agentSeconds / customerSeconds, 2) : null,
    speakers,
    roles,
    pauses,
    overlaps,
    fillerCount: fillers.length,
    fillerRatePer100Words: countWords(validatedResult.text) ? round((fillers.length / countWords(validatedResult.text)) * 100, 1) : 0,
    fillers,
    potentialInterruptions: overlaps.filter((overlap) => overlap.potentialInterruption).length,
  });
}

export function validateEvidenceReferences(
  references: EvidenceReference[],
  result: DiarizedTranscriptionResult,
) {
  const parsed = z.array(evidenceReferenceSchema).safeParse(references);
  if (!parsed.success) return { valid: false as const, errors: ["Evidence has an invalid shape."] };
  const errors: string[] = [];
  for (const reference of parsed.data) {
    const segment = result.segments.find((item) => item.id === reference.segmentId);
    if (!segment) { errors.push(`Missing segment ${reference.segmentId}.`); continue; }
    if (!segment.text.includes(reference.quote)) errors.push(`Quote is not present in segment ${reference.segmentId}.`);
    if (reference.timestamp < segment.start || reference.timestamp > segment.end) errors.push(`Timestamp is outside segment ${reference.segmentId}.`);
    if (reference.role !== segment.role) errors.push(`Mapped role does not match segment ${reference.segmentId}.`);
  }
  return errors.length ? { valid: false as const, errors } : { valid: true as const, errors: [] };
}

export function replaceObjectUrl(
  currentUrl: string | null,
  file: Blob | null,
  adapter: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
) {
  if (currentUrl) adapter.revokeObjectURL(currentUrl);
  return file ? adapter.createObjectURL(file) : null;
}

export function formatAudioTimestamp(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
