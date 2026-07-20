import assert from "node:assert/strict";
import test from "node:test";
import { activeSegmentAtTime, formatReplayLocation, replaySelection, validateReplayFindings } from "../app/lib/evidence-replay.ts";
import { SAMPLE_REPLAY_FINDINGS, SAMPLE_REPLAY_TRANSCRIPTION } from "../app/lib/sample-evidence-replay.ts";

test("the sample replay uses six validated segment-grounded events", () => {
  const validation = validateReplayFindings(SAMPLE_REPLAY_FINDINGS, SAMPLE_REPLAY_TRANSCRIPTION);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.validFindings.length, 6);
  assert.deepEqual(validation.validFindings.map((finding) => formatReplayLocation(finding)), ["00:00", "00:18", "00:44", "01:02", "01:31", "02:10"]);
});

test("replay selection highlights evidence but seeks only when audio exists", () => {
  const finding = SAMPLE_REPLAY_FINDINGS[3];
  assert.deepEqual(replaySelection(finding, false), { activeSegmentId: "replay-004", seekTo: null });
  assert.deepEqual(replaySelection(finding, true), { activeSegmentId: "replay-004", seekTo: 62 });
  assert.equal(activeSegmentAtTime(SAMPLE_REPLAY_TRANSCRIPTION.segments, 62), "replay-004");
});

test("invalid segment, quote, role, and timestamp references are rejected", () => {
  const base = SAMPLE_REPLAY_FINDINGS[0];
  for (const invalid of [
    { ...base, id: "bad-segment", segmentId: "missing-segment" },
    { ...base, id: "bad-quote", quote: "Quote that is not in the transcript" },
    { ...base, id: "bad-role", speaker: "customer" as const },
    { ...base, id: "bad-time", timestamp: 99 },
  ]) {
    const validation = validateReplayFindings([invalid], SAMPLE_REPLAY_TRANSCRIPTION);
    assert.equal(validation.validFindings.length, 0);
    assert.equal(validation.errors.length > 0, true);
  }
});

test("pasted-transcript evidence keeps source positions and never invents a timestamp", () => {
  const pasted = { ...SAMPLE_REPLAY_FINDINGS[0], timestamp: null, positionLabel: "Opening third" };
  const validation = validateReplayFindings([pasted], SAMPLE_REPLAY_TRANSCRIPTION);
  assert.equal(validation.validFindings.length, 1);
  assert.equal(formatReplayLocation(pasted), "Opening third");
  assert.equal(replaySelection(pasted, true).seekTo, null);
});
