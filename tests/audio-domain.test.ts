import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_AUDIO_METRIC_SETTINGS,
  DEFAULT_MAX_AUDIO_BYTES,
  applySpeakerMapping,
  audioAnalysisSettingsSchema,
  audioMetricsSchema,
  calculateAudioMetrics,
  countWords,
  diarizedTranscriptionResultSchema,
  editTranscriptSegment,
  getSuggestedSpeakerMapping,
  normalizeProviderDiarizedTranscription,
  replaceObjectUrl,
  undoTranscriptSegment,
  validateAudioFile,
  validateEvidenceReferences,
  type DiarizedTranscriptionResult,
} from "../app/lib/audio-domain.ts";

const rawSegments = [
  { id: "seg-a1", speakerId: "A", role: "agent" as const, start: 0, end: 4, text: "Hello um there", originalText: "Hello um there", editedText: null, isEdited: false },
  { id: "seg-b1", speakerId: "B", role: "customer" as const, start: 4.5, end: 8.5, text: "طيب I need help", originalText: "طيب I need help", editedText: null, isEdited: false },
  { id: "seg-a2", speakerId: "A", role: "agent" as const, start: 8.25, end: 10.25, text: "Actually okay", originalText: "Actually okay", editedText: null, isEdited: false },
  { id: "seg-b2", speakerId: "B", role: "customer" as const, start: 14.25, end: 18.25, text: "I understand basically", originalText: "I understand basically", editedText: null, isEdited: false },
  { id: "seg-a3", speakerId: "A", role: "agent" as const, start: 18, end: 20, text: "you know proceed", originalText: "you know proceed", editedText: null, isEdited: false },
];

const FIXTURE: DiarizedTranscriptionResult = diarizedTranscriptionResultSchema.parse({
  text: rawSegments.map((segment) => segment.text).join(" "),
  duration: 22,
  segments: rawSegments,
  detectedLanguage: "Mixed Arabic and English",
  model: "test-model",
  createdAt: "2026-07-19T00:00:00.000Z",
});

test("audio validation accepts every supported extension", () => {
  for (const extension of ["mp3", "wav", "m4a", "mp4", "mpeg", "mpga", "ogg", "webm", "flac"]) {
    assert.equal(validateAudioFile({ name: `call.${extension}`, size: 1024 }), null, extension);
  }
});

test("audio validation rejects unsupported formats, empty files, and configured size overflow", () => {
  assert.match(validateAudioFile({ name: "call.aac", size: 100 }) ?? "", /MP3/);
  assert.match(validateAudioFile({ name: "call.mp3", size: 0 }) ?? "", /empty/i);
  assert.match(validateAudioFile({ name: "call.wav", size: DEFAULT_MAX_AUDIO_BYTES + 1 }) ?? "", /25 MB/);
  assert.match(validateAudioFile({ name: "call.wav", size: 6 * 1024 * 1024 }, 5 * 1024 * 1024) ?? "", /5 MB/);
});

test("strict transcription schema accepts normalized diarized results", () => {
  assert.equal(diarizedTranscriptionResultSchema.safeParse(FIXTURE).success, true);
});

test("strict transcription schema rejects invalid timing and empty text", () => {
  const badEnd = structuredClone(FIXTURE); badEnd.segments[0].end = -1;
  const empty = structuredClone(FIXTURE); empty.segments[0].text = "";
  assert.equal(diarizedTranscriptionResultSchema.safeParse(badEnd).success, false);
  assert.equal(diarizedTranscriptionResultSchema.safeParse(empty).success, false);
});

test("strict transcription schema rejects segment ordering and duplicate IDs", () => {
  const unordered = structuredClone(FIXTURE); [unordered.segments[0], unordered.segments[1]] = [unordered.segments[1], unordered.segments[0]];
  const duplicate = structuredClone(FIXTURE); duplicate.segments[1].id = duplicate.segments[0].id;
  assert.equal(diarizedTranscriptionResultSchema.safeParse(unordered).success, false);
  assert.equal(diarizedTranscriptionResultSchema.safeParse(duplicate).success, false);
});

test("strict transcription schema rejects duration before the final segment", () => {
  assert.equal(diarizedTranscriptionResultSchema.safeParse({ ...FIXTURE, duration: 19 }).success, false);
});

test("provider normalization keeps provider IDs, timestamps, labels, and text without inventing values", () => {
  const result = normalizeProviderDiarizedTranscription({
    text: "Hello there",
    duration: 2,
    segments: [{ id: "provider-1", speaker: "A", start: 0, end: 2, text: "Hello there" }],
  }, { model: "gpt-4o-transcribe-diarize", createdAt: "2026-07-19T00:00:00.000Z" });
  assert.equal(result.segments[0].id, "provider-1");
  assert.equal(result.segments[0].speakerId, "A");
  assert.equal(result.segments[0].role, "unknown");
  assert.equal(result.duration, 2);
});

test("live diarized_json without top-level duration derives duration from provider timestamps", () => {
  const result = normalizeProviderDiarizedTranscription({
    text: "Thank you for calling. I need help with a duplicate charge.",
    segments: [
      { type: "transcript.text.segment", id: "seg_0", speaker: "A", start: 0, end: 1.95, text: " Thank you for calling." },
      { type: "transcript.text.segment", id: "seg_1", speaker: "B", start: 2.6, end: 5.75, text: " I need help with a duplicate charge." },
    ],
    usage: { type: "tokens", total_tokens: 100, input_tokens: 40, output_tokens: 60 },
  }, { model: "gpt-4o-transcribe-diarize", createdAt: "2026-07-21T00:00:00.000Z" });
  assert.equal(result.duration, 5.75);
  assert.deepEqual(result.segments.map((segment) => segment.id), ["seg_0", "seg_1"]);
  assert.deepEqual(result.segments.map((segment) => [segment.start, segment.end]), [[0, 1.95], [2.6, 5.75]]);
  assert.deepEqual(result.segments.map((segment) => segment.speakerId), ["A", "B"]);
});

test("provider duration is preserved when it includes trailing silence", () => {
  const result = normalizeProviderDiarizedTranscription({
    text: "Hello there",
    duration: 3,
    segments: [{ id: "seg_0", speaker: "A", start: 0, end: 2, text: "Hello there" }],
  }, { model: "test", createdAt: "2026-07-21T00:00:00.000Z" });
  assert.equal(result.duration, 3);
});

test("malformed provider responses cannot create fake transcript results", () => {
  assert.throws(() => normalizeProviderDiarizedTranscription({ text: "", segments: [] }, { model: "test" }), /invalid_diarized/);
  assert.throws(() => normalizeProviderDiarizedTranscription({ text: "Hello", segments: [{ speaker: "A", start: 0, end: 1, text: "Hello" }] }, { model: "test" }), /invalid_diarized/);
});

test("suggested mapping is clearly positional and mapping preserves original speaker IDs", () => {
  const unknown = { ...FIXTURE, segments: FIXTURE.segments.map((segment) => ({ ...segment, role: "unknown" as const })) };
  const suggested = getSuggestedSpeakerMapping(unknown);
  assert.deepEqual(suggested, [{ speakerId: "A", role: "agent" }, { speakerId: "B", role: "customer" }]);
  const remapped = applySpeakerMapping(unknown, [{ speakerId: "A", role: "customer" }, { speakerId: "B", role: "agent" }]);
  assert.equal(remapped.segments[0].speakerId, "A");
  assert.equal(remapped.segments[0].role, "customer");
  assert.equal(remapped.segments[1].role, "agent");
});

test("word counting is whitespace-aware for English and Arabic", () => {
  assert.equal(countWords("Don't stop now"), 3);
  assert.equal(countWords("هذا اختبار جيد"), 3);
  assert.equal(countWords("  العربية   English  "), 2);
});

test("speaking duration, talk percentage, ratio, and speed are deterministic", () => {
  const metrics = calculateAudioMetrics(FIXTURE);
  const agent = metrics.roles.find((item) => item.id === "agent")!;
  const customer = metrics.roles.find((item) => item.id === "customer")!;
  assert.equal(agent.speakingSeconds, 8);
  assert.equal(customer.speakingSeconds, 8);
  assert.equal(agent.talkPercentage, 50);
  assert.equal(customer.talkPercentage, 50);
  assert.equal(metrics.agentToCustomerTalkRatio, 1);
  assert.equal(agent.wordsPerMinute, 60);
  assert.equal(customer.wordsPerMinute, 52.5);
});

test("silence calculation reports count, total, longest, average, and dead air", () => {
  const metrics = calculateAudioMetrics(FIXTURE);
  assert.equal(metrics.silenceCount, 1);
  assert.equal(metrics.silenceSeconds, 4.5);
  assert.equal(metrics.longestSilenceSeconds, 4);
  assert.equal(metrics.averageSilenceSeconds, 2.25);
  assert.equal(metrics.possibleDeadAirCount, 1);
  assert.equal(metrics.pauses[0].severity, "dead-air");
});

test("overlap detection reports duration, speaker pairs, and interruption threshold", () => {
  const metrics = calculateAudioMetrics(FIXTURE);
  assert.equal(metrics.overlapEventCount, 2);
  assert.equal(metrics.overlapSeconds, 0.5);
  assert.equal(metrics.potentialInterruptions, 2);
  assert.deepEqual([metrics.overlaps[0].firstSpeakerId, metrics.overlaps[0].secondSpeakerId], ["B", "A"]);
  const stricter = calculateAudioMetrics(FIXTURE, { ...DEFAULT_AUDIO_METRIC_SETTINGS, minimumInterruptionOverlapSeconds: 0.3 });
  assert.equal(stricter.potentialInterruptions, 0);
});

test("filler words use phrase-aware matching and include evidence", () => {
  const metrics = calculateAudioMetrics(FIXTURE);
  assert.equal(metrics.fillerCount, 5);
  assert.deepEqual(new Set(metrics.fillers.map((item) => item.phrase.toLocaleLowerCase())), new Set(["um", "طيب", "actually", "basically", "you know"]));
  assert.equal(metrics.fillers[0].segmentId, "seg-a1");
  assert.match(metrics.fillers[0].quote, /Hello/);
});

test("Arabic multi-word fillers avoid nested false positives", () => {
  const segment = { id: "ar-1", speakerId: "A", role: "agent" as const, start: 0, end: 3, text: "آه يعني اممم", originalText: "آه يعني اممم", editedText: null, isEdited: false };
  const result = diarizedTranscriptionResultSchema.parse({ text: segment.text, duration: 3, segments: [segment], createdAt: "2026-07-19T00:00:00.000Z" });
  const metrics = calculateAudioMetrics(result);
  assert.equal(metrics.fillerCount, 2);
  assert.deepEqual(metrics.fillers.map((item) => item.phrase), ["آه يعني", "اممم"]);
});

test("editing preserves provider text, marks the segment, recalculates fillers, and supports undo", () => {
  const edited = editTranscriptSegment(FIXTURE, "seg-a2", "Clear response");
  const segment = edited.segments.find((item) => item.id === "seg-a2")!;
  assert.equal(segment.originalText, "Actually okay");
  assert.equal(segment.editedText, "Clear response");
  assert.equal(segment.isEdited, true);
  assert.equal(calculateAudioMetrics(edited).fillerCount, 4);
  const restored = undoTranscriptSegment(edited, "seg-a2");
  assert.equal(restored.segments.find((item) => item.id === "seg-a2")?.text, "Actually okay");
  assert.equal(restored.segments.find((item) => item.id === "seg-a2")?.isEdited, false);
});

test("metrics always satisfy their strict output schema", () => {
  assert.equal(audioMetricsSchema.safeParse(calculateAudioMetrics(FIXTURE)).success, true);
});

test("persisted transcript controls pass strict settings validation without changing metrics", () => {
  const settings = {
    ...DEFAULT_AUDIO_METRIC_SETTINGS,
    playbackSpeed: 1.25 as const,
    autoScrollTranscript: true,
  };
  assert.equal(audioAnalysisSettingsSchema.safeParse(settings).success, true);
  assert.deepEqual(calculateAudioMetrics(FIXTURE, settings), calculateAudioMetrics(FIXTURE));
  assert.equal(audioAnalysisSettingsSchema.safeParse({ ...settings, unexpected: true }).success, false);
});

test("object URL replacement and removal revoke prior temporary URLs", () => {
  const revoked: string[] = [];
  const adapter = { createObjectURL: () => "blob:new", revokeObjectURL: (url: string) => revoked.push(url) };
  const next = replaceObjectUrl("blob:old", new Blob(["audio"]), adapter);
  assert.equal(next, "blob:new");
  assert.deepEqual(revoked, ["blob:old"]);
  assert.equal(replaceObjectUrl(next, null, adapter), null);
  assert.deepEqual(revoked, ["blob:old", "blob:new"]);
});

test("evidence validation rejects nonexistent segments, mismatched quotes, and timestamps", () => {
  assert.equal(validateEvidenceReferences([{ segmentId: "seg-a1", quote: "Hello", timestamp: 1, role: "agent" }], FIXTURE).valid, true);
  assert.equal(validateEvidenceReferences([{ segmentId: "missing", quote: "Hello", timestamp: 1, role: "agent" }], FIXTURE).valid, false);
  assert.equal(validateEvidenceReferences([{ segmentId: "seg-a1", quote: "Not present", timestamp: 1, role: "agent" }], FIXTURE).valid, false);
  assert.equal(validateEvidenceReferences([{ segmentId: "seg-a1", quote: "Hello", timestamp: 9, role: "agent" }], FIXTURE).valid, false);
  assert.equal(validateEvidenceReferences([{ segmentId: "seg-a1", quote: "Hello", timestamp: 1, role: "customer" }], FIXTURE).valid, false);
});
