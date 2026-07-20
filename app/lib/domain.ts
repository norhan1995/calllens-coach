import { z } from "zod";
import {
  audioMetricsSchema,
  diarizedTranscriptionResultSchema,
  speakerMappingSchema,
  type DiarizedTranscriptionResult,
} from "./audio-domain.ts";

export {
  DEFAULT_MAX_AUDIO_BYTES as MAX_AUDIO_BYTES,
  SUPPORTED_AUDIO_EXTENSIONS,
  validateAudioFile,
} from "./audio-domain.ts";

export const LIVE_AI_MISSING_MESSAGE =
  "Live AI is not configured. Add OPENAI_API_KEY to .env.local.";

export const scoreCategorySchema = z.enum([
  "greeting",
  "needsDiscovery",
  "empathy",
  "accuracy",
  "objectionHandling",
  "callControl",
  "closing",
  "compliance",
]);

export const languageSchema = z.enum(["Auto Detect", "English", "Arabic"]);
export const dialectSchema = z.enum([
  "Auto Detect",
  "Egyptian Arabic",
  "Gulf Arabic",
  "Modern Standard Arabic",
  "Levantine Arabic",
  "English",
  "Mixed Arabic and English",
]);

export const transcriptSegmentSchema = z.object({
  start: z.number().min(0).nullable(),
  end: z.number().min(0).nullable(),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

export const rubricCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(100),
});

export const qaScorecardSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    categories: z.array(rubricCategorySchema).min(1),
  })
  .superRefine((scorecard, context) => {
    const total = scorecard.categories.reduce((sum, category) => sum + category.weight, 0);
    if (Math.abs(total - 100) > 0.001) {
      context.addIssue({
        code: "custom",
        message: "QA scorecard weights must total 100%.",
        path: ["categories"],
      });
    }
  });

export const analysisRequestSchema = z.object({
  transcript: z.string().trim().min(80).max(100_000),
  agentName: z.string().trim().min(1).max(120),
  callType: z.string().trim().min(1).max(120),
  selectedLanguage: languageSchema,
  selectedDialect: dialectSchema,
  scorecard: qaScorecardSchema,
  segments: z.array(transcriptSegmentSchema).max(5_000).optional(),
  speakerMapping: speakerMappingSchema.optional(),
  audioMetrics: audioMetricsSchema.optional(),
  maskSensitiveInformation: z.boolean().default(true),
});

export const evidenceSchema = z.object({
  quote: z.string().min(1),
  speaker: z.enum(["Agent", "Customer", "Unknown"]),
  explanation: z.string().min(1),
  timestamp: z.string().nullable(),
  category: scoreCategorySchema,
});

export const findingSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
});

export const improvedPhraseSchema = z.object({
  original: z.string().min(1),
  improved: z.string().min(1),
  explanation: z.string().min(1),
  category: scoreCategorySchema,
  evidence: evidenceSchema,
});

export const criticalMomentSchema = z.object({
  position: z.string().min(1),
  speaker: z.enum(["Agent", "Customer", "Unknown"]),
  eventType: z.enum([
    "strong moment",
    "frustration",
    "empathy",
    "compliance risk",
    "missed opportunity",
    "objection",
    "successful recovery",
    "closing",
  ]),
  title: z.string().min(1),
  evidenceQuote: z.string().min(1),
  explanation: z.string().min(1),
  suggestedResponse: z.string().nullable(),
});

export const reconstructedTurnSchema = z.object({
  position: z.string().min(1),
  originalAgentResponse: z.string().min(1),
  improvedAgentResponse: z.string().min(1),
  explanation: z.string().min(1),
  category: scoreCategorySchema,
});

const boundedScore = z.number().int().min(0).max(100);

export const analysisResponseSchema = z.object({
  overallScore: boundedScore,
  greetingScore: boundedScore,
  needsDiscoveryScore: boundedScore,
  empathyScore: boundedScore,
  accuracyScore: boundedScore,
  objectionHandlingScore: boundedScore,
  callControlScore: boundedScore,
  closingScore: boundedScore,
  complianceScore: boundedScore,
  detectedLanguage: z.string().min(1),
  detectedDialect: z.string().min(1),
  customerSentiment: z.string().min(1),
  customerIntent: z.string().min(1),
  executiveSummary: z.string().min(1),
  strengths: z.array(findingSchema),
  mistakes: z.array(findingSchema),
  complianceWarnings: z.array(findingSchema),
  missedOpportunities: z.array(findingSchema),
  coachingRecommendations: z.array(findingSchema),
  improvedPhrases: z.array(improvedPhraseSchema),
  customerFollowUpMessage: z.string(),
  confidenceScore: boundedScore,
  dialectInsight: z.object({
    detectedDialect: z.string().min(1),
    detectedCodeSwitching: z.boolean(),
    importantExpression: z.string().min(1),
    literalInterpretation: z.string().min(1),
    contextualInterpretation: z.string().min(1),
    qaImportance: z.string().min(1),
  }),
  criticalMoments: z.array(criticalMomentSchema),
  improvedConversation: z.array(reconstructedTurnSchema),
  estimatedRevisedScore: boundedScore,
  sevenDayCoachingPlan: z.array(
    z.object({
      day: z.number().int().min(1).max(7),
      focus: z.string().min(1),
      action: z.string().min(1),
      successMeasure: z.string().min(1),
    }),
  ).length(7),
});

export const privacySummarySchema = z.object({
  detectedCount: z.number().int().min(0),
  maskedCount: z.number().int().min(0),
  types: z.array(z.enum(["email", "phone", "payment card", "customer ID", "account number", "patient identifier"])),
});

export const transcriptionOutputSchema = diarizedTranscriptionResultSchema;

export const rolePlaySetupSchema = z.object({
  scenarioType: z.enum([
    "Angry billing customer",
    "Hesitant medical patient",
    "Price-sensitive sales prospect",
    "Customer requesting escalation",
    "Collections payment objection",
  ]),
  customerMood: z.enum(["Concerned", "Frustrated", "Angry", "Hesitant", "Skeptical"]),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  language: languageSchema.exclude(["Auto Detect"]),
  dialect: dialectSchema,
  coachingGoal: z.string().trim().min(3).max(500),
});

export const rolePlayRequestSchema = z.object({
  action: z.enum(["start", "respond", "feedback", "end"]),
  setup: rolePlaySetupSchema,
  turns: z.array(z.object({ role: z.enum(["customer", "agent"]), content: z.string().min(1) })).max(50),
  analyzedCallScore: boundedScore.nullable().optional(),
});

export const rolePlayResponseSchema = z.object({
  customerReply: z.string().nullable(),
  rolePlayScore: boundedScore.nullable(),
  strengths: z.array(z.string()),
  mistakes: z.array(z.string()),
  betterReply: z.string().nullable(),
  categoryFeedback: z.array(z.object({ category: z.string().min(1), feedback: z.string().min(1) })),
  recommendedNextPractice: z.string().nullable(),
  improvementComparedWithAnalyzedCall: z.string().nullable(),
  feedbackSummary: z.string().nullable(),
  isComplete: z.boolean(),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type PrivacySummary = z.infer<typeof privacySummarySchema>;
export type QAScorecard = z.infer<typeof qaScorecardSchema>;
export type TranscriptionOutput = DiarizedTranscriptionResult;
export type RolePlaySetup = z.infer<typeof rolePlaySetupSchema>;
export type RolePlayResponse = z.infer<typeof rolePlayResponseSchema>;

export const DEFAULT_SCORECARDS: QAScorecard[] = [
  {
    id: "general",
    name: "General Customer Service",
    categories: [
      { id: "greeting", label: "Greeting", weight: 10 },
      { id: "needsDiscovery", label: "Needs discovery", weight: 15 },
      { id: "empathy", label: "Empathy", weight: 15 },
      { id: "accuracy", label: "Accuracy", weight: 15 },
      { id: "objectionHandling", label: "Objection handling", weight: 10 },
      { id: "callControl", label: "Call control", weight: 10 },
      { id: "closing", label: "Closing", weight: 10 },
      { id: "compliance", label: "Compliance", weight: 15 },
    ],
  },
  {
    id: "medical",
    name: "Medical Booking",
    categories: [
      { id: "patientIdentification", label: "Patient identification", weight: 15 },
      { id: "appointmentAccuracy", label: "Appointment accuracy", weight: 20 },
      { id: "privacy", label: "Privacy", weight: 20 },
      { id: "urgencyEscalation", label: "Urgency escalation", weight: 15 },
      { id: "preparationInstructions", label: "Preparation instructions", weight: 15 },
      { id: "confirmationClosing", label: "Confirmation and closing", weight: 15 },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    categories: [
      { id: "needsDiscovery", label: "Needs discovery", weight: 25 },
      { id: "valueExplanation", label: "Value explanation", weight: 20 },
      { id: "objectionHandling", label: "Objection handling", weight: 20 },
      { id: "accuracy", label: "Accuracy", weight: 20 },
      { id: "closing", label: "Closing", weight: 15 },
    ],
  },
  {
    id: "collections",
    name: "Collections",
    categories: [
      { id: "verification", label: "Verification", weight: 15 },
      { id: "disclosureCompliance", label: "Disclosure compliance", weight: 20 },
      { id: "empathy", label: "Empathy", weight: 15 },
      { id: "paymentNegotiation", label: "Payment negotiation", weight: 20 },
      { id: "accurateCommitment", label: "Accurate commitment", weight: 15 },
      { id: "closing", label: "Closing", weight: 15 },
    ],
  },
];

const maskingRules = [
  { type: "email" as const, pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone" as const, pattern: /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g },
  { type: "payment card" as const, pattern: /\b(?:\d[ -]*?){13,19}\b/g },
  { type: "customer ID" as const, pattern: /\b(?:customer|client)\s*(?:id|number|#)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi },
  { type: "account number" as const, pattern: /\b(?:account|acct)\s*(?:number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi },
  { type: "patient identifier" as const, pattern: /\b(?:patient|medical|mrn)\s*(?:id|number|no\.?|#)?\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi },
];

export function maskSensitiveInformation(transcript: string, enabled = true) {
  let output = transcript;
  let detectedCount = 0;
  let maskedCount = 0;
  const types = new Set<PrivacySummary["types"][number]>();

  for (const rule of maskingRules) {
    const matches = output.match(rule.pattern) ?? [];
    detectedCount += matches.length;
    if (matches.length) types.add(rule.type);
    if (enabled) {
      output = output.replace(rule.pattern, () => {
        maskedCount += 1;
        return `[MASKED ${rule.type.toUpperCase()}]`;
      });
    }
  }

  return {
    transcript: output,
    summary: { detectedCount, maskedCount, types: [...types] } satisfies PrivacySummary,
  };
}

export function isRtlContent(language: string, text = "") {
  return language === "Arabic" || language.includes("Arabic") || /[\u0600-\u06ff]/.test(text);
}

export function getContentDirection(language: string, text = ""): "rtl" | "ltr" | "auto" {
  if (language === "Mixed Arabic and English") return "auto";
  if (language === "Arabic" || language.includes("Arabic")) return "rtl";
  return /[\u0600-\u06ff]/.test(text) ? "auto" : "ltr";
}

export function parseAnalysisResponse(value: unknown) {
  return analysisResponseSchema.safeParse(value);
}

export type ReportModel = {
  title: string;
  metadata: { agentName: string; callType: string; language: string; dialect: string };
  analysis: AnalysisResponse;
};

export function buildReportModel(
  analysis: AnalysisResponse,
  metadata: ReportModel["metadata"],
): ReportModel {
  return { title: "CallLens Coach — Manager Quality Report", metadata, analysis };
}

export function mapAnalysisState(
  analysis: AnalysisResponse,
  privacy: PrivacySummary,
  metadata: ReportModel["metadata"],
) {
  return {
    analysis,
    privacy,
    coachingPlan: analysis.sevenDayCoachingPlan,
    reportData: buildReportModel(analysis, metadata),
    analysisSource: "live" as const,
  };
}
