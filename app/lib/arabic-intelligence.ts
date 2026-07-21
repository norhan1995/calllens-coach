import { z } from "zod";

export const transcriptionModeSchema = z.enum(["standard", "arabic_intelligence"]);
export type TranscriptionMode = z.infer<typeof transcriptionModeSchema>;

export const vocabularyCategorySchema = z.enum([
  "medicine",
  "doctor",
  "clinic",
  "branch",
  "procedure",
  "insurance",
  "brand",
  "abbreviation",
  "product",
  "technical_term",
  "custom",
]);
export const preferredScriptSchema = z.enum(["latin", "arabic", "preserve"]);

export const workspaceVocabularyEntrySchema = z.object({
  canonicalForm: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  category: vocabularyCategorySchema,
  preferredScript: preferredScriptSchema,
  context: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  notes: z.string().trim().max(240).nullable().default(null),
}).strict().superRefine((entry, context) => {
  const forms = [entry.canonicalForm, ...entry.aliases].map((value) => value.toLocaleLowerCase());
  if (new Set(forms).size !== forms.length) {
    context.addIssue({ code: "custom", message: "Vocabulary forms must be unique within an entry.", path: ["aliases"] });
  }
});

export const workspaceVocabularySchema = z.object({
  version: z.literal(1),
  entries: z.array(workspaceVocabularyEntrySchema).max(250),
}).strict().superRefine((vocabulary, context) => {
  const canonical = vocabulary.entries.map((entry) => entry.canonicalForm.toLocaleLowerCase());
  if (new Set(canonical).size !== canonical.length) {
    context.addIssue({ code: "custom", message: "Canonical vocabulary forms must be unique.", path: ["entries"] });
  }
});

export type WorkspaceVocabularyEntry = z.infer<typeof workspaceVocabularyEntrySchema>;
export type WorkspaceVocabulary = z.infer<typeof workspaceVocabularySchema>;

export const DEFAULT_WORKSPACE_VOCABULARY: WorkspaceVocabulary = workspaceVocabularySchema.parse({
  version: 1,
  entries: [
    { canonicalForm: "Metformin", aliases: ["ميتفورمين", "متفورمين"], category: "medicine", preferredScript: "latin", context: ["دواء", "علاج", "جرعة", "روشتة"], notes: "Public demonstration vocabulary only." },
    { canonicalForm: "Ozempic", aliases: ["أوزمبيك", "اوزمبيك"], category: "medicine", preferredScript: "latin", context: ["دواء", "علاج", "جرعة", "حقنة"], notes: "Public demonstration vocabulary only." },
    { canonicalForm: "Panadol", aliases: ["بانادول"], category: "medicine", preferredScript: "latin", context: ["دواء", "مسكن", "جرعة"], notes: "Public demonstration vocabulary only." },
    { canonicalForm: "MRI", aliases: ["إم آر آي", "ام آر آي", "الرنين المغناطيسي"], category: "abbreviation", preferredScript: "latin", context: ["أشعة", "تقرير", "فحص", "scan"], notes: "Approved medical abbreviation." },
    { canonicalForm: "CT", aliases: ["سي تي", "الأشعة المقطعية"], category: "abbreviation", preferredScript: "latin", context: ["أشعة", "تقرير", "فحص", "scan"], notes: "Approved medical abbreviation." },
    { canonicalForm: "follow-up", aliases: ["فولو أب", "فولو اب"], category: "technical_term", preferredScript: "latin", context: ["موعد", "متابعة", "حجز", "booking"], notes: "Configured contact-centre term." },
    { canonicalForm: "WhatsApp", aliases: ["واتساب", "واتس آب"], category: "brand", preferredScript: "latin", context: ["رسالة", "ابعت", "أرسل", "send"], notes: "Configured channel name." },
    { canonicalForm: "Northstar Care", aliases: ["نورث ستار كير"], category: "clinic", preferredScript: "latin", context: ["عيادة", "فرع", "موعد"], notes: "Fictional clinic used only for safe demos." },
  ],
});

export const transcriptionWorkspaceSettingsSchema = z.object({
  mode: transcriptionModeSchema,
  preprocessModerateAudio: z.boolean(),
  vocabulary: workspaceVocabularySchema,
}).strict();

export type TranscriptionWorkspaceSettings = z.infer<typeof transcriptionWorkspaceSettingsSchema>;

export const DEFAULT_TRANSCRIPTION_WORKSPACE_SETTINGS: TranscriptionWorkspaceSettings = transcriptionWorkspaceSettingsSchema.parse({
  mode: "standard",
  preprocessModerateAudio: false,
  vocabulary: DEFAULT_WORKSPACE_VOCABULARY,
});

export const transcriptSnapshotSegmentSchema = z.object({
  id: z.string().min(1).refine((value) => value.trim().length > 0, "Segment ID cannot be blank."),
  speakerId: z.string().min(1).refine((value) => value.trim().length > 0, "Speaker ID cannot be blank."),
  start: z.number().finite().min(0),
  end: z.number().finite().min(0),
  text: z.string().min(1).refine((value) => value.trim().length > 0, "Segment text cannot be blank."),
}).strict().refine((segment) => segment.end >= segment.start, { path: ["end"], message: "Segment end must follow its start." });

export const transcriptSnapshotSchema = z.object({
  text: z.string().min(1).refine((value) => value.trim().length > 0, "Transcript text cannot be blank."),
  segments: z.array(transcriptSnapshotSegmentSchema).min(1).max(10_000),
}).strict();

export const vocabularyChangeSchema = z.object({
  segmentId: z.string().trim().min(1),
  original: z.string().trim().min(1),
  canonical: z.string().trim().min(1),
  category: vocabularyCategorySchema,
  preferredScript: preferredScriptSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().min(1).max(400),
}).strict();

export const dialectFamilySchema = z.enum([
  "Egyptian",
  "Gulf",
  "Levantine",
  "Sudanese",
  "Yemeni",
  "Modern Standard Arabic",
  "Mixed Arabic",
  "Uncertain",
]);

export const linguisticEvidenceSchema = z.object({
  segmentId: z.string().trim().min(1),
  quote: z.string().trim().min(1).max(400),
  explanation: z.string().trim().min(1).max(400),
}).strict();

export const dialectObservationSchema = z.object({
  segmentIds: z.array(z.string().trim().min(1)).min(1).max(100),
  speakerId: z.string().trim().min(1),
  dialectFamily: dialectFamilySchema,
  confidence: z.number().min(0).max(1),
  alternatives: z.array(dialectFamilySchema).max(4),
  evidence: z.array(linguisticEvidenceSchema).min(1).max(20),
  mixedDialect: z.boolean(),
  notes: z.string().trim().min(1).max(500),
  source: z.enum(["deterministic_lexical", "ai_inference"]),
}).strict().superRefine((observation, context) => {
  if (observation.confidence < 0.55 && observation.dialectFamily !== "Uncertain") {
    context.addIssue({ code: "custom", message: "Low-confidence dialect observations must be Uncertain.", path: ["dialectFamily"] });
  }
});

export const codeSwitchingObservationSchema = z.object({
  segmentIds: z.array(z.string().trim().min(1)).min(1).max(100),
  speakerId: z.string().trim().min(1).nullable(),
  languages: z.array(z.enum(["Arabic", "English", "Other"])).min(2).max(3),
  scripts: z.array(z.enum(["Arabic", "Latin", "Other"])).min(2).max(3),
  preservedTerms: z.array(z.string().trim().min(1).max(120)).max(50),
  explanation: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  source: z.enum(["deterministic_script", "ai_inference"]),
}).strict();

export const uncertaintyAnnotationSchema = z.object({
  type: z.enum(["unclear", "overlap", "laughter"]),
  segmentIds: z.array(z.string().trim().min(1)).min(1).max(20),
  timeRange: z.object({ start: z.number().min(0), end: z.number().min(0) }).strict().nullable(),
  source: z.enum(["provider", "deterministic_timing", "ai_inference"]),
  confidence: z.number().min(0).max(1),
  note: z.string().trim().min(1).max(400),
}).strict().superRefine((annotation, context) => {
  if (annotation.timeRange && annotation.timeRange.end < annotation.timeRange.start) {
    context.addIssue({ code: "custom", message: "Annotation end must follow its start.", path: ["timeRange", "end"] });
  }
});

export const preprocessingDiagnosticSchema = z.object({
  requested: z.boolean(),
  status: z.enum(["not_requested", "applied", "skipped", "fallback"]),
  adapter: z.enum(["original", "optional_adapter"]),
  reason: z.string().trim().min(1).max(400),
  originalPreserved: z.literal(true),
  temporaryFilesCreated: z.boolean(),
  temporaryFilesDeleted: z.boolean(),
}).strict();

export const enrichmentDiagnosticSchema = z.object({
  status: z.enum(["deterministic_only", "completed", "fallback"]),
  apiCalls: z.number().int().min(0).max(1),
  model: z.string().trim().min(1).nullable(),
  reason: z.string().trim().min(1).max(400),
}).strict();

export const arabicIntelligenceMetadataSchema = z.object({
  feature: z.literal("Arabic Transcription Intelligence"),
  mode: z.literal("arabic_intelligence"),
  languageHint: z.literal("ar"),
  prefixProtectionMs: z.number().int().min(0).max(2_000),
  vocabularyChanges: z.array(vocabularyChangeSchema).max(1_000),
  dialectObservations: z.array(dialectObservationSchema).max(100),
  codeSwitchingObservations: z.array(codeSwitchingObservationSchema).max(100),
  annotations: z.array(uncertaintyAnnotationSchema).max(1_000),
  preprocessing: preprocessingDiagnosticSchema,
  enrichment: enrichmentDiagnosticSchema,
}).strict();

export const arabicEnrichmentResponseSchema = z.object({
  dialectObservations: z.array(dialectObservationSchema).max(100),
  codeSwitchingObservations: z.array(codeSwitchingObservationSchema).max(100),
  annotations: z.array(uncertaintyAnnotationSchema).max(1_000),
}).strict();

export type TranscriptSnapshot = z.infer<typeof transcriptSnapshotSchema>;
export type VocabularyChange = z.infer<typeof vocabularyChangeSchema>;
export type DialectObservation = z.infer<typeof dialectObservationSchema>;
export type CodeSwitchingObservation = z.infer<typeof codeSwitchingObservationSchema>;
export type UncertaintyAnnotation = z.infer<typeof uncertaintyAnnotationSchema>;
export type PreprocessingDiagnostic = z.infer<typeof preprocessingDiagnosticSchema>;
export type ArabicIntelligenceMetadata = z.infer<typeof arabicIntelligenceMetadataSchema>;
export type ArabicEnrichmentResponse = z.infer<typeof arabicEnrichmentResponseSchema>;

type TranscriptInput = {
  text: string;
  segments: Array<{ id: string; speakerId: string; start: number; end: number; text: string }>;
};

export function createTranscriptSnapshot(input: TranscriptInput): TranscriptSnapshot {
  return transcriptSnapshotSchema.parse({
    text: input.text,
    segments: input.segments.map(({ id, speakerId, start, end, text }) => ({ id, speakerId, start, end, text })),
  });
}

export function createRawProviderTranscriptSnapshot(value: unknown): TranscriptSnapshot {
  if (!value || typeof value !== "object") throw new Error("invalid_provider_transcript_snapshot");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.segments)) throw new Error("invalid_provider_transcript_snapshot");
  const segments = record.segments.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw new Error("invalid_provider_transcript_snapshot");
    const segment = candidate as Record<string, unknown>;
    return {
      id: segment.id,
      speakerId: segment.speaker,
      start: segment.start,
      end: segment.end,
      text: segment.text,
    };
  });
  return transcriptSnapshotSchema.parse({ text: record.text, segments });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasContext(text: string, entry: WorkspaceVocabularyEntry) {
  if (entry.context.length === 0) return true;
  const lowered = text.toLocaleLowerCase();
  return entry.context.some((term) => lowered.includes(term.toLocaleLowerCase()));
}

function enhanceSegmentText(segmentId: string, source: string, vocabulary: WorkspaceVocabulary) {
  let text = source;
  const changes: VocabularyChange[] = [];
  for (const entry of vocabulary.entries) {
    if (entry.preferredScript === "preserve") continue;
    const candidates = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of candidates) {
      if (!hasContext(source, entry)) continue;
      const expression = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(alias)}(?![\\p{L}\\p{N}])`, "giu");
      text = text.replace(expression, (matched) => {
        if (matched === entry.canonicalForm) return matched;
        changes.push(vocabularyChangeSchema.parse({
          segmentId,
          original: matched,
          canonical: entry.canonicalForm,
          category: entry.category,
          preferredScript: entry.preferredScript,
          confidence: 0.98,
          evidence: source.slice(0, 400),
        }));
        return entry.canonicalForm;
      });
    }
  }
  return { text, changes };
}

export function enhanceTranscriptWithVocabulary(input: TranscriptInput, vocabularyValue: unknown) {
  const vocabulary = workspaceVocabularySchema.parse(vocabularyValue);
  const changes: VocabularyChange[] = [];
  const segments = input.segments.map((segment) => {
    const enhanced = enhanceSegmentText(segment.id, segment.text, vocabulary);
    changes.push(...enhanced.changes);
    return { ...segment, text: enhanced.text };
  });
  const text = changes.length > 0 ? segments.map((segment) => segment.text).join(" ") : input.text;
  return {
    enhancedTranscript: createTranscriptSnapshot({ text, segments }),
    vocabularyChanges: changes,
  };
}

const DIALECT_MARKERS: Record<Exclude<z.infer<typeof dialectFamilySchema>, "Modern Standard Arabic" | "Mixed Arabic" | "Uncertain">, string[]> = {
  Egyptian: ["عايز", "معاد", "دلوقتي", "معلش"],
  Gulf: ["أبغى", "ابغى", "الحين", "وش", "يعطيك العافية"],
  Levantine: ["بدي", "هلأ", "هلق", "شو"],
  Sudanese: ["داير", "هسع"],
  Yemeni: ["اشتي", "دحين"],
};

function quote(value: string) {
  return value.length <= 400 ? value : `${value.slice(0, 397)}...`;
}

export function detectDialectObservations(input: TranscriptInput): DialectObservation[] {
  const speakers = [...new Set(input.segments.map((segment) => segment.speakerId))];
  return speakers.map((speakerId) => {
    const speakerSegments = input.segments.filter((segment) => segment.speakerId === speakerId);
    const matches = Object.entries(DIALECT_MARKERS).map(([family, markers]) => {
      const evidence = speakerSegments.flatMap((segment) => {
        const found = markers.filter((marker) => segment.text.includes(marker));
        return found.length ? [{
          segmentId: segment.id,
          quote: quote(segment.text),
          explanation: `Lexical markers observed: ${found.join(", ")}.`,
        }] : [];
      });
      return { family: family as z.infer<typeof dialectFamilySchema>, evidence, score: evidence.length };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

    const best = matches[0];
    const tied = best ? matches.filter((item) => item.score === best.score) : [];
    const mixedDialect = matches.length > 1;
    const family = !best ? "Uncertain" : tied.length > 1 ? "Mixed Arabic" : best.family;
    const confidence = !best ? 0.35 : tied.length > 1 ? 0.72 : best.score > 1 ? 0.86 : 0.68;
    const evidence = best?.evidence ?? [{
      segmentId: speakerSegments[0].id,
      quote: quote(speakerSegments[0].text),
      explanation: "No sufficiently distinctive configured dialect marker was found.",
    }];
    return dialectObservationSchema.parse({
      segmentIds: [...new Set(evidence.map((item) => item.segmentId))],
      speakerId,
      dialectFamily: family,
      confidence,
      alternatives: matches.slice(family === "Mixed Arabic" ? 0 : 1, 4).map((item) => item.family),
      evidence,
      mixedDialect,
      notes: family === "Uncertain"
        ? "Probabilistic linguistic interpretation only; the available words do not support a broad dialect-family conclusion."
        : "Broad linguistic-family interpretation only. It does not infer nationality, ethnicity, identity, or origin.",
      source: "deterministic_lexical",
    });
  });
}

function scriptsIn(text: string) {
  const scripts: Array<"Arabic" | "Latin" | "Other"> = [];
  if (/\p{Script=Arabic}/u.test(text)) scripts.push("Arabic");
  if (/\p{Script=Latin}/u.test(text)) scripts.push("Latin");
  if (scripts.length === 0 && /\p{L}/u.test(text)) scripts.push("Other");
  return scripts;
}

export function detectCodeSwitchingObservations(input: TranscriptInput, vocabularyValue: unknown): CodeSwitchingObservation[] {
  const vocabulary = workspaceVocabularySchema.parse(vocabularyValue);
  return input.segments.flatMap((segment) => {
    const scripts = scriptsIn(segment.text);
    if (!(scripts.includes("Arabic") && scripts.includes("Latin"))) return [];
    const preservedTerms = vocabulary.entries
      .filter((entry) => entry.preferredScript === "latin" && segment.text.toLocaleLowerCase().includes(entry.canonicalForm.toLocaleLowerCase()))
      .map((entry) => entry.canonicalForm);
    return [codeSwitchingObservationSchema.parse({
      segmentIds: [segment.id],
      speakerId: segment.speakerId,
      languages: ["Arabic", "English"],
      scripts: ["Arabic", "Latin"],
      preservedTerms,
      explanation: preservedTerms.length
        ? `Arabic and Latin scripts occur together; approved terms remain canonical: ${preservedTerms.join(", ")}.`
        : "Arabic and Latin scripts occur in the same provider segment.",
      confidence: 0.99,
      source: "deterministic_script",
    })];
  });
}

const PROVIDER_MARKERS: Array<{ type: "unclear" | "overlap" | "laughter"; expressions: RegExp[] }> = [
  { type: "unclear", expressions: [/\[غير واضح\]/u, /\[unclear\]/iu] },
  { type: "overlap", expressions: [/\[تداخل في الكلام\]/u, /\[overlap\]/iu] },
  { type: "laughter", expressions: [/\[ضحك\]/u, /\[laughter\]/iu] },
];

export function detectTranscriptAnnotations(input: TranscriptInput): UncertaintyAnnotation[] {
  const annotations: UncertaintyAnnotation[] = [];
  for (const segment of input.segments) {
    for (const marker of PROVIDER_MARKERS) {
      if (!marker.expressions.some((expression) => expression.test(segment.text))) continue;
      annotations.push(uncertaintyAnnotationSchema.parse({
        type: marker.type,
        segmentIds: [segment.id],
        timeRange: { start: segment.start, end: segment.end },
        source: "provider",
        confidence: 1,
        note: "The annotation is retained because it was explicitly present in provider transcript text.",
      }));
    }
  }

  const ordered = [...input.segments].sort((a, b) => a.start - b.start || a.end - b.end);
  let active: typeof ordered = [];
  for (const segment of ordered) {
    active = active.filter((candidate) => candidate.end > segment.start);
    for (const candidate of active) {
      if (candidate.speakerId === segment.speakerId) continue;
      const start = Math.max(candidate.start, segment.start);
      const end = Math.min(candidate.end, segment.end);
      if (end <= start) continue;
      annotations.push(uncertaintyAnnotationSchema.parse({
        type: "overlap",
        segmentIds: [candidate.id, segment.id],
        timeRange: { start, end },
        source: "deterministic_timing",
        confidence: 1,
        note: "Cross-speaker provider timestamps overlap; this does not infer intent or rudeness.",
      }));
    }
    active.push(segment);
  }
  return annotations;
}

export function validateEnrichmentReferences(value: unknown, segmentIds: Iterable<string>) {
  const parsed = arabicEnrichmentResponseSchema.safeParse(value);
  if (!parsed.success) return { success: false as const, reason: "schema" };
  const valid = new Set(segmentIds);
  const referenced = [
    ...parsed.data.dialectObservations.flatMap((item) => [...item.segmentIds, ...item.evidence.map((evidence) => evidence.segmentId)]),
    ...parsed.data.codeSwitchingObservations.flatMap((item) => item.segmentIds),
    ...parsed.data.annotations.flatMap((item) => item.segmentIds),
  ];
  if (referenced.some((id) => !valid.has(id))) return { success: false as const, reason: "segment_reference" };
  return { success: true as const, data: parsed.data };
}

export function mergeEnrichment(
  deterministic: Pick<ArabicIntelligenceMetadata, "dialectObservations" | "codeSwitchingObservations" | "annotations">,
  inferred: ArabicEnrichmentResponse,
) {
  const dialectBySpeaker = new Map(deterministic.dialectObservations.map((item) => [item.speakerId, item]));
  for (const item of inferred.dialectObservations) dialectBySpeaker.set(item.speakerId, item);
  const annotationKeys = new Set(deterministic.annotations.map((item) => `${item.type}:${item.segmentIds.join(",")}:${item.source}`));
  const annotations = [...deterministic.annotations];
  for (const item of inferred.annotations) {
    const key = `${item.type}:${item.segmentIds.join(",")}:${item.source}`;
    if (!annotationKeys.has(key)) annotations.push(item);
  }
  return {
    dialectObservations: [...dialectBySpeaker.values()],
    codeSwitchingObservations: inferred.codeSwitchingObservations.length > 0
      ? inferred.codeSwitchingObservations
      : deterministic.codeSwitchingObservations,
    annotations,
  };
}

function safeOptionalEnrichmentReason(error: unknown) {
  return error instanceof Error && error.name
    ? `Optional enrichment failed safely (${error.name}).`
    : "Optional enrichment failed safely.";
}

export async function resolveOptionalArabicEnrichment(
  deterministic: ArabicIntelligenceMetadata,
  segmentIds: Iterable<string>,
  model: string,
  operation: () => Promise<ArabicEnrichmentResponse>,
): Promise<ArabicIntelligenceMetadata> {
  try {
    const inferred = await operation();
    const validated = validateEnrichmentReferences(inferred, segmentIds);
    if (!validated.success) throw new Error(`invalid_enrichment_${validated.reason}`);
    return arabicIntelligenceMetadataSchema.parse({
      ...deterministic,
      ...mergeEnrichment(deterministic, validated.data),
      enrichment: {
        status: "completed",
        apiCalls: 1,
        model,
        reason: "Optional structured linguistic enrichment completed and passed evidence validation.",
      },
    });
  } catch (error) {
    return arabicIntelligenceMetadataSchema.parse({
      ...deterministic,
      enrichment: {
        status: "fallback",
        apiCalls: 1,
        model,
        reason: safeOptionalEnrichmentReason(error),
      },
    });
  }
}

export function createDeterministicArabicIntelligence(
  raw: TranscriptInput,
  vocabularyValue: unknown,
  preprocessing: PreprocessingDiagnostic,
) {
  const vocabulary = workspaceVocabularySchema.parse(vocabularyValue);
  const rawTranscript = createTranscriptSnapshot(raw);
  const enhanced = enhanceTranscriptWithVocabulary(raw, vocabulary);
  const enhancedInput: TranscriptInput = enhanced.enhancedTranscript;
  return {
    rawTranscript,
    enhancedTranscript: enhanced.enhancedTranscript,
    metadata: arabicIntelligenceMetadataSchema.parse({
      feature: "Arabic Transcription Intelligence",
      mode: "arabic_intelligence",
      languageHint: "ar",
      prefixProtectionMs: 600,
      vocabularyChanges: enhanced.vocabularyChanges,
      dialectObservations: detectDialectObservations(enhancedInput),
      codeSwitchingObservations: detectCodeSwitchingObservations(enhancedInput, vocabulary),
      annotations: detectTranscriptAnnotations(rawTranscript),
      preprocessing,
      enrichment: {
        status: "deterministic_only",
        apiCalls: 0,
        model: null,
        reason: "Deterministic transcript intelligence completed before optional model enrichment.",
      },
    }),
  };
}
