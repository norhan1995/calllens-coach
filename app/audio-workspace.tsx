"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  applySpeakerMapping,
  calculateAudioMetrics,
  diarizedTranscriptionResultSchema,
  editTranscriptSegment,
  formatAudioTimestamp,
  getSuggestedSpeakerMapping,
  replaceObjectUrl,
  serializeTranscriptJson,
  serializeTranscriptTxt,
  undoTranscriptSegment,
  validateAudioFile,
  type AudioMetrics,
  type DiarizedTranscriptionResult,
  type SpeakerMappingEntry,
} from "./lib/audio-domain";
import { appendTranscriptionRequestSettings } from "./lib/arabic-intelligence.ts";
import { isRtlContent } from "./lib/domain";
import { SAMPLE_AUDIO_MAPPING, SAMPLE_AUDIO_METRICS, SAMPLE_AUDIO_TRANSCRIPTION } from "./lib/sample-audio-analysis";
import { useCallLensState } from "./state";

const LIVE_TRANSCRIPTION_MISSING_MESSAGE = "Live transcription is not configured. Add OPENAI_API_KEY to .env.local.";
const TRANSCRIPTION_STAGES = [
  "Validating audio",
  "Preparing secure upload",
  "Transcribing speech",
  "Separating speakers",
  "Building timestamped transcript",
  "Preparing quality analysis",
] as const;
const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type AIStatus = { transcriptionConfigured: boolean; maxAudioFileMb: number; transcriptionModel: string };
type WorkflowState = "empty" | "invalid" | "ready" | "uploading" | "transcribing" | "mapping" | "complete" | "cancelled" | "error";

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function responseError(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || "The transcription request could not be completed.";
  } catch {
    return "The transcription request could not be completed.";
  }
}

function roleLabel(role: "agent" | "customer" | "unknown") {
  return role === "unknown" ? "Other / Unknown" : role[0].toUpperCase() + role.slice(1);
}

function downloadText(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AudioWorkspace({
  onContinue,
}: {
  onContinue: (result: DiarizedTranscriptionResult, mapping: SpeakerMappingEntry[], metrics: AudioMetrics) => Promise<void>;
}) {
  const { state, settings, updateState } = useCallLensState();
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [localDuration, setLocalDuration] = useState<number | null>(null);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowState>("empty");
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ai-status", { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() as Promise<AIStatus> : Promise.reject(new Error("status")))
      .then((value) => { if (active) setStatus(value); })
      .catch(() => { if (active) setStatus({ transcriptionConfigured: false, maxAudioFileMb: 25, transcriptionModel: "gpt-4o-transcribe-diarize" }); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  function clearAudio() {
    setObjectUrl((current) => replaceObjectUrl(current, null));
    setFile(null); setLocalDuration(null); setWorkflow("empty"); setProgress(-1); setError("");
    updateState({ transcription: null, speakerMapping: [], audioMetrics: null });
    if (fileRef.current) fileRef.current.value = "";
  }

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    abortRef.current?.abort();
    const maximum = (status?.maxAudioFileMb ?? 25) * 1024 * 1024;
    const issue = validateAudioFile(nextFile, maximum);
    updateState({ transcription: null, speakerMapping: [], audioMetrics: null });
    setLocalDuration(null); setProgress(-1);
    if (issue) {
      setObjectUrl((current) => replaceObjectUrl(current, null));
      setFile(null); setWorkflow("invalid"); setError(issue);
      return;
    }
    setObjectUrl((current) => replaceObjectUrl(current, nextFile));
    setFile(nextFile); setWorkflow("ready"); setProgress(0); setError("");
  }

  function onMetadata(audio: HTMLAudioElement) {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      setWorkflow("invalid"); setError("This audio file is corrupted or unreadable in this browser."); setProgress(0); return;
    }
    setLocalDuration(audio.duration); setWorkflow("ready"); setProgress(1);
    audio.playbackRate = settings.audio.playbackSpeed;
  }

  async function transcribe() {
    if (!file || workflow === "invalid") return;
    setError("");
    let liveStatus = status;
    if (!liveStatus) {
      try {
        const response = await fetch("/api/ai-status", { headers: { accept: "application/json" } });
        liveStatus = response.ok ? await response.json() as AIStatus : null;
      } catch { liveStatus = null; }
    }
    if (!liveStatus?.transcriptionConfigured) {
      setWorkflow("ready"); setProgress(1); setError(LIVE_TRANSCRIPTION_MISSING_MESSAGE);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setWorkflow("uploading"); setProgress(2);
    try {
      const form = new FormData();
      form.set("audio", file);
      appendTranscriptionRequestSettings(form, settings.transcription, state.metadata.selectedDialect);
      setWorkflow("transcribing");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "x-calllens-request-id": requestId() },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await responseError(response));
      setProgress(4);
      const payload = await response.json() as { transcription?: unknown };
      const parsed = diarizedTranscriptionResultSchema.safeParse(payload.transcription);
      if (!parsed.success) throw new Error("OpenAI returned an invalid diarized transcript. Nothing was displayed.");
      const mapping = getSuggestedSpeakerMapping(parsed.data);
      const mapped = applySpeakerMapping(parsed.data, mapping);
      setWorkflow("mapping"); setProgress(5);
      const metrics = calculateAudioMetrics(mapped, settings.audio);
      updateState({ transcript: mapped.text, transcription: mapped, speakerMapping: mapping, audioMetrics: metrics });
      setWorkflow("complete"); setProgress(6);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setWorkflow("cancelled"); setError("Transcription was cancelled. The audio remains ready to retry.");
      } else {
        setWorkflow("error"); setError(caught instanceof Error ? caught.message : "The transcription request could not be completed.");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function updateMapping(speakerId: string, role: SpeakerMappingEntry["role"]) {
    if (!state.transcription) return;
    const mapping = state.speakerMapping.map((entry) => entry.speakerId === speakerId ? { ...entry, role } : entry);
    const transcription = applySpeakerMapping(state.transcription, mapping);
    const audioMetrics = calculateAudioMetrics(transcription, settings.audio);
    updateState({ transcript: transcription.text, transcription, speakerMapping: mapping, audioMetrics });
  }

  function updateSegment(segmentId: string, text: string) {
    if (!state.transcription) return;
    const transcription = editTranscriptSegment(state.transcription, segmentId, text);
    updateState({ transcript: transcription.text, transcription, audioMetrics: calculateAudioMetrics(transcription, settings.audio) });
  }

  function undoSegment(segmentId: string) {
    if (!state.transcription) return;
    const transcription = undoTranscriptSegment(state.transcription, segmentId);
    updateState({ transcript: transcription.text, transcription, audioMetrics: calculateAudioMetrics(transcription, settings.audio) });
  }

  async function continueToAnalysis() {
    if (!state.transcription || !state.audioMetrics || continuing) return;
    setContinuing(true); setError("");
    try { await onContinue(state.transcription, state.speakerMapping, state.audioMetrics); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "QA analysis could not start."); }
    finally { setContinuing(false); }
  }

  return <div className="audio-workspace">
    <div className="audio-topline"><div><span className="eyebrow">AUDIO TRANSCRIPTION WORKSPACE</span><p>Audio stays in temporary browser state and is uploaded only when live transcription is configured.</p></div><Link href="/sample-audio-analysis" className="secondary">View sample audio analysis</Link></div>
    <div
      className={`audio-dropzone ${dragging ? "dragging" : ""} ${workflow === "invalid" ? "invalid" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0] ?? null); }}
    >
      <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.ogg,.webm,.flac" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
      {!file ? <><span className="upload-icon">↑</span><b>Drop a call recording here</b><small>MP3, WAV, M4A, MP4, MPEG, MPGA, OGG, WebM, or FLAC · up to {status?.maxAudioFileMb ?? 25} MB</small><button className="secondary" onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}>Choose file</button></> :
        <div className="audio-file-summary"><span className="upload-icon ready">✓</span><div><b>{file.name}</b><small>{file.type || "Audio file"} · {(file.size / 1024 / 1024).toFixed(2)} MB · {localDuration ? formatAudioTimestamp(localDuration) : "checking duration…"}</small><em>{workflow === "invalid" ? "Unreadable" : localDuration ? "Validated and ready" : "Validating audio"}</em></div><div><button className="secondary" onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}>Replace</button><button className="danger-button" onClick={clearAudio}>Remove</button></div></div>}
    </div>

    {objectUrl && <AudioPlayer src={objectUrl} defaultSpeed={settings.audio.playbackSpeed} onMetadata={onMetadata} onUnreadable={() => { setWorkflow("invalid"); setError("This audio file is corrupted or unreadable in this browser."); }} />}
    {file && <TranscriptionProgress current={progress} workflow={workflow} />}
    {error && <div className="error" role="alert">⚠ <span><b>{workflow === "cancelled" ? "Transcription cancelled" : workflow === "invalid" ? "Invalid audio" : "Transcription unavailable"}</b><br />{error}</span></div>}
    {file && !state.transcription && <div className="audio-actions"><button className="primary" onClick={transcribe} disabled={workflow === "invalid" || workflow === "uploading" || workflow === "transcribing" || !localDuration}>✦ {workflow === "cancelled" || workflow === "error" ? "Retry transcription" : "Transcribe with speaker separation"}</button>{(workflow === "uploading" || workflow === "transcribing") && <button className="danger-button" onClick={cancel}>Cancel</button>}</div>}
    <p className="privacy-notice in-card">Privacy detection is not perfect. Avoid confidential production audio. Raw audio, transcripts, and API credentials are never stored in browser persistence.</p>

    {state.transcription && state.audioMetrics && <>
      <SpeakerMapping result={state.transcription} mapping={state.speakerMapping} metrics={state.audioMetrics} onChange={updateMapping} />
      <TranscriptViewer result={state.transcription} audioUrl={objectUrl} defaultAutoScroll={settings.audio.autoScrollTranscript} onEdit={updateSegment} onUndo={undoSegment} />
      {state.transcription.arabicIntelligence
        ? <ArabicIntelligencePanel result={state.transcription} />
        : <div className="panel future-insights"><div><span className="eyebrow">STANDARD TRANSCRIPTION</span><h3>No Arabic Intelligence was requested for this transcript</h3></div><span>Stable English workflow</span><span>Speaker diarization</span><span>Timestamped evidence</span><small>Select Arabic Intelligence before transcribing when evidence-linked dialect interpretation is needed.</small></div>}
      <AudioInsights result={state.transcription} metrics={state.audioMetrics} audioUrl={objectUrl} />
      <button className="analyze-button" onClick={continueToAnalysis} disabled={continuing}>{continuing ? "Starting QA analysis…" : "Continue to QA analysis"}</button>
    </>}
  </div>;
}

function TranscriptionProgress({ current, workflow }: { current: number; workflow: WorkflowState }) {
  const accessible = workflow === "complete" ? "Transcription ready" : workflow === "cancelled" ? "Transcription cancelled" : workflow === "error" ? "Transcription error" : current >= 0 ? TRANSCRIPTION_STAGES[Math.min(current, 5)] : "Waiting for audio";
  return <div className="transcription-progress" aria-live="polite" aria-label={accessible}>{TRANSCRIPTION_STAGES.map((label, index) => {
    const complete = current > index;
    const active = current === index && workflow !== "complete";
    return <div key={label} className={complete ? "complete" : active ? "current" : ""}><i>{complete ? "✓" : index + 1}</i><span>{label}</span></div>;
  })}</div>;
}

function AudioPlayer({ src, defaultSpeed, onMetadata, onUnreadable }: { src: string; defaultSpeed: number; onMetadata: (audio: HTMLAudioElement) => void; onUnreadable: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(defaultSpeed);
  const [volume, setVolume] = useState(1);
  function seek(next: number) { if (audioRef.current) audioRef.current.currentTime = Math.max(0, Math.min(duration || 0, next)); }
  function toggle() { const audio = audioRef.current; if (!audio) return; if (audio.paused) void audio.play(); else audio.pause(); }
  return <div className="audio-player panel">
    <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); onMetadata(event.currentTarget); }} onError={onUnreadable} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    <button className="player-main" onClick={toggle} aria-label={playing ? "Pause audio" : "Play audio"}>{playing ? "Ⅱ" : "▶"}</button>
    <button onClick={() => seek(time - 5)} aria-label="Skip backward 5 seconds">−5</button>
    <div className="player-timeline"><input type="range" min="0" max={duration || 0} step="0.05" value={Math.min(time, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Audio position" /><small>{formatAudioTimestamp(time)} / {formatAudioTimestamp(duration)}</small></div>
    <button onClick={() => seek(time + 5)} aria-label="Skip forward 5 seconds">+5</button>
    <label>Speed<select value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value; }}>{PLAYBACK_SPEEDS.map((value) => <option key={value} value={value}>{value}x</option>)}</select></label>
    <label className="volume-control">Volume<input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (audioRef.current) audioRef.current.volume = value; }} /></label>
  </div>;
}

function SpeakerMapping({ result, mapping, metrics, onChange, readOnly = false }: { result: DiarizedTranscriptionResult; mapping: SpeakerMappingEntry[]; metrics: AudioMetrics; onChange: (speakerId: string, role: SpeakerMappingEntry["role"]) => void; readOnly?: boolean }) {
  const speakerIds = [...new Set(result.segments.map((segment) => segment.speakerId))];
  return <section className="panel speaker-mapping"><div className="panel-head"><div><span className="eyebrow">SPEAKER MAPPING</span><h2>Confirm who is speaking</h2></div><small>Suggested only: first speaker = Agent, second speaker = Customer. Voice characteristics are not used.</small></div><div className="speaker-grid">{speakerIds.map((speakerId) => {
    const speakerSegments = result.segments.filter((segment) => segment.speakerId === speakerId);
    const metric = metrics.speakers.find((item) => item.id === speakerId);
    const role = mapping.find((item) => item.speakerId === speakerId)?.role ?? "unknown";
    return <article key={speakerId}><div><b>Speaker {speakerId}</b><span>{metric?.speakingSeconds ?? 0}s · {speakerSegments.length} segments</span></div><select aria-label={`Map speaker ${speakerId}`} value={role} disabled={readOnly} onChange={(event) => onChange(speakerId, event.target.value as SpeakerMappingEntry["role"])}><option value="agent">Agent</option><option value="customer">Customer</option><option value="unknown">Other / Unknown</option></select><ul>{speakerSegments.slice(0, 3).map((segment) => <li key={segment.id}>“{segment.text.slice(0, 74)}{segment.text.length > 74 ? "…" : ""}”</li>)}</ul></article>;
  })}</div></section>;
}

function TranscriptViewer({ result, audioUrl, defaultAutoScroll, onEdit, onUndo, editable = true }: { result: DiarizedTranscriptionResult; audioUrl: string | null; defaultAutoScroll: boolean; onEdit: (id: string, text: string) => void; onUndo: (id: string) => void; editable?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [time, setTime] = useState(0);
  const [filter, setFilter] = useState<"all" | "agent" | "customer" | "unknown">("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(defaultAutoScroll);
  const [representation, setRepresentation] = useState<"enhanced" | "raw">("enhanced");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const displaySegments = representation === "raw" && result.rawTranscript
    ? result.rawTranscript.segments.map((raw) => {
        const current = result.segments.find((segment) => segment.id === raw.id)!;
        return { ...current, ...raw, originalText: raw.text, editedText: null, isEdited: false };
      })
    : result.segments;
  const displayText = representation === "raw" && result.rawTranscript ? result.rawTranscript.text : result.text;
  const active = displaySegments.find((segment) => time >= segment.start && time < segment.end)?.id ?? null;
  useEffect(() => { if (autoScroll && active) rowRefs.current.get(active)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [active, autoScroll]);
  const filtered = displaySegments.filter((segment) => (filter === "all" || segment.role === filter) && segment.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  function seek(seconds: number) { if (!audioRef.current) return; audioRef.current.currentTime = seconds; void audioRef.current.play(); }
  function copy(text: string) { void navigator.clipboard?.writeText(text); }
  return <section className="panel transcript-panel"><audio ref={audioRef} src={audioUrl ?? undefined} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
    <div className="panel-head"><div><span className="eyebrow">TIMESTAMPED TRANSCRIPT</span><h2>Review, seek, correct, and export</h2></div><div className="transcript-actions"><button onClick={() => copy(displayText)}>Copy full transcript</button><button onClick={() => downloadText("calllens-transcript.txt", serializeTranscriptTxt(result), "text/plain")}>Export TXT</button><button onClick={() => downloadText("calllens-transcript.json", serializeTranscriptJson(result), "application/json")}>Export JSON</button></div></div>
    {result.rawTranscript && <div className="transcript-representations" aria-label="Transcript representation"><button type="button" aria-pressed={representation === "enhanced"} className={representation === "enhanced" ? "selected" : ""} onClick={() => setRepresentation("enhanced")}>Enhanced transcript</button><button type="button" aria-pressed={representation === "raw"} className={representation === "raw" ? "selected" : ""} onClick={() => { setEditingId(null); setRepresentation("raw"); }}>Raw provider transcript</button><small>Raw text is immutable. Exports remain backward compatible and JSON includes both representations.</small></div>}
    <div className="transcript-toolbar"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transcript" aria-label="Search transcript" /><div className="filter-tabs" aria-label="Filter transcript by speaker">{(["all", "agent", "customer", "unknown"] as const).map((value) => <button type="button" aria-pressed={filter === value} key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : roleLabel(value)}</button>)}</div><label><input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} /> Auto-scroll</label></div>
    <div className="transcript-list">{filtered.map((segment) => <div ref={(node) => { if (node) rowRefs.current.set(segment.id, node); else rowRefs.current.delete(segment.id); }} key={segment.id} className={`transcript-row ${active === segment.id ? "active" : ""}`}>
      <button className="timestamp" onClick={() => seek(segment.start)} disabled={!audioUrl} aria-label={`Seek to ${formatAudioTimestamp(segment.start)}`}>{formatAudioTimestamp(segment.start)}</button><div className="speaker-pill"><b>{roleLabel(segment.role)}</b><small>Speaker {segment.speakerId}</small></div><div className="segment-copy" dir={isRtlContent(result.detectedLanguage ?? "", segment.text) ? "rtl" : "auto"}>{editingId === segment.id ? <textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={`Edit segment ${segment.id}`} /> : <p>{segment.text}</p>}{segment.isEdited && <span className="edited-badge">Edited</span>}</div><div className="row-actions">{editingId === segment.id ? <><button onClick={() => { onEdit(segment.id, draft); setEditingId(null); }}>Save</button><button onClick={() => setEditingId(null)}>Cancel</button></> : <><button onClick={() => copy(segment.text)}>Copy quote</button>{editable && representation === "enhanced" && <button onClick={() => { setEditingId(segment.id); setDraft(segment.text); }}>Edit</button>}{editable && representation === "enhanced" && segment.isEdited && <button onClick={() => onUndo(segment.id)}>Undo</button>}</>}</div>
    </div>)}</div>
  </section>;
}

function confidenceLabel(confidence: number) {
  return confidence >= 0.8 ? "High" : confidence >= 0.55 ? "Medium" : "Low";
}

function ArabicIntelligencePanel({ result }: { result: DiarizedTranscriptionResult }) {
  const intelligence = result.arabicIntelligence!;
  return <section className="panel arabic-intelligence-panel"><div className="panel-head"><div><span className="eyebrow accent">ARABIC TRANSCRIPTION INTELLIGENCE</span><h2>Evidence-linked linguistic observations</h2></div><span className="intelligence-status">{intelligence.enrichment.status === "completed" ? "Structured enrichment complete" : "Safe deterministic fallback"}</span></div>
    <div className="intelligence-summary"><span><b>{intelligence.transcriptCorrections.length}</b> high-confidence corrections</span><span><b>{intelligence.vocabularyChanges.length}</b> vocabulary normalizations</span><span><b>{intelligence.dialectObservations.length}</b> speaker interpretations</span><span><b>{intelligence.codeSwitchingObservations.length}</b> code-switching observations</span></div>
    <div className="intelligence-grid"><div><small>DIALECT INTERPRETATION · HINT: {intelligence.requestedDialect}</small>{intelligence.dialectObservations.length ? intelligence.dialectObservations.map((observation) => <article key={observation.speakerId}><b>Likely dialect: {observation.dialectFamily}</b><span>Speaker {observation.speakerId} · Confidence: {confidenceLabel(observation.confidence)} ({Math.round(observation.confidence * 100)}%)</span><span>Evidence: {observation.segmentIds.map((id) => `Segment ${id}`).join(", ")}</span><p>{observation.notes}</p></article>) : <article><b>Likely dialect: Uncertain</b><span>Confidence: Low</span><p>No validated speaker-level linguistic evidence was returned.</p></article>}</div>
      <div><small>CODE-SWITCHING OBSERVATION</small>{intelligence.codeSwitchingObservations.length ? intelligence.codeSwitchingObservations.map((observation, index) => <article key={`${observation.segmentIds.join("-")}-${index}`}><b>{observation.languages.join(" ↔ ")}</b><span>{observation.segmentIds.join(", ")}</span><p>{observation.explanation}</p></article>) : <p>No evidence-supported Arabic-English switch was detected.</p>}</div>
      <div><small>UNCERTAINTY AND NON-SPEECH</small>{intelligence.annotations.length ? intelligence.annotations.map((annotation, index) => <article key={`${annotation.type}-${annotation.segmentIds.join("-")}-${index}`}><b>{annotation.type}</b><span>{annotation.source} · {annotation.segmentIds.join(", ")}</span><p>{annotation.note}</p></article>) : <p>No provider or deterministic annotation was available.</p>}</div></div>
    <small className="intelligence-method">Preprocessing: {intelligence.preprocessing.status}. Opening protection retains {intelligence.prefixProtectionMs} ms before VAD-detected speech without modifying timestamps or original audio. The diarized provider accepts an Arabic language hint and VAD controls, but not prompt or vocabulary guidance; the selected dialect is consumed only by conservative enrichment. Dialect labels are probabilistic linguistic interpretations and never claims about nationality, ethnicity, identity, or origin.</small>
  </section>;
}

function AudioInsights({ result, metrics, audioUrl }: { result: DiarizedTranscriptionResult; metrics: AudioMetrics; audioUrl: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const agent = metrics.roles.find((role) => role.id === "agent");
  const customer = metrics.roles.find((role) => role.id === "customer");
  function seek(seconds: number) { if (!audioRef.current) return; audioRef.current.currentTime = seconds; void audioRef.current.play(); }
  const cards = [
    ["Call duration", formatAudioTimestamp(metrics.callDurationSeconds)],
    ["Agent talk", `${agent?.talkPercentage ?? 0}%`],
    ["Customer talk", `${customer?.talkPercentage ?? 0}%`],
    ["Agent speed", `${agent?.wordsPerMinute ?? 0} wpm`],
    ["Customer speed", `${customer?.wordsPerMinute ?? 0} wpm`],
    ["Silence duration", `${metrics.silenceSeconds}s`],
    ["Longest silence", `${metrics.longestSilenceSeconds}s`],
    ["Potential interruptions", String(metrics.potentialInterruptions)],
    ["Filler-word rate", `${metrics.fillerRatePer100Words}/100 words`],
  ];
  return <section className="audio-insights"><audio ref={audioRef} src={audioUrl ?? undefined} /><div className="panel-head"><div><span className="eyebrow">AUDIO INSIGHTS</span><h2>Deterministic metrics from timestamps and text</h2><p>Arabic word counts and speaking speed are approximate. Potential interruptions indicate overlap only—not intent or rudeness.</p></div></div><div className="audio-metric-cards">{cards.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
    <div className="audio-insight-grid"><div className="panel"><span className="eyebrow">TALK BALANCE</span><div className="talk-bar"><i style={{ width: `${agent?.talkPercentage ?? 0}%` }} /><em style={{ width: `${customer?.talkPercentage ?? 0}%` }} /></div><p>Agent {agent?.talkPercentage ?? 0}% · Customer {customer?.talkPercentage ?? 0}% · ratio {metrics.agentToCustomerTalkRatio ?? "n/a"}</p><small>Approximate speaking speed: Agent {agent?.wordsPerMinute ?? 0} wpm, Customer {customer?.wordsPerMinute ?? 0} wpm.</small></div>
      <div className="panel"><span className="eyebrow">SILENCE TIMELINE</span><h3>Possible dead air</h3>{metrics.pauses.filter((pause) => pause.severity !== "short").length ? metrics.pauses.filter((pause) => pause.severity !== "short").map((pause) => <button key={`${pause.start}-${pause.end}`} onClick={() => seek(pause.start)} disabled={!audioUrl}><b>{formatAudioTimestamp(pause.start)}</b><span>{pause.duration}s · {pause.severity === "severe" ? "Severe dead air" : "Possible dead air"}</span></button>) : <p>No gap crossed the configured dead-air threshold.</p>}</div>
      <div className="panel"><span className="eyebrow">OVERLAP AND INTERRUPTIONS</span><h3>Potential interruption inferred from overlapping timestamps.</h3>{metrics.overlaps.length ? metrics.overlaps.map((overlap) => <button key={`${overlap.firstSegmentId}-${overlap.secondSegmentId}`} onClick={() => seek(overlap.start)} disabled={!audioUrl}><b>{formatAudioTimestamp(overlap.start)}</b><span>Speakers {overlap.firstSpeakerId} + {overlap.secondSpeakerId} · {overlap.duration}s {overlap.potentialInterruption ? "· Potential interruption" : "· Brief overlap"}</span></button>) : <p>No cross-speaker overlap detected.</p>}</div>
      <div className="panel"><span className="eyebrow">FILLER WORDS</span><h3>{metrics.fillerCount} detected</h3>{metrics.fillers.length ? metrics.fillers.map((filler, index) => <button key={`${filler.segmentId}-${filler.phrase}-${index}`} onClick={() => seek(filler.timestamp)} disabled={!audioUrl}><b>{filler.phrase}</b><span>{roleLabel(filler.role)} · {filler.segmentId} · “{filler.quote.slice(0, 66)}{filler.quote.length > 66 ? "…" : ""}”</span></button>) : <p>No configured filler phrase detected.</p>}</div>
    </div><small className="metric-method">Metrics use the validated segment timestamps and current edited text. They are recalculated after speaker mapping or transcript edits and are never generated by an AI model. {result.segments.length} evidence-ready segment IDs are available.</small>
  </section>;
}

export function SampleAudioAnalysis() {
  return <section className="content"><div className="example-banner prominent"><b>Example output for interface exploration — not generated from this recording or session.</b><span>This fixed fixture is isolated from uploads and is never presented as live transcription.</span></div><div className="welcome"><div><span className="eyebrow accent">SAMPLE AUDIO ANALYSIS</span><h1>Explore speaker-separated call evidence.</h1><p>No recording is attached. Playback and live editing are intentionally unavailable in this sample view.</p></div><Link href="/analyze" className="primary">Upload your own audio</Link></div><SpeakerMapping result={SAMPLE_AUDIO_TRANSCRIPTION} mapping={SAMPLE_AUDIO_MAPPING} metrics={SAMPLE_AUDIO_METRICS} onChange={() => {}} readOnly /><TranscriptViewer result={SAMPLE_AUDIO_TRANSCRIPTION} audioUrl={null} defaultAutoScroll={false} onEdit={() => {}} onUndo={() => {}} editable={false} /><AudioInsights result={SAMPLE_AUDIO_TRANSCRIPTION} metrics={SAMPLE_AUDIO_METRICS} audioUrl={null} /></section>;
}
