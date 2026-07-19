"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buildReportModel, type AnalysisResponse } from "../lib/domain";
import { SAMPLE_ANALYSIS } from "../lib/sample-analysis";
import { useCallLensState } from "../state";

const reportScores: Array<[string, keyof AnalysisResponse]> = [["Greeting","greetingScore"],["Needs discovery","needsDiscoveryScore"],["Empathy","empathyScore"],["Accuracy","accuracyScore"],["Objection handling","objectionHandlingScore"],["Call control","callControlScore"],["Closing","closingScore"],["Compliance","complianceScore"]];

export default function ReportPage() {
  const { state } = useCallLensState();
  const search = useSearchParams();
  const example = search.get("example") === "1";
  const analysis = example ? SAMPLE_ANALYSIS : state.analysis;
  if (!analysis) return <main className="report-empty"><h1>No analysis is available for this report.</h1><p>Run a live analysis or open the sample analysis first.</p><div><Link className="primary" href="/analyze">Analyze a call</Link><Link className="secondary" href="/sample-analysis">View sample analysis</Link></div></main>;
  const report = buildReportModel(analysis, { agentName: state.metadata.agentName, callType: state.metadata.callType, language: analysis.detectedLanguage, dialect: analysis.detectedDialect });
  return <main className="report-page"><div className="report-toolbar"><Link href={example?"/sample-analysis":"/results"}>← Back to analysis</Link><button className="primary" onClick={()=>window.print()}>Print / Save as PDF</button></div>
    <article className="print-report"><header className="report-header"><div><span className="report-logo">C</span><div><b>CallLens Coach</b><small>MANAGER QUALITY REPORT</small></div></div><div><small>OVERALL SCORE</small><b>{analysis.overallScore}<em>/100</em></b></div></header>
      {example&&<p className="report-example">Example output for interface exploration — not generated from this session.</p>}
      <section className="report-meta"><div><small>AGENT</small><b>{report.metadata.agentName}</b></div><div><small>CALL TYPE</small><b>{report.metadata.callType}</b></div><div><small>LANGUAGE</small><b>{report.metadata.language}</b></div><div><small>DIALECT</small><b>{report.metadata.dialect}</b></div></section>
      <ReportSection title="Executive summary"><p>{analysis.executiveSummary}</p><div className="report-signals"><div><small>CUSTOMER SENTIMENT</small><b>{analysis.customerSentiment}</b></div><div><small>CUSTOMER INTENT</small><b>{analysis.customerIntent}</b></div><div><small>ANALYSIS CONFIDENCE</small><b>{analysis.confidenceScore}%</b></div></div></ReportSection>
      <ReportSection title="Category scores"><div className="report-scores">{reportScores.map(([label,key])=><div key={label}><span>{label}</span><b>{analysis[key] as number}</b><i><em style={{width:`${analysis[key] as number}%`}}/></i></div>)}</div></ReportSection>
      <div className="report-two-col"><ReportFindings title="Evidence-based strengths" findings={analysis.strengths}/><ReportFindings title="Mistakes" findings={analysis.mistakes}/></div>
      <div className="report-two-col"><ReportFindings title="Compliance warnings" findings={analysis.complianceWarnings}/><ReportFindings title="Coaching priorities" findings={analysis.coachingRecommendations}/></div>
      <ReportSection title="Critical moments timeline"><div className="report-timeline">{analysis.criticalMoments.map((moment,index)=><div key={`${moment.title}-${index}`}><span>{moment.position}</span><div><b>{moment.title} · {moment.eventType}</b><blockquote>“{moment.evidenceQuote}”</blockquote><p>{moment.explanation}</p></div></div>)}</div></ReportSection>
      <ReportSection title="Improved phrases"><div className="report-phrases">{analysis.improvedPhrases.map((phrase,index)=><div key={`${phrase.original}-${index}`}><p><small>ORIGINAL</small>{phrase.original}</p><p><small>RECOMMENDED · {phrase.category}</small>{phrase.improved}</p></div>)}</div></ReportSection>
      <ReportSection title="Customer follow-up message"><blockquote className="report-followup">{analysis.customerFollowUpMessage}</blockquote></ReportSection>
      <ReportSection title="Seven-day coaching plan"><div className="report-plan">{analysis.sevenDayCoachingPlan.map((day)=><div key={day.day}><b>Day {day.day} · {day.focus}</b><p>{day.action}</p><small>SUCCESS: {day.successMeasure}</small></div>)}</div></ReportSection>
      <section className="manager-signoff"><div><h2>Manager notes</h2><span/><span/><span/><span/></div><aside><h2>Sign-off</h2><p>Manager <span/></p><p>Agent <span/></p><p>Date <span/></p></aside></section>
      <footer className="report-footer"><span>CallLens Coach · Dialect-aware, evidence-based QA</span><span>AI output requires human review.</span></footer>
    </article>
  </main>;
}

function ReportSection({title,children}:{title:string;children:React.ReactNode}) { return <section className="report-section"><h2>{title}</h2>{children}</section>; }
function ReportFindings({title,findings}:{title:string;findings:AnalysisResponse["strengths"]}) { return <ReportSection title={title}>{findings.length?findings.map((finding)=><div className="report-finding" key={finding.title}><b>{finding.title}</b><p>{finding.detail}</p><blockquote>“{finding.evidence[0].quote}” — {finding.evidence[0].speaker}, {finding.evidence[0].timestamp||"position unavailable"}</blockquote></div>):<p>None identified.</p>}</ReportSection>; }
