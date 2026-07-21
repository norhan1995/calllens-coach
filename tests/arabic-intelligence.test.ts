import assert from "node:assert/strict";
import test from "node:test";
import {
  ARABIC_VAD_SETTINGS,
  DEFAULT_TRANSCRIPTION_WORKSPACE_SETTINGS,
  DEFAULT_WORKSPACE_VOCABULARY,
  appendTranscriptionRequestSettings,
  applyHighConfidenceSegmentCorrections,
  createDeterministicArabicIntelligence,
  detectCodeSwitchingObservations,
  detectDialectObservations,
  detectTranscriptAnnotations,
  enhanceTranscriptWithVocabulary,
  preprocessingDiagnosticSchema,
  parseTranscriptionRequestSettings,
  resolveOptionalArabicEnrichment,
  validateEnrichmentReferences,
  workspaceVocabularySchema,
  type ArabicEnrichmentResponse,
} from "../app/lib/arabic-intelligence.ts";
import { prepareAudioForTranscription } from "../app/lib/audio-preprocessing.ts";
import {
  applyArabicIntelligence,
  calculateAudioMetrics,
  diarizedTranscriptionResultSchema,
  editTranscriptSegment,
  normalizeProviderDiarizedTranscription,
  serializeTranscriptJson,
  serializeTranscriptTxt,
  type DiarizedTranscriptionResult,
} from "../app/lib/audio-domain.ts";

const NO_PREPROCESSING = preprocessingDiagnosticSchema.parse({
  requested: false,
  status: "not_requested",
  adapter: "original",
  reason: "Fictional test input uses the original upload.",
  originalPreserved: true,
  temporaryFilesCreated: false,
  temporaryFilesDeleted: true,
});

function transcript(segments: Array<{ id: string; speakerId: string; start: number; end: number; text: string }>) {
  return { text: segments.map((segment) => segment.text).join(" "), segments };
}

function normalized(segments: Array<{ id: string; speaker: string; start: number; end: number; text: string }>) {
  return normalizeProviderDiarizedTranscription({
    text: segments.map((segment) => segment.text).join(" "),
    segments,
  }, { model: "test-diarize", createdAt: "2026-07-21T00:00:00.000Z" });
}

test("1. existing English Standard flow remains unchanged", () => {
  const result = normalized([{ id: "en-1", speaker: "A", start: 0, end: 2, text: "Thank you for calling." }]);
  assert.equal(diarizedTranscriptionResultSchema.safeParse(result).success, true);
  assert.equal(result.text, "Thank you for calling.");
  assert.equal(result.rawTranscript, undefined);
  assert.equal(result.arabicIntelligence, undefined);
});

test("2. Egyptian dialect words remain exactly as spoken", () => {
  const raw = transcript([{ id: "eg-1", speakerId: "A", start: 0, end: 3, text: "معلش أنا عايز معاد دلوقتي" }]);
  const enhanced = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY);
  assert.equal(enhanced.enhancedTranscript.segments[0].text, raw.segments[0].text);
});

test("3. Gulf dialect words remain exactly as spoken", () => {
  const raw = transcript([{ id: "gulf-1", speakerId: "A", start: 0, end: 3, text: "أبغى الموعد الحين ويعطيك العافية" }]);
  assert.equal(enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript.text, raw.text);
});

test("4. Levantine dialect words remain exactly as spoken", () => {
  const raw = transcript([{ id: "lev-1", speakerId: "A", start: 0, end: 3, text: "بدي أعرف شو صار هلأ" }]);
  assert.equal(enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript.text, raw.text);
});

test("5. Egyptian and Gulf speakers receive independent broad-family observations", () => {
  const raw = transcript([
    { id: "mix-1", speakerId: "A", start: 0, end: 2, text: "أنا عايز معاد دلوقتي" },
    { id: "mix-2", speakerId: "B", start: 2.1, end: 4, text: "أبغى الموعد الحين" },
  ]);
  const observations = detectDialectObservations(raw);
  assert.equal(observations.find((item) => item.speakerId === "A")?.dialectFamily, "Egyptian");
  assert.equal(observations.find((item) => item.speakerId === "B")?.dialectFamily, "Gulf");
});

test("6. Arabic-English code-switching retains segment evidence", () => {
  const raw = transcript([{ id: "switch-1", speakerId: "A", start: 0, end: 4, text: "حضرتك محتاج تعمل follow-up على Metformin" }]);
  const observations = detectCodeSwitchingObservations(raw, DEFAULT_WORKSPACE_VOCABULARY);
  assert.deepEqual(observations[0].segmentIds, ["switch-1"]);
  assert.deepEqual(observations[0].scripts, ["Arabic", "Latin"]);
  assert.deepEqual(observations[0].preservedTerms, ["Metformin", "follow-up"]);
});

test("7. approved medicine aliases normalize to Latin canonical forms", () => {
  const raw = transcript([{ id: "med-1", speakerId: "A", start: 0, end: 3, text: "الدواء ميتفورمين والجرعة ثابتة" }]);
  const enhanced = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY);
  assert.match(enhanced.enhancedTranscript.text, /Metformin/);
  assert.equal(enhanced.vocabularyChanges[0].category, "medicine");
});

test("8. MRI and CT aliases remain canonical approved abbreviations", () => {
  const raw = transcript([{ id: "abbr-1", speakerId: "A", start: 0, end: 3, text: "معاك تقرير ام آر آي وفحص سي تي" }]);
  const enhanced = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript.text;
  assert.match(enhanced, /MRI/);
  assert.match(enhanced, /CT/);
});

test("9. strict workspace vocabulary aliases normalize only with configured context", () => {
  const vocabulary = workspaceVocabularySchema.parse({
    version: 1,
    entries: [{ canonicalForm: "NovaMed", aliases: ["نوفا ميد"], category: "medicine", preferredScript: "latin", context: ["دواء"], notes: "Fictional medicine." }],
  });
  const raw = transcript([{ id: "custom-1", speakerId: "A", start: 0, end: 2, text: "دواء نوفا ميد متاح" }]);
  assert.equal(enhanceTranscriptWithVocabulary(raw, vocabulary).enhancedTranscript.text, "دواء NovaMed متاح");
});

test("10. unrelated words are not falsely replaced by vocabulary entries", () => {
  const raw = transcript([{ id: "safe-1", speakerId: "A", start: 0, end: 2, text: "أنا متفور من المشوار" }]);
  const enhanced = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY);
  assert.equal(enhanced.enhancedTranscript.text, raw.text);
  assert.equal(enhanced.vocabularyChanges.length, 0);
});

test("11. raw provider transcript remains byte-for-byte separate from enhancements", () => {
  const raw = transcript([{ id: "raw-1", speakerId: "A", start: 0, end: 3, text: "  الدواء ميتفورمين  " }]);
  const intelligence = createDeterministicArabicIntelligence(raw, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  assert.equal(intelligence.rawTranscript.text, raw.text);
  assert.equal(intelligence.rawTranscript.segments[0].text, raw.segments[0].text);
  assert.notEqual(intelligence.enhancedTranscript.text, intelligence.rawTranscript.text);
});

test("12. enhanced transcript is stored separately and drives compatible metrics", () => {
  const base = normalized([{ id: "separate-1", speaker: "A", start: 0, end: 3, text: "الدواء ميتفورمين" }]);
  const deterministic = createDeterministicArabicIntelligence(base, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  const result = applyArabicIntelligence(base, deterministic.rawTranscript, deterministic.enhancedTranscript, deterministic.metadata);
  assert.equal(result.rawTranscript?.text, "الدواء ميتفورمين");
  assert.equal(result.text, "الدواء Metformin");
  assert.equal(calculateAudioMetrics(result).callDurationSeconds, 3);
  const edited = editTranscriptSegment(result, "separate-1", "تصحيح محافظ Metformin");
  assert.equal(edited.rawTranscript?.text, "الدواء ميتفورمين");
  assert.equal(edited.enhancedTranscript?.text, "تصحيح محافظ Metformin");
});

test("13. speech beginning at time zero is not trimmed or shifted by local logic", () => {
  const base = normalized([{ id: "opening-1", speaker: "A", start: 0, end: 1.5, text: "مساء الخير" }]);
  const deterministic = createDeterministicArabicIntelligence(base, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  const result = applyArabicIntelligence(base, deterministic.rawTranscript, deterministic.enhancedTranscript, deterministic.metadata);
  assert.equal(result.segments[0].start, 0);
  assert.equal(result.rawTranscript?.segments[0].start, 0);
  assert.equal(result.arabicIntelligence?.prefixProtectionMs, 1_000);
  assert.equal(ARABIC_VAD_SETTINGS.threshold, 0.4);
});

test("14. overlapping speakers stay separate and receive deterministic overlap evidence", () => {
  const raw = transcript([
    { id: "overlap-1", speakerId: "A", start: 0, end: 3, text: "أول متحدث" },
    { id: "overlap-2", speakerId: "B", start: 2.5, end: 4, text: "ثاني متحدث" },
  ]);
  const annotations = detectTranscriptAnnotations(raw);
  assert.equal(raw.segments.length, 2);
  assert.deepEqual(annotations.find((item) => item.source === "deterministic_timing")?.segmentIds, ["overlap-1", "overlap-2"]);
});

test("15. unclear, laughter, and overlap annotations retain evidence and source", () => {
  const raw = transcript([
    { id: "mark-1", speakerId: "A", start: 0, end: 2, text: "[غير واضح] [ضحك]" },
    { id: "mark-2", speakerId: "B", start: 1.8, end: 3, text: "[تداخل في الكلام]" },
  ]);
  const annotations = detectTranscriptAnnotations(raw);
  for (const type of ["unclear", "laughter", "overlap"] as const) {
    const annotation = annotations.find((item) => item.type === type);
    assert.ok(annotation);
    assert.ok(annotation.segmentIds.length > 0);
    assert.ok(["provider", "deterministic_timing"].includes(annotation.source));
  }
});

test("16. low-evidence dialect classification returns Uncertain", () => {
  const raw = transcript([{ id: "uncertain-1", speakerId: "A", start: 0, end: 2, text: "شكراً لاتصالك بالمركز" }]);
  const observation = detectDialectObservations(raw)[0];
  assert.equal(observation.dialectFamily, "Uncertain");
  assert.ok(observation.confidence < 0.55);
});

test("17. every enrichment observation must reference a real provider segment", () => {
  const raw = transcript([{ id: "valid-1", speakerId: "A", start: 0, end: 2, text: "أنا عايز معاد" }]);
  const deterministic = createDeterministicArabicIntelligence(raw, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  const valid = {
    segmentCorrections: [] as ArabicEnrichmentResponse["segmentCorrections"],
    dialectObservations: deterministic.metadata.dialectObservations,
    codeSwitchingObservations: deterministic.metadata.codeSwitchingObservations,
    annotations: deterministic.metadata.annotations,
  };
  assert.equal(validateEnrichmentReferences(valid, ["valid-1"]).success, true);
  const invalid = structuredClone(valid);
  invalid.dialectObservations[0].segmentIds = ["missing"];
  assert.equal(validateEnrichmentReferences(invalid, ["valid-1"]).success, false);
  const mismatchedCorrection = structuredClone(valid);
  mismatchedCorrection.segmentCorrections.push({
    segmentId: "valid-1",
    originalText: "Fictional text that does not match raw evidence.",
    correctedText: "Fictional correction.",
    confidence: 0.99,
    category: "obvious_recognition",
    evidenceSegmentIds: ["valid-1"],
    explanation: "This must fail exact raw evidence validation.",
    source: "ai_inference",
  });
  assert.equal(validateEnrichmentReferences(mismatchedCorrection, deterministic.rawTranscript).success, false);
});

test("18. enrichment failure returns deterministic fallback without losing transcription", async () => {
  const raw = transcript([{ id: "fallback-1", speakerId: "A", start: 0, end: 2, text: "أنا عايز معاد" }]);
  const deterministic = createDeterministicArabicIntelligence(raw, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  const metadata = await resolveOptionalArabicEnrichment(deterministic.metadata, ["fallback-1"], "fictional-model", async () => {
    throw new Error("fictional failure");
  });
  assert.equal(metadata.enrichment.status, "fallback");
  assert.equal(deterministic.enhancedTranscript.text, raw.text);
  assert.ok(metadata.dialectObservations.length > 0);
});

test("19. preprocessing failure safely falls back to the original in-memory file", async () => {
  const original = new File([new Uint8Array([82, 73, 70, 70])], "fictional.wav", { type: "audio/wav" });
  const prepared = await prepareAudioForTranscription(original, true, async () => {
    throw new Error("processor unavailable");
  });
  assert.equal(prepared.file, original);
  assert.equal(prepared.diagnostic.status, "fallback");
  assert.equal(prepared.diagnostic.originalPreserved, true);
});

test("20. TXT and JSON exports retain their original fields and add optional intelligence", () => {
  const base = normalized([{ id: "export-1", speaker: "A", start: 0, end: 3, text: "الدواء ميتفورمين" }]);
  const legacyTxt = serializeTranscriptTxt(base);
  assert.equal(legacyTxt, "[00:00] Other / Unknown (A): الدواء ميتفورمين");
  const deterministic = createDeterministicArabicIntelligence(base, DEFAULT_WORKSPACE_VOCABULARY, NO_PREPROCESSING);
  const enhanced: DiarizedTranscriptionResult = applyArabicIntelligence(base, deterministic.rawTranscript, deterministic.enhancedTranscript, deterministic.metadata);
  const exported = JSON.parse(serializeTranscriptJson(enhanced)) as Record<string, unknown>;
  assert.equal(typeof exported.text, "string");
  assert.equal(typeof exported.duration, "number");
  assert.ok(Array.isArray(exported.segments));
  assert.ok(exported.rawTranscript);
  assert.ok(exported.enhancedTranscript);
  assert.match(serializeTranscriptTxt(enhanced), /Metformin/);
});

test("21. Egyptian selection survives the exact client-to-server request settings round trip", () => {
  const form = new FormData();
  appendTranscriptionRequestSettings(form, {
    ...DEFAULT_TRANSCRIPTION_WORKSPACE_SETTINGS,
    mode: "arabic_intelligence",
  }, "Egyptian Arabic");
  const parsed = parseTranscriptionRequestSettings(form);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.mode, "arabic_intelligence");
  assert.equal(parsed.data.selectedDialect, "Egyptian Arabic");

  const automatic = new FormData();
  appendTranscriptionRequestSettings(automatic, {
    ...DEFAULT_TRANSCRIPTION_WORKSPACE_SETTINGS,
    mode: "arabic_intelligence",
  }, "Auto Detect");
  const automaticParsed = parseTranscriptionRequestSettings(automatic);
  assert.equal(automaticParsed.success, true);
  if (!automaticParsed.success) return;
  assert.equal(automaticParsed.data.selectedDialect, "Auto Detect");
  assert.notEqual(automaticParsed.data.selectedDialect, parsed.data.selectedDialect);
});

test("22. high-confidence Egyptian correction changes only the enhanced representation", () => {
  const raw = transcript([{ id: "eg-correction-1", speakerId: "A", start: 0, end: 3, text: "أنا عايز المعاد بكره مع Metformin" }]);
  const baseline = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript;
  const corrected = applyHighConfidenceSegmentCorrections(raw, baseline, [{
    segmentId: "eg-correction-1",
    originalText: raw.segments[0].text,
    correctedText: "أنا عايز المعاد بكرة مع Metformin",
    confidence: 0.99,
    category: "obvious_recognition",
    evidenceSegmentIds: ["eg-correction-1"],
    explanation: "Fictional high-confidence Egyptian recognition correction.",
    source: "ai_inference",
  }], DEFAULT_WORKSPACE_VOCABULARY, "Egyptian Arabic");
  assert.equal(raw.segments[0].text, "أنا عايز المعاد بكره مع Metformin");
  assert.equal(corrected.enhancedTranscript.segments[0].text, "أنا عايز المعاد بكرة مع Metformin");
  assert.equal(corrected.enhancedTranscript.segments[0].id, raw.segments[0].id);
  assert.equal(corrected.enhancedTranscript.segments[0].start, raw.segments[0].start);
  assert.equal(corrected.enhancedTranscript.segments[0].end, raw.segments[0].end);
  assert.equal(corrected.enhancedTranscript.segments[0].speakerId, raw.segments[0].speakerId);
  assert.match(corrected.enhancedTranscript.text, /Metformin/);
  assert.equal(corrected.transcriptCorrections.length, 1);
});

test("23. uncertain corrections leave Egyptian wording and raw evidence unchanged", () => {
  const raw = transcript([{ id: "eg-uncertain-1", speakerId: "A", start: 0, end: 3, text: "معلش أنا عايز معاد دلوقتي" }]);
  const baseline = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript;
  const corrected = applyHighConfidenceSegmentCorrections(raw, baseline, [{
    segmentId: "eg-uncertain-1",
    originalText: raw.segments[0].text,
    correctedText: "من فضلك أريد موعدا الآن",
    confidence: 0.7,
    category: "obvious_recognition",
    evidenceSegmentIds: ["eg-uncertain-1"],
    explanation: "Fictional low-confidence rewrite that must be rejected.",
    source: "ai_inference",
  }], DEFAULT_WORKSPACE_VOCABULARY, "Egyptian Arabic");
  assert.equal(corrected.transcriptCorrections.length, 0);
  assert.equal(corrected.enhancedTranscript.text, raw.text);
});

test("24. Auto Detect cannot authorize an Egyptian recognition rewrite", () => {
  const raw = transcript([{ id: "auto-1", speakerId: "A", start: 0, end: 2, text: "أنا عايز المعاد بكره" }]);
  const baseline = enhanceTranscriptWithVocabulary(raw, DEFAULT_WORKSPACE_VOCABULARY).enhancedTranscript;
  const corrected = applyHighConfidenceSegmentCorrections(raw, baseline, [{
    segmentId: "auto-1",
    originalText: raw.segments[0].text,
    correctedText: "أنا عايز المعاد بكرة",
    confidence: 0.99,
    category: "obvious_recognition",
    evidenceSegmentIds: ["auto-1"],
    explanation: "Fictional correction requires an explicit Egyptian hint.",
    source: "ai_inference",
  }], DEFAULT_WORKSPACE_VOCABULARY, "Auto Detect");
  assert.equal(corrected.transcriptCorrections.length, 0);
  assert.equal(corrected.enhancedTranscript.text, raw.text);
});
