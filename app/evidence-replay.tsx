"use client";

import { useEffect, useMemo, useState } from "react";
import { formatAudioTimestamp, type AudioTranscriptSegment, type DiarizedTranscriptionResult } from "./lib/audio-domain";
import { activeSegmentAtTime, formatReplayLocation, replaySelection, validateReplayFindings, type ReplayFinding } from "./lib/evidence-replay";
import { SAMPLE_REPLAY_FINDINGS, SAMPLE_REPLAY_TRANSCRIPTION } from "./lib/sample-evidence-replay";

type EvidenceReplayProps = {
  segments: AudioTranscriptSegment[];
  currentPlaybackTime: number;
  onSeek: (seconds: number) => void;
  findings: ReplayFinding[];
  activeSegmentId: string | null;
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string | null) => void;
  audioAvailable: boolean;
};

export function EvidenceReplay({ segments, currentPlaybackTime, onSeek, findings, activeSegmentId, selectedFindingId, onSelectFinding, audioAvailable }: EvidenceReplayProps) {
  const result = useMemo<DiarizedTranscriptionResult>(() => ({
    text: segments.map((segment) => segment.text).join(" "),
    duration: Math.max(...segments.map((segment) => segment.end), 1),
    segments,
    detectedLanguage: null,
    model: "replay-adapter",
    createdAt: "2026-07-19T00:00:00.000Z",
  }), [segments]);
  const validation = useMemo(() => validateReplayFindings(findings, result), [findings, result]);
  const selected = validation.validFindings.find((finding) => finding.id === selectedFindingId) ?? null;
  const highlightedSegmentId = selected?.segmentId ?? activeSegmentId ?? activeSegmentAtTime(segments, currentPlaybackTime);

  useEffect(() => {
    function closeDetails(event: KeyboardEvent) {
      if (event.key === "Escape" && selectedFindingId) onSelectFinding(null);
    }
    window.addEventListener("keydown", closeDetails);
    return () => window.removeEventListener("keydown", closeDetails);
  }, [onSelectFinding, selectedFindingId]);

  function choose(finding: ReplayFinding) {
    const selection = replaySelection(finding, audioAvailable);
    onSelectFinding(finding.id);
    if (selection.seekTo !== null) onSeek(selection.seekTo);
  }

  return <div className="evidence-replay-grid">
    <div className="replay-events" aria-label="Evidence replay events">
      {validation.validFindings.map((finding) => <button key={finding.id} type="button" className={`replay-event ${finding.eventType} ${selected?.id === finding.id ? "selected" : ""}`} onClick={() => choose(finding)} aria-pressed={selected?.id === finding.id}>
        <span>{formatReplayLocation(finding)}</span><i aria-hidden="true"/><div><b>{finding.title}</b><small>{finding.eventType} · {finding.category}</small></div>
      </button>)}
      {validation.errors.length > 0 && <p className="replay-validation" role="status">{validation.errors.length} invalid evidence reference{validation.errors.length === 1 ? " was" : "s were"} excluded.</p>}
    </div>
    <div className="replay-transcript" aria-label="Replay transcript">
      {segments.map((segment) => <article key={segment.id} className={highlightedSegmentId === segment.id ? "active" : ""} id={`replay-segment-${segment.id}`}>
        <button type="button" disabled={!audioAvailable} onClick={() => onSeek(segment.start)} aria-label={audioAvailable ? `Seek to ${formatAudioTimestamp(segment.start)}` : `Sample audio unavailable at ${formatAudioTimestamp(segment.start)}`}>{formatAudioTimestamp(segment.start)}</button>
        <div><small>{segment.role === "agent" ? "Agent" : segment.role === "customer" ? "Customer" : "Unknown speaker"}</small><p>{segment.text}</p></div>
      </article>)}
    </div>
    <aside className={`replay-detail ${selected ? "open" : ""}`} aria-live="polite" aria-label="Selected evidence detail">
      {selected ? <><button type="button" className="replay-close" onClick={() => onSelectFinding(null)} aria-label="Close evidence detail">×</button><span className={`tag ${selected.eventType === "warning" ? "amber" : "teal"}`}>{selected.eventType.toUpperCase()}</span><h3>{selected.title}</h3><small>{formatReplayLocation(selected)} · {selected.speaker === "agent" ? "Agent" : "Customer"} · {selected.category}</small><blockquote>“{selected.quote}”</blockquote><p>{selected.explanation}</p><div><b>Coaching recommendation</b><p>{selected.coachingRecommendation}</p></div>{selected.improvedResponse && <div className="replay-improved"><b>Improved response</b><p>{selected.improvedResponse}</p></div>}</> : <><span className="eyebrow">SELECT AN EVENT</span><h3>Inspect grounded evidence</h3><p>Choose a timeline event to highlight its transcript segment, explanation, coaching recommendation, and improved response.</p></>}
    </aside>
  </div>;
}

export function SampleEvidenceReplay() {
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(SAMPLE_REPLAY_FINDINGS[0]?.id ?? null);
  const selectedSegmentId = SAMPLE_REPLAY_FINDINGS.find((finding) => finding.id === selectedFindingId)?.segmentId ?? null;
  return <section className="panel replay-panel" id="replay">
    <div className="panel-head replay-heading"><div><span className="eyebrow accent">SAMPLE EVIDENCE REPLAY · NO PLAYABLE AUDIO</span><h2>Follow the finding back to the exact transcript moment</h2><p>This is a deterministic sample fixture. Event selection highlights verified transcript evidence; playback and seeking are disabled because no recording is included.</p></div><span className="replay-audio-badge">Transcript-only sample</span></div>
    <EvidenceReplay segments={SAMPLE_REPLAY_TRANSCRIPTION.segments} currentPlaybackTime={0} onSeek={() => undefined} findings={SAMPLE_REPLAY_FINDINGS} activeSegmentId={selectedSegmentId} selectedFindingId={selectedFindingId} onSelectFinding={setSelectedFindingId} audioAvailable={false}/>
  </section>;
}
