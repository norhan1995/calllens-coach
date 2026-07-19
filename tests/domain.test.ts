import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SCORECARDS,
  MAX_AUDIO_BYTES,
  analysisResponseSchema,
  buildReportModel,
  isRtlContent,
  mapAnalysisState,
  maskSensitiveInformation,
  parseAnalysisResponse,
  qaScorecardSchema,
  validateAudioFile,
} from "../app/lib/domain.ts";
import { SAMPLE_ANALYSIS, SAMPLE_PRIVACY } from "../app/lib/sample-analysis.ts";

test("the complete sample satisfies the strict analysis schema and score bounds", () => {
  assert.equal(analysisResponseSchema.safeParse(SAMPLE_ANALYSIS).success, true);
  const invalid = { ...SAMPLE_ANALYSIS, complianceScore: 101 };
  assert.equal(analysisResponseSchema.safeParse(invalid).success, false);
});

test("malformed and incomplete AI responses are rejected", () => {
  assert.equal(parseAnalysisResponse("not json").success, false);
  assert.equal(parseAnalysisResponse({ overallScore: 88 }).success, false);
  assert.equal(parseAnalysisResponse({ ...SAMPLE_ANALYSIS, strengths: [{ title: "No evidence", detail: "Missing evidence", evidence: [] }] }).success, false);
});

test("every default QA scorecard totals exactly 100 percent", () => {
  for (const scorecard of DEFAULT_SCORECARDS) {
    assert.equal(qaScorecardSchema.safeParse(scorecard).success, true, scorecard.name);
    assert.equal(scorecard.categories.reduce((sum, item) => sum + item.weight, 0), 100);
  }
  const invalid = structuredClone(DEFAULT_SCORECARDS[0]);
  invalid.categories[0].weight = 9;
  assert.equal(qaScorecardSchema.safeParse(invalid).success, false);
});

test("privacy masking detects supported patterns and reports what changed", () => {
  const transcript = "Email jordan@example.com, phone +1 415 555 0138, account number AC-739204, patient ID PT-584921.";
  const masked = maskSensitiveInformation(transcript, true);
  assert.equal(masked.summary.detectedCount, 4);
  assert.equal(masked.summary.maskedCount, 4);
  assert.deepEqual(new Set(masked.summary.types), new Set(["email", "phone", "account number", "patient identifier"]));
  assert.doesNotMatch(masked.transcript, /jordan@example\.com|AC-739204|PT-584921/);
  const detectedOnly = maskSensitiveInformation(transcript, false);
  assert.equal(detectedOnly.summary.detectedCount, 4);
  assert.equal(detectedOnly.summary.maskedCount, 0);
  assert.equal(detectedOnly.transcript, transcript);
});

test("audio validation covers empty, oversized, unsupported, and accepted files", () => {
  assert.equal(validateAudioFile({ name: "call.mp3", size: 0 }), "The selected audio file is empty.");
  assert.equal(validateAudioFile({ name: "call.wav", size: MAX_AUDIO_BYTES + 1 }), "Audio files must be 25 MB or smaller.");
  assert.match(validateAudioFile({ name: "call.txt", size: 100 }) ?? "", /MP3/);
  for (const extension of ["mp3", "wav", "m4a", "mp4", "mpeg", "mpga", "ogg", "webm", "flac"]) {
    assert.equal(validateAudioFile({ name: `call.${extension}`, size: 1024 }), null);
  }
});

test("Arabic and mixed-language content selects RTL rendering", () => {
  assert.equal(isRtlContent("Arabic", "hello"), true);
  assert.equal(isRtlContent("Mixed Arabic and English", "hello"), true);
  assert.equal(isRtlContent("English", "أبشر، I will help"), true);
  assert.equal(isRtlContent("English", "I will help"), false);
});

test("analysis state mapping keeps validated coaching and report data together", () => {
  const mapped = mapAnalysisState(SAMPLE_ANALYSIS, SAMPLE_PRIVACY, { agentName: "Maya", callType: "Service", language: "English", dialect: "Mixed" });
  assert.equal(mapped.analysisSource, "live");
  assert.equal(mapped.coachingPlan.length, 7);
  assert.equal(mapped.reportData.analysis.overallScore, 88);
  assert.equal(mapped.privacy.maskedCount, 2);
});

test("report model renders the current analysis data without substituting content", () => {
  const report = buildReportModel(SAMPLE_ANALYSIS, { agentName: "Maya", callType: "Billing", language: "English", dialect: "Gulf influence" });
  assert.equal(report.title, "CallLens Coach — Manager Quality Report");
  assert.equal(report.metadata.agentName, "Maya");
  assert.equal(report.analysis.executiveSummary, SAMPLE_ANALYSIS.executiveSummary);
  assert.equal(report.analysis.criticalMoments[0].evidenceQuote, SAMPLE_ANALYSIS.criticalMoments[0].evidenceQuote);
  assert.equal(report.analysis.sevenDayCoachingPlan.length, 7);
});
