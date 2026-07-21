"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SCORECARDS, mapAnalysisState, type AnalysisResponse, type PrivacySummary, type QAScorecard, type ReportModel, type RolePlayResponse } from "./lib/domain";
import {
  DEFAULT_AUDIO_METRIC_SETTINGS,
  type AudioAnalysisSettings as PersistedAudioAnalysisSettings,
  type AudioMetrics,
  type DiarizedTranscriptionResult,
  type SpeakerMappingEntry,
} from "./lib/audio-domain";

export type CallMetadata = {
  agentName: string;
  callType: string;
  selectedLanguage: "Auto Detect" | "English" | "Arabic";
  selectedDialect: "Auto Detect" | "Egyptian Arabic" | "Gulf Arabic" | "Modern Standard Arabic" | "Levantine Arabic" | "English" | "Mixed Arabic and English";
};

export type AudioAnalysisSettings = PersistedAudioAnalysisSettings;
export type DemoSettings = { workspaceName: string; defaultLanguage: CallMetadata["selectedLanguage"]; maskSensitiveInformation: boolean; selectedScorecardId: string; scorecards: QAScorecard[]; audio: AudioAnalysisSettings };
export type CallLensState = { transcript: string; metadata: CallMetadata; transcription: DiarizedTranscriptionResult | null; speakerMapping: SpeakerMappingEntry[]; audioMetrics: AudioMetrics | null; analysis: AnalysisResponse | null; privacy: PrivacySummary | null; coachingPlan: AnalysisResponse["sevenDayCoachingPlan"]; rolePlayResult: RolePlayResponse | null; reportData: ReportModel | null; analysisSource: "live" | "example" | null };
type StateContextValue = { state: CallLensState; settings: DemoSettings; updateState: (patch: Partial<CallLensState>) => void; updateMetadata: (patch: Partial<CallMetadata>) => void; updateSettings: (settings: DemoSettings) => void; setAnalysisResult: (analysis: AnalysisResponse, privacy: PrivacySummary) => void };

const initialState: CallLensState = { transcript: "", metadata: { agentName: "Maya Hassan", callType: "Customer Service", selectedLanguage: "Auto Detect", selectedDialect: "Auto Detect" }, transcription: null, speakerMapping: [], audioMetrics: null, analysis: null, privacy: null, coachingPlan: [], rolePlayResult: null, reportData: null, analysisSource: null };
export function createDefaultDemoSettings(): DemoSettings {
  return {
    workspaceName: "Northstar Support",
    defaultLanguage: "Auto Detect",
    maskSensitiveInformation: true,
    selectedScorecardId: "general",
    scorecards: structuredClone(DEFAULT_SCORECARDS),
    audio: { ...structuredClone(DEFAULT_AUDIO_METRIC_SETTINGS), playbackSpeed: 1, autoScrollTranscript: true },
  };
}
const initialSettings = createDefaultDemoSettings();
const StateContext = createContext<StateContextValue | null>(null);

export function CallLensStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);
  const [settings, setSettings] = useState(initialSettings);
  const settingsLoaded = useRef(false);
  useEffect(() => {
    let storedSettings: DemoSettings | null = null;
    try {
      const stored = window.localStorage.getItem("calllens-demo-settings");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DemoSettings>;
        storedSettings = { ...initialSettings, ...parsed, audio: { ...initialSettings.audio, ...(parsed.audio ?? {}) } };
      }
    } catch { /* Browser storage is an optional demo convenience. */ }
    const timer = window.setTimeout(() => {
      if (storedSettings) setSettings(storedSettings);
      settingsLoaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (settingsLoaded.current) window.localStorage.setItem("calllens-demo-settings", JSON.stringify(settings));
  }, [settings]);
  const value = useMemo<StateContextValue>(() => ({
    state,
    settings,
    updateState: (patch) => setState((current) => ({ ...current, ...patch })),
    updateMetadata: (patch) => setState((current) => ({ ...current, metadata: { ...current.metadata, ...patch } })),
    updateSettings: setSettings,
    setAnalysisResult: (analysis, privacy) => setState((current) => ({
      ...current,
      ...mapAnalysisState(analysis, privacy, {
        agentName: current.metadata.agentName,
        callType: current.metadata.callType,
        language: analysis.detectedLanguage,
        dialect: analysis.detectedDialect,
      }),
    })),
  }), [settings, state]);
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

export function useCallLensState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("useCallLensState must be used inside CallLensStateProvider");
  return context;
}
