"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LIVE_AI_MISSING_MESSAGE,
  analysisResponseSchema,
  getContentDirection,
  isRtlContent,
  qaScorecardSchema,
  rolePlayResponseSchema,
  type AnalysisResponse,
  type PrivacySummary,
  type RolePlayResponse,
  type RolePlaySetup,
} from "./lib/domain";
import { AudioWorkspace, SampleAudioAnalysis } from "./audio-workspace";
import { SampleEvidenceReplay } from "./evidence-replay";
import { audioMetricSettingsSchema, type AudioMetrics, type DiarizedTranscriptionResult, type SpeakerMappingEntry } from "./lib/audio-domain";
import { SAMPLE_ANALYSIS, SAMPLE_PRIVACY } from "./lib/sample-analysis";
import { createDefaultDemoSettings, useCallLensState, type CallMetadata, type DemoSettings } from "./state";

type Page = "dashboard" | "analyze" | "results" | "coaching" | "practice" | "settings";

const samples = {
  English: `Agent: Thank you for calling Northstar Mobile. My name is Maya. How can I help today?\nCustomer: Hi, I was charged twice for my monthly plan and I’m really frustrated. My account number is AC-739204.\nAgent: I’m sorry you had to deal with that. I can see why a duplicate charge would be upsetting. Let me review the account with you. May I confirm the last four digits of your phone number?\nCustomer: It’s 4821. You can reach me on +1 415 555 0138.\nAgent: Thank you. I found both charges. One is a temporary authorization and should disappear within three business days. I’ll also send you a confirmation email now.\nCustomer: Okay, but I need to know this won’t happen again.\nAgent: Absolutely. I’ve checked that automatic billing is configured correctly. If the pending charge remains after three business days, reply to my email and we’ll reverse it immediately. Is there anything else I can help you with?\nCustomer: No, that’s all.\nAgent: Thank you for your patience, and for choosing Northstar Mobile. Have a good day.`,
  Arabic: `الموظف: أهلاً وسهلاً، شكراً لاتصالك بمركز الشفاء. معك سارة، كيف أقدر أخدمك؟\nالعميل: أريد أحجز موعد مع طبيب الجلدية، والموضوع مستعجل. رقم المريض PT-584921.\nالموظف: أبشر. أتفهم قلقك، وسأبحث لك عن أقرب موعد متاح. هل الموعد لك؟\nالعميل: نعم، وأفضل الفترة المسائية.\nالموظف: يوجد موعد غداً الساعة السادسة مساءً مع الدكتورة نورة. هل يناسبك؟\nالعميل: نعم مناسب، بس هل أحتاج أجيب أي شيء؟\nالموظف: تم الحجز. ستصلك رسالة تأكيد، ويرجى الحضور قبل الموعد بعشر دقائق وإحضار الهوية. هل تحتاج أي مساعدة أخرى؟\nالعميل: لا، شكراً.\nالموظف: سلامتك، ونتشرف بخدمتك.`,
};

const nav = [
  ["dashboard", "/", "⌂", "Dashboard"],
  ["analyze", "/analyze", "◉", "Analyze Call"],
  ["results", "/results", "▥", "Analysis Results"],
  ["coaching", "/coaching", "✦", "Coaching Plan"],
  ["practice", "/practice", "◌", "Practice Role-play"],
  ["settings", "/settings", "⚙", "Settings"],
] as const;

const DIALECTS: CallMetadata["selectedDialect"][] = ["Auto Detect", "Egyptian Arabic", "Gulf Arabic", "Modern Standard Arabic", "Levantine Arabic", "English", "Mixed Arabic and English"];
const CALL_TYPES = ["Customer Service", "Medical Booking", "Sales", "Collections"];
const ANALYSIS_STAGES = ["Uploading audio", "Transcribing", "Detecting speakers and language", "Analyzing quality", "Building coaching plan"];

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function responseError(response: Response) {
  try {
    const data = await response.json() as { error?: { message?: string } };
    return data.error?.message || "The request could not be completed.";
  } catch {
    return "The request could not be completed.";
  }
}

export function CallLensApp({ page, example = false, audioExample = false }: { page: Page; example?: boolean; audioExample?: boolean }) {
  return <div className="app-shell"><Sidebar page={page} /><main><AppHeader page={page} />
    {audioExample && <SampleAudioAnalysis />}
    {!audioExample && page === "dashboard" && <Dashboard />}
    {!audioExample && page === "analyze" && <Analyze />}
    {!audioExample && page === "results" && <Results example={example} />}
    {!audioExample && page === "coaching" && <Coaching />}
    {!audioExample && page === "practice" && <Practice />}
    {!audioExample && page === "settings" && <Settings />}
  </main></div>;
}

function Sidebar({ page }: { page: Page }) {
  return <aside className="sidebar">
    <Link href="/" className="brand"><span className="brand-mark">C</span><span>CallLens <b>Coach</b></span></Link>
    <nav>{nav.map(([id, href, icon, label]) => <Link key={id} href={href} className={page === id ? "active" : ""}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>
    <div className="demo-card"><span className="spark">✦</span><b>Secure live-AI mode</b><p>Example output is clearly labeled. Live analysis only runs when a server-side OpenAI key is configured.</p><Link href="/welcome">Product overview →</Link></div>
    <div className="profile"><span className="avatar">AM</span><div><b>Alex Morgan</b><small>QA Manager</small></div><span>⋮</span></div>
  </aside>;
}

function AppHeader({ page }: { page: Page }) {
  const { settings } = useCallLensState();
  return <header><span className="mobile-brand">C</span><div className="header-title"><span className="eyebrow">WORKSPACE / {settings.workspaceName.toUpperCase()}</span><b>{nav.find((item) => item[0] === page)?.[3]}</b></div><div className="header-actions"><Link className="welcome-link" href="/welcome">About</Link><span className="status"><i /> Build Week workspace</span></div></header>;
}

function Dashboard() {
  return <section className="content">
    <div className="welcome"><div><span className="eyebrow accent">CALL QUALITY OVERVIEW</span><h1>Good morning, Alex.</h1><p>Your workspace is ready for evidence-based QA in English and Arabic.</p></div><div className="button-row"><Link href="/sample-analysis" className="secondary">View sample analysis</Link><Link href="/analyze" className="primary">＋ Analyze a new call</Link></div></div>
    <div className="sample-dashboard-strip"><article className="panel"><span className="eyebrow accent">TODAY’S QA INSIGHT · SAMPLE</span><h2>Compliance is the sample call’s clearest coaching opportunity.</h2><p>Verification before resolution holds the sample compliance category to 76%, despite a strong empathetic recovery.</p><Link href="/sample-analysis#coaching">Open sample coaching →</Link></article><article className="panel"><span className="eyebrow">LATEST SAMPLE CALL</span><div className="sample-call-row"><div><b>Duplicate billing inquiry</b><small>Maya Hassan · Egyptian Arabic context · Evidence verified</small></div><strong>88<small>/100</small></strong></div><Link href="/sample-analysis">Review sample call →</Link></article></div>
    <div className="stat-grid"><Stat label="Average quality score" value="87" suffix="/100" trend="↑ 4.2%" tone="teal"/><Stat label="Calls analyzed" value="128" trend="↑ 12 this week" tone="blue"/><Stat label="Coaching actions" value="16" trend="5 completed" tone="amber"/><Stat label="Compliance rate" value="96.4" suffix="%" trend="↑ 1.8%" tone="violet"/></div>
    <div className="dashboard-grid"><div className="panel performance"><div className="panel-head"><div><span className="eyebrow">TEAM PERFORMANCE</span><h2>Quality score trend</h2></div><select aria-label="Time period"><option>Last 7 days</option><option>Last 30 days</option></select></div><div className="chart"><span className="chart-label y1">100</span><span className="chart-label y2">75</span><span className="chart-label y3">50</span><div className="chart-line"><i/><i/><i/><i/><i/><i/><i/></div><div className="chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div>
      <div className="panel focus"><span className="eyebrow">COACHING FOCUS</span><h2>Skills to improve</h2>{[["Objection handling",72],["Needs discovery",78],["Closing confidence",84]].map(([name,value])=><div className="skill" key={String(name)}><div><b>{name}</b><span>{value}%</span></div><div><i style={{width:`${value}%`}}/></div></div>)}<Link href="/coaching">View coaching plan →</Link></div></div>
    <div className="panel recent"><div className="panel-head"><div><span className="eyebrow">BUILD WEEK DEMO</span><h2>Explore every workflow safely</h2></div></div><div className="feature-strip"><Feature icon="ع" title="Dialect aware" text="Egyptian, Gulf, MSA, Levantine, English, and mixed calls."/><Feature icon="◎" title="Evidence first" text="Every major finding is grounded in a transcript quote."/><Feature icon="◈" title="Private by default" text="Optional server-side masking is enabled by default."/><Feature icon="↗" title="Coach to action" text="Reconstruction, role-play, and a seven-day plan."/></div></div>
  </section>;
}

function Stat({label,value,suffix,trend,tone}:{label:string;value:string;suffix?:string;trend:string;tone:string}) { return <div className={`stat ${tone}`}><div><span>{label}</span><b>{value}<small>{suffix}</small></b><em>{trend}</em></div><i className="stat-icon">↗</i></div>; }
function Feature({icon,title,text}:{icon:string;title:string;text:string}) { return <div className="feature-mini"><i>{icon}</i><div><b>{title}</b><p>{text}</p></div></div>; }

function Analyze() {
  const router = useRouter();
  const { state, settings, updateState, updateMetadata, setAnalysisResult } = useCallLensState();
  const [inputMode, setInputMode] = useState<"transcript" | "audio">("transcript");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(-1);
  const scorecard = settings.scorecards.find((item) => item.id === settings.selectedScorecardId) ?? settings.scorecards[0];

  function loadSample(kind: "English" | "Arabic") {
    updateState({ transcript: samples[kind], transcription: null, speakerMapping: [], audioMetrics: null });
    updateMetadata({ selectedLanguage: kind, selectedDialect: kind === "Arabic" ? "Auto Detect" : "English" });
    setInputMode("transcript"); setError("");
  }

  async function analyzeTranscript(
    transcript: string,
    segments?: Array<{start:number|null;end:number|null;speaker:string;text:string}>,
    speakerMapping?: SpeakerMappingEntry[],
    audioMetrics?: AudioMetrics,
  ) {
    setStage(3);
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", "x-calllens-request-id": requestId() },
      body: JSON.stringify({ transcript, ...state.metadata, scorecard, segments, speakerMapping, audioMetrics, maskSensitiveInformation: settings.maskSensitiveInformation }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const payload = await response.json() as { analysis?: unknown; privacy?: unknown };
    const parsedAnalysis = analysisResponseSchema.safeParse(payload.analysis);
    if (!parsedAnalysis.success) throw new Error("Live AI returned an invalid analysis. Nothing was displayed.");
    const privacy = payload.privacy as PrivacySummary;
    setStage(4);
    setAnalysisResult(parsedAnalysis.data, privacy);
    router.push("/results");
  }

  async function runAnalysis() {
    if (busy) return;
    if (state.transcript.trim().length < 80) { setError("Add at least 80 characters of conversation for a reliable analysis."); return; }
    if (!scorecard || !qaScorecardSchema.safeParse(scorecard).success) { setError("The selected QA scorecard weights must total 100%."); return; }
    setBusy(true); setError("");
    try {
      await analyzeTranscript(state.transcript);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysis could not be completed.");
      setStage(-1);
    } finally { setBusy(false); }
  }

  async function continueAudioAnalysis(result: DiarizedTranscriptionResult, mapping: SpeakerMappingEntry[], metrics: AudioMetrics) {
    if (!scorecard || !qaScorecardSchema.safeParse(scorecard).success) throw new Error("The selected QA scorecard weights must total 100%.");
    const segments = result.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      speaker: segment.role === "unknown" ? segment.speakerId : segment.role === "agent" ? "Agent" : "Customer",
      text: segment.text,
    }));
    await analyzeTranscript(result.text, segments, mapping, metrics);
  }

  const directionSource = state.metadata.selectedDialect === "Auto Detect" ? state.metadata.selectedLanguage : state.metadata.selectedDialect;
  const transcriptDirection = getContentDirection(directionSource, state.transcript);
  return <section className="content narrow"><div className="page-intro"><span className="eyebrow accent">NEW LIVE ANALYSIS</span><h1>Turn a conversation into clear coaching.</h1><p>Paste a transcript or securely upload a recording. No AI call is attempted until a server-side key is configured.</p></div>
    {inputMode === "audio" && <div className="audio-workspace-standalone"><AudioWorkspace onContinue={continueAudioAnalysis} /></div>}
    <div className={`analyze-grid ${inputMode === "audio" ? "audio-mode" : ""}`}><div className="panel form-card"><div className="step-title"><span>1</span><div><h2>Add your call</h2><p>Choose one input method</p></div></div>
      <div className="tabs"><button className={inputMode === "transcript" ? "selected" : ""} onClick={()=>setInputMode("transcript")}>▤ Paste transcript</button><button className={inputMode === "audio" ? "selected" : ""} onClick={()=>setInputMode("audio")}>◉ Upload audio</button></div>
      {inputMode === "transcript" ? <><div className="sample-row"><label>CALL TRANSCRIPT</label><span>Try a sample: <button onClick={()=>loadSample("English")}>English</button><button onClick={()=>loadSample("Arabic")}>العربية</button></span></div><textarea value={state.transcript} onChange={(event)=>updateState({transcript:event.target.value})} placeholder="Agent: Thank you for calling…\nCustomer: Hi, I need help with…" dir={transcriptDirection}/><small className="counter">{state.transcript.length.toLocaleString()} characters</small></> : null}
    </div>
    <div className="panel setup-card"><div className="step-title"><span>2</span><div><h2>Analysis setup</h2><p>Help CallLens interpret the conversation</p></div></div><label>AGENT NAME</label><input className="full-input" value={state.metadata.agentName} onChange={(event)=>updateMetadata({agentName:event.target.value})}/><label>LANGUAGE</label><div className="segmented">{(["Auto Detect","English","Arabic"] as const).map((value)=><button key={value} onClick={()=>updateMetadata({selectedLanguage:value})} className={state.metadata.selectedLanguage===value?"selected":""}>{value === "Arabic" ? "العربية" : value}</button>)}</div><label>ARABIC DIALECT</label><p className="field-helper">Choose a dialect when known. Auto Detect is safest for uncertain calls; mixed Arabic and English keeps automatic text direction.</p><select value={state.metadata.selectedDialect} onChange={(event)=>updateMetadata({selectedDialect:event.target.value as CallMetadata["selectedDialect"]})}>{DIALECTS.map((value)=><option key={value}>{value}</option>)}</select><label>CALL TYPE</label><select value={state.metadata.callType} onChange={(event)=>updateMetadata({callType:event.target.value})}>{CALL_TYPES.map((value)=><option key={value}>{value}</option>)}</select><div className="scorecard-chip"><small>ACTIVE QA SCORECARD</small><b>{scorecard?.name}</b><Link href="/settings">Edit weights</Link></div><div className="privacy"><span>◈</span><p><b>{settings.maskSensitiveInformation ? "Privacy masking is on" : "Privacy masking is off"}</b><br/>{settings.maskSensitiveInformation ? "Sensitive patterns are masked on the server before live analysis." : "The transcript will be sent without masking."}</p></div></div></div>
    <div className="analysis-deliverables panel"><div><span className="eyebrow accent">WHAT YOU’LL RECEIVE</span><h2>One grounded review, six practical outputs</h2></div><div>{[["Timestamped transcript","Speaker-separated evidence when audio provides timestamps."],["QA scorecard","Weighted quality and compliance categories."],["Evidence replay","Findings connected to validated transcript segments."],["Audio insights","Deterministic talk, silence, overlap, and filler metrics."],["Focused coaching","Better phrases and a seven-day improvement plan."],["Manager report","A printable summary for review and follow-up."]].map(([title,copy])=><article key={title}><span aria-hidden="true">✓</span><div><b>{title}</b><p>{copy}</p></div></article>)}</div></div>
    {inputMode === "transcript" && <><p className="privacy-notice">Privacy detection is not perfect. Avoid uploading confidential production data during the hackathon demo.</p>
    {busy && <ProgressStages current={stage} audio={false}/>} {error && <div className="error" role="alert">⚠ <span><b>We couldn’t complete the request</b><br/>{error}</span></div>}
    <button className="analyze-button" onClick={runAnalysis} disabled={busy}>{busy ? <><i/>Working securely…</> : <>✦ Analyze call <span>Live AI required</span></>}</button></>}
  </section>;
}

function ProgressStages({current,audio}:{current:number;audio:boolean}) {
  return <div className="progress-stages" aria-live="polite">{ANALYSIS_STAGES.map((label,index)=>{
    const skipped = !audio && index < 3;
    return <div key={label} className={skipped ? "skipped" : index < current ? "complete" : index === current ? "current" : ""}><i>{skipped || index < current ? "✓" : index+1}</i><span>{label}</span></div>;
  })}</div>;
}

const scoreMetrics: Array<[string, keyof AnalysisResponse]> = [["Greeting","greetingScore"],["Needs discovery","needsDiscoveryScore"],["Empathy","empathyScore"],["Accuracy","accuracyScore"],["Objection handling","objectionHandlingScore"],["Call control","callControlScore"],["Closing","closingScore"],["Compliance","complianceScore"]];

function Results({ example }: { example: boolean }) {
  const { state } = useCallLensState();
  const analysis = example ? SAMPLE_ANALYSIS : state.analysis;
  const privacy = example ? SAMPLE_PRIVACY : state.privacy;
  const [showReconstruction, setShowReconstruction] = useState(false);
  if (!analysis) return <ResultsEmptyState />;
  const reportHref = example ? "/report?example=1" : "/report";
  return <section className="content results-page">
    {example && <div className="example-banner"><b>Example output for interface exploration — not generated from this session.</b><span>Use it to explore evidence, dialect insight, coaching, and reporting without a live API call.</span></div>}
    <ResultSectionNav />
    <div className="results-head" id="overview"><div><span className="eyebrow accent">{example ? "SAMPLE ANALYSIS" : "VALIDATED LIVE ANALYSIS"}</span><h1>{analysis.executiveSummary.split(".")[0]}.</h1><p>{state.metadata.agentName} · {state.metadata.callType} · {analysis.detectedLanguage} · Confidence {analysis.confidenceScore}%</p></div><div className="result-actions"><Link href={reportHref} className="secondary">↓ Download Summary</Link><div className="score-ring" style={{"--score":`${analysis.overallScore*3.6}deg`} as React.CSSProperties}><div><b>{analysis.overallScore}</b><small>OVERALL</small></div></div></div></div>
    {privacy && <div className="privacy-summary"><span>◈</span><div><b>{privacy.detectedCount} sensitive value{privacy.detectedCount === 1 ? "" : "s"} detected · {privacy.maskedCount} masked before analysis</b><small>{privacy.types.length ? `Types: ${privacy.types.join(", ")}. ` : ""}Automated detection may miss sensitive data.</small></div></div>}
    <div className="metric-grid" id="audio-insights">{scoreMetrics.map(([name,key])=>{const score=analysis[key] as number;return <div className="metric" key={name}><div><span>{name}</span><b>{score}</b></div><div><i className={score<80?"warn":""} style={{width:`${score}%`}}/></div></div>;})}</div>
    <div className="insight-grid" id="evidence"><div className="panel summary-card"><span className="eyebrow">EXECUTIVE SUMMARY</span><p>{analysis.executiveSummary}</p><div className="signal"><span className="signal-icon positive">☺</span><div><small>CUSTOMER SENTIMENT</small><b>{analysis.customerSentiment}</b></div></div><div className="signal"><span className="signal-icon intent">⌁</span><div><small>PRIMARY INTENT</small><b>{analysis.customerIntent}</b></div></div></div><div className="panel"><span className="eyebrow">EVIDENCE-BASED FINDINGS</span><FindingPreview tone="good" label="Strengths" findings={analysis.strengths}/><FindingPreview tone="bad" label="Mistakes" findings={analysis.mistakes}/><FindingPreview tone="warn" label="Compliance warnings" findings={analysis.complianceWarnings}/><FindingPreview tone="blue" label="Missed opportunities" findings={analysis.missedOpportunities}/></div></div>
    <DialectInsight analysis={analysis}/>
    <CriticalTimeline moments={analysis.criticalMoments}/>
    <span id="transcript" className="section-anchor"/>
    {example ? <SampleEvidenceReplay/> : <div className="panel live-replay-ready" id="replay"><span className="eyebrow">EVIDENCE REPLAY</span><h2>Ready for segment-grounded findings</h2><p>The reusable replay accepts normalized timestamped transcript segments and validated evidence references. This live result does not include compatible segment IDs, so no replay events or timestamps are invented.</p></div>}
    <div className="panel quote-card" id="coaching"><div className="panel-head"><div><span className="eyebrow">BETTER PHRASES</span><h2>Small wording changes, stronger outcomes</h2></div><Link href="/coaching">Open coaching plan →</Link></div>{analysis.improvedPhrases.length ? analysis.improvedPhrases.map((phrase,index)=><div className="phrase-grid" key={`${phrase.original}-${index}`}><div><small>AGENT SAID</small><p dir={isRtlContent(analysis.detectedLanguage, phrase.original)?"rtl":"auto"}>“{phrase.original}”</p></div><span>→</span><div className="better"><small>TRY THIS INSTEAD · {phrase.category}</small><p dir={isRtlContent(analysis.detectedLanguage, phrase.improved)?"rtl":"auto"}>“{phrase.improved}”</p><em>{phrase.explanation}</em></div></div>) : <p className="empty-copy">No weak phrases were identified in this analysis.</p>}</div>
    <div className="panel reconstruction" id="report"><div className="panel-head"><div><span className="eyebrow">BEFORE AND AFTER</span><h2>Call reconstruction</h2><p>Only weak agent responses are rewritten; customer meaning is preserved.</p></div><button className="secondary" onClick={()=>setShowReconstruction(!showReconstruction)}>{showReconstruction ? "Hide improved conversation" : "Show improved conversation"}</button></div>{showReconstruction && <><div className="reconstruction-list">{analysis.improvedConversation.map((turn,index)=><div className="reconstruction-row" key={`${turn.position}-${index}`}><span>{turn.position}</span><div><small>ORIGINAL AGENT RESPONSE</small><p dir="auto">{turn.originalAgentResponse}</p></div><div className="improved"><small>IMPROVED · {turn.category}</small><p dir="auto">{turn.improvedAgentResponse}</p><em>{turn.explanation}</em></div></div>)}</div><div className="estimated-score"><b>{analysis.estimatedRevisedScore}/100</b><span>AI-estimated score after applying the recommended responses.</span></div></>}</div>
  </section>;
}

function ResultSectionNav() { return <nav className="result-section-nav" aria-label="Analysis sections">{[["Overview","overview"],["Transcript","transcript"],["Replay","replay"],["Audio Insights","audio-insights"],["Evidence","evidence"],["Coaching","coaching"],["Report","report"]].map(([label,id])=><a key={id} href={`#${id}`}>{label}</a>)}</nav>; }

const analysisEmptyCards = ["Timestamped transcript","Speaker separation","QA scoring","Audio insights","Evidence replay","Dialect insight","Compliance findings","Focused coaching","Manager report"];
const coachingEmptyCards = ["Priority skills","Evidence moments","Better phrases","Daily practice","Role-play scenarios","Success measures","Manager check-in","Customer follow-up"];

function ResultsEmptyState() { return <section className="content narrow"><div className="panel empty-state"><span>◎</span><h1>No live analysis yet</h1><p>Run a transcript or audio analysis after configuring live AI, or explore the clearly labeled sample output.</p><div className="button-row"><Link className="primary" href="/analyze">Analyze a call</Link><Link className="secondary" href="/sample-analysis">View sample analysis</Link></div></div><div className="empty-preview"><div className="empty-preview-head"><div><span className="eyebrow accent">WHAT YOUR ANALYSIS WILL INCLUDE</span><h2>A structured, evidence-first review</h2></div><Link href="/sample-analysis">Explore the complete sample →</Link></div><div className="empty-card-grid">{analysisEmptyCards.map((label)=><article key={label}><span className="placeholder-line"/><i className="placeholder-box"/><b>{label}</b><small>Available after a validated analysis</small></article>)}</div></div></section>; }

function CoachingEmptyState() { return <section className="content narrow coaching-empty"><div className="coaching-empty-intro"><span className="eyebrow accent">COACHING WORKSPACE</span><h1>Your coaching plan will include</h1><p>Coaching stays empty until a validated analysis identifies grounded opportunities. The cards below are structure placeholders, not generated recommendations.</p><div className="button-row"><Link className="primary" href="/analyze">Analyze a call</Link><Link className="secondary" href="/sample-analysis#coaching">View sample coaching</Link></div></div><div className="coaching-empty-roadmap">{coachingEmptyCards.map((label,index)=><article className="panel" key={label}><span>{String(index+1).padStart(2,"0")}</span><div><b>{label}</b><p>Placeholder only · populated from validated evidence</p></div></article>)}</div><div className="empty-sample-banner"><b>Want to see the full workflow?</b><span>The labeled sample connects findings, improved responses, and coaching without changing your current call.</span><Link href="/sample-analysis">Open sample analysis →</Link></div></section>; }
function FindingPreview({tone,label,findings}:{tone:string;label:string;findings:AnalysisResponse["strengths"]}) { const first=findings[0]; return <div className={`insight ${tone}`}><i>{tone==="good"?"✓":tone==="bad"?"×":tone==="warn"?"!":"↗"}</i><div><b>{label}</b>{first ? <><p>{first.title}: {first.detail}</p><small className="evidence-line">“{first.evidence[0].quote}” — {first.evidence[0].speaker}, {first.evidence[0].timestamp || "position not available"}</small></> : <p>None identified.</p>}</div></div>; }

function DialectInsight({analysis}:{analysis:AnalysisResponse}) { const insight=analysis.dialectInsight; return <div className="panel dialect-panel"><div><span className="eyebrow">DIALECT AND COMMUNICATION INSIGHT</span><h2>{insight.detectedDialect}</h2><span className={`code-switch ${insight.detectedCodeSwitching?"yes":""}`}>{insight.detectedCodeSwitching?"Code-switching detected":"No code-switching detected"}</span></div><div className="dialect-grid"><div className="expression" dir={isRtlContent(insight.detectedDialect,insight.importantExpression)?"rtl":"auto"}><small>IMPORTANT EXPRESSION</small><b>{insight.importantExpression}</b></div><div><small>LITERAL INTERPRETATION</small><p>{insight.literalInterpretation}</p></div><div><small>CONTEXTUAL INTERPRETATION</small><p>{insight.contextualInterpretation}</p></div><div><small>WHY IT MATTERS FOR QA</small><p>{insight.qaImportance}</p></div></div></div>; }

function CriticalTimeline({moments}:{moments:AnalysisResponse["criticalMoments"]}) { return <div className="panel timeline-panel"><div className="panel-head"><div><span className="eyebrow">CRITICAL MOMENTS</span><h2>Evidence-based call timeline</h2></div><small>Open an event to inspect its quote and recommendation</small></div><div className="timeline">{moments.map((moment,index)=><details key={`${moment.position}-${moment.title}-${index}`}><summary><i className={`event-dot event-${moment.eventType.replaceAll(" ","-")}`}/><span className="timeline-position">{moment.position}</span><div><b>{moment.title}</b><small>{moment.speaker} · {moment.eventType}</small></div><span className="chevron">＋</span></summary><div className="timeline-detail"><blockquote dir="auto">“{moment.evidenceQuote}”</blockquote><p>{moment.explanation}</p>{moment.suggestedResponse && <div><small>SUGGESTED RESPONSE</small><p dir="auto">{moment.suggestedResponse}</p></div>}</div></details>)}</div></div>; }

function Coaching() {
  const { state } = useCallLensState(); const analysis=state.analysis;
  const [copied,setCopied]=useState(false);
  if(!analysis) return <CoachingEmptyState/>;
  return <section className="content"><div className="welcome"><div><span className="eyebrow accent">PERSONALIZED FOR {state.metadata.agentName.toUpperCase()}</span><h1>Your seven-day coaching plan</h1><p>Focused actions grounded in the latest validated analysis.</p></div><div className="button-row"><Link className="secondary" href="/report">↓ Download Summary</Link><Link className="primary" href="/practice">Start role-play</Link></div></div><div className="coach-layout"><div>{analysis.sevenDayCoachingPlan.map((item)=><div className="panel plan-card" key={item.day}><span className="plan-no">{String(item.day).padStart(2,"0")}</span><div><span className="tag teal">DAY {item.day}</span><h2>{item.focus}</h2><p>{item.action}</p><div className="practice"><b>Success measure</b><p>{item.successMeasure}</p></div></div></div>)}</div><aside><div className="panel progress-card"><span className="eyebrow">PRIORITY CATEGORIES</span>{analysis.coachingRecommendations.map((item)=><div className="coach-priority" key={item.title}><b>{item.title}</b><p>{item.detail}</p></div>)}</div><div className="panel followup"><span className="eyebrow">CUSTOMER FOLLOW-UP</span><h3>Ready-to-send message</h3><p dir="auto">{analysis.customerFollowUpMessage}</p><button onClick={()=>{navigator.clipboard?.writeText(analysis.customerFollowUpMessage);setCopied(true);}}>{copied?"✓ Copied":"▣ Copy message"}</button></div></aside></div></section>;
}

const defaultRolePlay: RolePlaySetup = { scenarioType:"Angry billing customer", customerMood:"Frustrated", difficulty:"Intermediate", language:"English", dialect:"English", coachingGoal:"De-escalate the customer while verifying the account and setting a clear next step." };

function Practice() {
  const { state, updateState }=useCallLensState();
  const [setup,setSetup]=useState<RolePlaySetup>(defaultRolePlay);
  const [turns,setTurns]=useState<Array<{role:"customer"|"agent";content:string}>>([]);
  const [draft,setDraft]=useState(""); const [active,setActive]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [feedback,setFeedback]=useState<RolePlayResponse|null>(null);
  async function callRolePlay(action:"start"|"respond"|"feedback"|"end",nextTurns=turns){
    if(busy)return; setBusy(true);setError("");
    try{const response=await fetch("/api/role-play",{method:"POST",headers:{"content-type":"application/json","x-calllens-request-id":requestId()},body:JSON.stringify({action,setup,turns:nextTurns,analyzedCallScore:state.analysis?.overallScore??null})});if(!response.ok)throw new Error(await responseError(response));const payload=await response.json() as {rolePlay?:unknown};const parsed=rolePlayResponseSchema.safeParse(payload.rolePlay);if(!parsed.success)throw new Error("Live role-play returned an invalid response. Nothing was displayed.");const result=parsed.data;if(result.customerReply)setTurns([...nextTurns,{role:"customer",content:result.customerReply}]);if(action==="feedback")setFeedback(result);if(action==="end"){setFeedback(result);updateState({rolePlayResult:result});setActive(false);}return result;}catch(caught){setError(caught instanceof Error?caught.message:LIVE_AI_MISSING_MESSAGE);}finally{setBusy(false);}}
  async function start(){const result=await callRolePlay("start",[]);if(result?.customerReply)setActive(true);}
  async function send(){if(!draft.trim())return;const next=[...turns,{role:"agent" as const,content:draft.trim()}];setTurns(next);setDraft("");await callRolePlay("respond",next);}
  return <section className="content narrow"><div className="page-intro"><span className="eyebrow accent">INTERACTIVE COACHING</span><h1>Practice Role-play</h1><p>Rehearse difficult conversations with a dialect-aware AI customer, then request evidence-based feedback.</p></div>
    {!active && !turns.length ? <div className="roleplay-grid">
      <div className="panel settings-card"><h2>Scenario setup</h2><FieldSelect label="Scenario type" value={setup.scenarioType} values={["Angry billing customer","Hesitant medical patient","Price-sensitive sales prospect","Customer requesting escalation","Collections payment objection"]} onChange={(value)=>setSetup({...setup,scenarioType:value as RolePlaySetup["scenarioType"]})}/><FieldSelect label="Customer mood" value={setup.customerMood} values={["Concerned","Frustrated","Angry","Hesitant","Skeptical"]} onChange={(value)=>setSetup({...setup,customerMood:value as RolePlaySetup["customerMood"]})}/><FieldSelect label="Difficulty" value={setup.difficulty} values={["Beginner","Intermediate","Advanced"]} onChange={(value)=>setSetup({...setup,difficulty:value as RolePlaySetup["difficulty"]})}/><div className="difficulty-key" aria-label="Difficulty levels"><span className={setup.difficulty==="Beginner"?"active":""}>Easy<small>Beginner</small></span><span className={setup.difficulty==="Intermediate"?"active":""}>Intermediate<small>Intermediate</small></span><span className={setup.difficulty==="Advanced"?"active":""}>Advanced<small>Advanced</small></span></div><FieldSelect label="Language" value={setup.language} values={["English","Arabic"]} onChange={(value)=>setSetup({...setup,language:value as RolePlaySetup["language"]})}/><FieldSelect label="Arabic dialect" value={setup.dialect} values={DIALECTS} onChange={(value)=>setSetup({...setup,dialect:value as RolePlaySetup["dialect"]})}/><label className="field-label">COACHING GOAL</label><textarea className="goal-input" value={setup.coachingGoal} onChange={(event)=>setSetup({...setup,coachingGoal:event.target.value})}/></div>
      <div className="panel roleplay-ready"><span className="eyebrow accent">WORKFLOW PREVIEW · STATIC EXAMPLE</span><h2>See the coaching loop before you connect live AI</h2><p>This preview explains the interaction only. It is not a running simulation and does not produce a result.</p><div className="roleplay-preview"><article className="customer"><small>AI CUSTOMER · PREVIEW</small><p>“I’ve already called twice. Why should I trust this will be fixed?”</p></article><article className="agent"><small>AGENT RESPONSE · PREVIEW</small><p>“I understand. I’ll check it now.”</p></article><article className="coach"><small>AI COACH FEEDBACK · PREVIEW</small><p>Acknowledge the repeat effort, then give a specific owner and timeframe.</p></article></div><button className="primary" onClick={start} disabled={busy}>{busy?"Connecting…":"Start Practice"}</button><small className="roleplay-key-note">Live AI required · no reply is simulated without a configured server key.</small></div>
    </div> : <div className="practice-session"><div className="panel chat-panel"><div className="panel-head"><div><span className="eyebrow">{setup.scenarioType.toUpperCase()}</span><h2>{setup.customerMood} customer · {setup.difficulty}</h2></div><span className="live-pill"><i/> Live role-play</span></div><div className="chat-messages" dir={setup.language==="Arabic"?"rtl":"ltr"}>{turns.map((turn,index)=><div className={`chat-message ${turn.role}`} key={`${turn.role}-${index}`}><small>{turn.role==="customer"?"AI CUSTOMER":"YOU · AGENT"}</small><p>{turn.content}</p></div>)}</div>{active&&<div className="chat-composer"><textarea value={draft} onChange={(event)=>setDraft(event.target.value)} placeholder="Type the agent response…" dir={setup.language==="Arabic"?"rtl":"ltr"}/><button className="primary" onClick={send} disabled={busy||!draft.trim()}>{busy?"Waiting…":"Send response"}</button></div>}<div className="session-actions"><button className="secondary" onClick={()=>callRolePlay("feedback")} disabled={busy||!turns.length}>Request feedback</button><button className="danger-button" onClick={()=>callRolePlay("end")} disabled={busy||!turns.length}>End practice</button></div></div>{feedback&&<RolePlayFeedback feedback={feedback}/>}</div>}
    {error&&<div className="error" role="alert">⚠ <span><b>Practice could not start</b><br/>{error}</span></div>}
  </section>;
}

function FieldSelect({label,value,values,onChange}:{label:string;value:string;values:readonly string[];onChange:(value:string)=>void}) { return <div className="setting-row"><div><b>{label}</b></div><select value={value} onChange={(event)=>onChange(event.target.value)}>{values.map((item)=><option key={item}>{item}</option>)}</select></div>; }
function RolePlayFeedback({feedback}:{feedback:RolePlayResponse}) { return <div className="panel feedback-panel"><span className="eyebrow">COACH FEEDBACK</span>{feedback.rolePlayScore!==null&&<div className="feedback-score"><b>{feedback.rolePlayScore}</b><span>/100</span></div>}<p>{feedback.feedbackSummary}</p><h3>Strengths</h3><ul>{feedback.strengths.map((item)=><li key={item}>{item}</li>)}</ul><h3>Mistakes</h3><ul>{feedback.mistakes.map((item)=><li key={item}>{item}</li>)}</ul>{feedback.betterReply&&<div className="practice"><b>Better reply</b><p dir="auto">{feedback.betterReply}</p></div>}{feedback.categoryFeedback.map((item)=><div className="category-feedback" key={item.category}><b>{item.category}</b><p>{item.feedback}</p></div>)}{feedback.recommendedNextPractice&&<p><b>Next practice:</b> {feedback.recommendedNextPractice}</p>}{feedback.improvementComparedWithAnalyzedCall&&<p><b>Compared with analyzed call:</b> {feedback.improvementComparedWithAnalyzedCall}</p>}</div>; }

function Settings() {
  const {settings,updateSettings}=useCallLensState();
  const [notice,setNotice]=useState(""); const [error,setError]=useState("");
  return <SettingsForm key={JSON.stringify(settings)} settings={settings} updateSettings={updateSettings} notice={notice} error={error} setNotice={setNotice} setError={setError}/>;
}

function SettingsForm({settings,updateSettings,notice,error,setNotice,setError}:{settings:DemoSettings;updateSettings:(settings:DemoSettings)=>void;notice:string;error:string;setNotice:(message:string)=>void;setError:(message:string)=>void}) {
  const [draft,setDraft]=useState<DemoSettings>(()=>structuredClone(settings)); const [confirmRestore,setConfirmRestore]=useState(false);
  const [englishFillers,setEnglishFillers]=useState(()=>settings.audio.englishFillerWords.join("\n")); const [egyptianFillers,setEgyptianFillers]=useState(()=>settings.audio.egyptianFillerWords.join("\n")); const [gulfFillers,setGulfFillers]=useState(()=>settings.audio.gulfFillerWords.join("\n"));
  const selected=draft.scorecards.find((item)=>item.id===draft.selectedScorecardId)??draft.scorecards[0]; const total=selected.categories.reduce((sum,item)=>sum+item.weight,0);
  function changeWeight(id:string,weight:number){setDraft({...draft,scorecards:draft.scorecards.map((card)=>card.id===selected.id?{...card,categories:card.categories.map((category)=>category.id===id?{...category,weight}:category)}:card)});setNotice("");}
  function updateAudio(patch:Partial<DemoSettings["audio"]>){setDraft({...draft,audio:{...draft.audio,...patch}});setNotice("");}
  function parseFillerList(value:string){return value.split(/[\n,]/).map((item)=>item.trim()).filter(Boolean);}
  function save(){const invalid=draft.scorecards.find((card)=>!qaScorecardSchema.safeParse(card).success);if(invalid){setError(`${invalid.name} weights must total 100%.`);return;}const normalized={...draft,audio:{...draft.audio,englishFillerWords:parseFillerList(englishFillers),egyptianFillerWords:parseFillerList(egyptianFillers),gulfFillerWords:parseFillerList(gulfFillers)}};const {playbackSpeed,autoScrollTranscript,...metricSettings}=normalized.audio;const supportedSpeed=[0.75,1,1.25,1.5,2].includes(playbackSpeed);if(!audioMetricSettingsSchema.safeParse(metricSettings).success||!supportedSpeed||typeof autoScrollTranscript!=="boolean"){setError("Check audio thresholds and filler dictionaries. Severe dead air must exceed possible dead air.");return;}setDraft(normalized);updateSettings(normalized);setError("");setNotice("Settings saved locally on this device.");}
  function restoreDefaults(){const defaults=createDefaultDemoSettings();updateSettings(defaults);setError("");setNotice("Local non-sensitive settings restored to defaults.");setConfirmRestore(false);}
  return <section className="content narrow"><div className="page-intro"><span className="eyebrow accent">WORKSPACE PREFERENCES</span><h1>Settings</h1><p>Configure privacy and QA scorecards without storing credentials or call data.</p></div>{notice&&<div className="settings-toast success" role="status" aria-live="polite">✓ {notice}</div>}{error&&<div className="settings-toast error" role="alert" aria-live="assertive">⚠ {error}</div>}<div className="settings-layout"><div className="panel settings-card"><h2>General</h2><div className="setting-row"><div><b>Workspace name</b><small>Shown throughout the quality dashboard</small></div><input value={draft.workspaceName} onChange={(event)=>setDraft({...draft,workspaceName:event.target.value})}/></div><div className="setting-row"><div><b>Default language</b><small>Used when starting a new analysis</small></div><select value={draft.defaultLanguage} onChange={(event)=>setDraft({...draft,defaultLanguage:event.target.value as DemoSettings["defaultLanguage"]})}><option>Auto Detect</option><option>English</option><option>Arabic</option></select></div><div className="setting-row"><div><b>Mask sensitive information before AI analysis</b><small>Enabled by default; applies server-side before the transcript reaches OpenAI</small></div><Toggle on={draft.maskSensitiveInformation} onChange={(value)=>setDraft({...draft,maskSensitiveInformation:value})} label="Mask sensitive information"/></div><p className="privacy-notice in-card">Automated masking is not perfect. Avoid confidential production data during the hackathon demo.</p></div>
      <div className="panel audio-settings"><div className="panel-head"><div><span className="eyebrow">AUDIO ANALYSIS</span><h2>Deterministic metrics and playback</h2></div><small>Stored locally; no call content or credentials</small></div><div className="audio-setting-grid"><label><span>Possible dead-air threshold</span><input type="number" min="0.5" step="0.1" value={draft.audio.deadAirSeconds} onChange={(event)=>updateAudio({deadAirSeconds:Number(event.target.value)})}/><em>seconds</em></label><label><span>Severe dead-air threshold</span><input type="number" min="1" step="0.1" value={draft.audio.severeDeadAirSeconds} onChange={(event)=>updateAudio({severeDeadAirSeconds:Number(event.target.value)})}/><em>seconds</em></label><label><span>Minimum interruption overlap</span><input type="number" min="0.05" step="0.05" value={draft.audio.minimumInterruptionOverlapSeconds} onChange={(event)=>updateAudio({minimumInterruptionOverlapSeconds:Number(event.target.value)})}/><em>seconds</em></label><label><span>Default playback speed</span><select value={draft.audio.playbackSpeed} onChange={(event)=>updateAudio({playbackSpeed:Number(event.target.value) as DemoSettings["audio"]["playbackSpeed"]})}>{[0.75,1,1.25,1.5,2].map((speed)=><option key={speed} value={speed}>{speed}x</option>)}</select></label></div><div className="filler-settings"><label>English filler words<textarea value={englishFillers} onChange={(event)=>setEnglishFillers(event.target.value)}/></label><label>Egyptian Arabic filler words<textarea dir="rtl" value={egyptianFillers} onChange={(event)=>setEgyptianFillers(event.target.value)}/></label><label>Gulf Arabic filler words<textarea dir="rtl" value={gulfFillers} onChange={(event)=>setGulfFillers(event.target.value)}/></label></div><div className="setting-row"><div><b>Auto-scroll timestamped transcript</b><small>Default behavior while audio is playing</small></div><Toggle on={draft.audio.autoScrollTranscript} onChange={(value)=>updateAudio({autoScrollTranscript:value})} label="Auto-scroll timestamped transcript"/></div></div>
      <div className="panel scorecard-settings"><div className="panel-head"><div><span className="eyebrow">QA SCORECARDS</span><h2>Configurable category weights</h2></div><select value={selected.id} onChange={(event)=>setDraft({...draft,selectedScorecardId:event.target.value})}>{draft.scorecards.map((card)=><option value={card.id} key={card.id}>{card.name}</option>)}</select></div><div className="weight-total"><span>Total weight</span><b className={Math.abs(total-100)<.001?"valid":"invalid"}>{total}%</b></div><div className="weight-list">{selected.categories.map((category)=><label key={category.id}><span>{category.label}</span><div><input type="number" min="0" max="100" step="1" value={category.weight} onChange={(event)=>changeWeight(category.id,Number(event.target.value))}/><em>%</em></div></label>)}</div>{Math.abs(total-100)>.001&&<p className="inline-error">Adjust this scorecard to exactly 100% before saving.</p>}</div></div><div className="settings-actions"><button className="secondary" type="button" onClick={()=>setConfirmRestore(true)}>Restore defaults</button><button className="primary" type="button" onClick={save}>Save changes</button></div>{confirmRestore&&<div className="restore-confirm" role="alertdialog" aria-labelledby="restore-title" aria-describedby="restore-copy"><div><b id="restore-title">Restore local defaults?</b><p id="restore-copy">This resets workspace preferences, QA weights, audio thresholds, and filler dictionaries. It does not change call data, credentials, or live results.</p></div><div><button className="secondary" type="button" onClick={()=>setConfirmRestore(false)}>Cancel</button><button className="danger-button" type="button" onClick={restoreDefaults}>Restore local defaults</button></div></div>}</section>;
}

function Toggle({on,onChange,label}:{on:boolean;onChange:(value:boolean)=>void;label:string}) { return <button className={`toggle ${on?"on":""}`} onClick={()=>onChange(!on)} aria-label={label} aria-pressed={on}><i/></button>; }
