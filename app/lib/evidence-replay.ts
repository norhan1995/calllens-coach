import { z } from "zod";
import {
  evidenceReferenceSchema,
  formatAudioTimestamp,
  speakerRoleSchema,
  validateEvidenceReferences,
  type AudioTranscriptSegment,
  type DiarizedTranscriptionResult,
} from "./audio-domain.ts";

export const replayEventTypes = ["milestone", "finding", "warning", "coaching"] as const;

export const replayFindingSchema = z.object({
  id: z.string().trim().min(1),
  segmentId: z.string().trim().min(1),
  timestamp: z.number().finite().min(0).nullable(),
  positionLabel: z.string().trim().min(1).nullable(),
  eventType: z.enum(replayEventTypes),
  title: z.string().trim().min(1),
  speaker: speakerRoleSchema,
  quote: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  category: z.string().trim().min(1),
  suggestedResponse: z.string().trim().min(1).nullable(),
  coachingRecommendation: z.string().trim().min(1),
  improvedResponse: z.string().trim().min(1).nullable(),
}).strict().refine((finding) => finding.timestamp !== null || finding.positionLabel !== null, {
  message: "Replay findings need a verified timestamp or a source position label.",
});

export type ReplayFinding = z.infer<typeof replayFindingSchema>;

export function validateReplayFindings(findings: ReplayFinding[], result: DiarizedTranscriptionResult) {
  const parsed = z.array(replayFindingSchema).safeParse(findings);
  if (!parsed.success) return { validFindings: [] as ReplayFinding[], errors: ["Replay findings have an invalid shape."] };

  const validFindings: ReplayFinding[] = [];
  const errors: string[] = [];
  for (const finding of parsed.data) {
    const segment = result.segments.find((item) => item.id === finding.segmentId);
    if (!segment) { errors.push(`Missing segment ${finding.segmentId}.`); continue; }
    if (finding.timestamp === null) {
      if (!segment.text.includes(finding.quote)) errors.push(`Quote is not present in segment ${finding.segmentId}.`);
      else if (segment.role !== finding.speaker) errors.push(`Mapped role does not match segment ${finding.segmentId}.`);
      else validFindings.push(finding);
      continue;
    }
    const reference = evidenceReferenceSchema.parse({
      segmentId: finding.segmentId,
      quote: finding.quote,
      timestamp: finding.timestamp,
      role: finding.speaker,
    });
    const validation = validateEvidenceReferences([reference], result);
    if (!validation.valid) errors.push(...validation.errors);
    else validFindings.push(finding);
  }
  return { validFindings, errors };
}

export function formatReplayLocation(finding: Pick<ReplayFinding, "timestamp" | "positionLabel">) {
  if (finding.timestamp !== null) return formatAudioTimestamp(finding.timestamp);
  return finding.positionLabel ?? "Position unavailable";
}

export function replaySelection(
  finding: Pick<ReplayFinding, "segmentId" | "timestamp">,
  audioAvailable: boolean,
) {
  return {
    activeSegmentId: finding.segmentId,
    seekTo: audioAvailable && finding.timestamp !== null ? finding.timestamp : null,
  };
}

export function activeSegmentAtTime(segments: AudioTranscriptSegment[], currentPlaybackTime: number) {
  return segments.find((segment) => currentPlaybackTime >= segment.start && currentPlaybackTime <= segment.end)?.id ?? null;
}
