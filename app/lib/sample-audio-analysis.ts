import {
  applySpeakerMapping,
  calculateAudioMetrics,
  diarizedTranscriptionResultSchema,
  type SpeakerMappingEntry,
} from "./audio-domain";

const segments = [
  { id: "seg_001", speakerId: "A", role: "unknown" as const, start: 0, end: 4.2, text: "Thank you for calling Northstar Mobile. How can I help today?", originalText: "Thank you for calling Northstar Mobile. How can I help today?", editedText: null, isEdited: false },
  { id: "seg_002", speakerId: "B", role: "unknown" as const, start: 4.5, end: 10.4, text: "Hi, I was actually charged twice and I need the second charge removed.", originalText: "Hi, I was actually charged twice and I need the second charge removed.", editedText: null, isEdited: false },
  { id: "seg_003", speakerId: "A", role: "unknown" as const, start: 10.1, end: 14.8, text: "I am sorry about that. Let me check both transactions for you.", originalText: "I am sorry about that. Let me check both transactions for you.", editedText: null, isEdited: false },
  { id: "seg_004", speakerId: "B", role: "unknown" as const, start: 18.6, end: 22.7, text: "Okay, but I need to know when the money will return.", originalText: "Okay, but I need to know when the money will return.", editedText: null, isEdited: false },
  { id: "seg_005", speakerId: "A", role: "unknown" as const, start: 23, end: 31.8, text: "The second item is a pending authorization. It should disappear within three business days.", originalText: "The second item is a pending authorization. It should disappear within three business days.", editedText: null, isEdited: false },
  { id: "seg_006", speakerId: "B", role: "unknown" as const, start: 32, end: 35.2, text: "Um, all right. Please send me confirmation.", originalText: "Um, all right. Please send me confirmation.", editedText: null, isEdited: false },
  { id: "seg_007", speakerId: "A", role: "unknown" as const, start: 35, end: 39.1, text: "Absolutely. I will send it now and include the next steps.", originalText: "Absolutely. I will send it now and include the next steps.", editedText: null, isEdited: false },
];

export const SAMPLE_AUDIO_MAPPING: SpeakerMappingEntry[] = [
  { speakerId: "A", role: "agent" },
  { speakerId: "B", role: "customer" },
];

export const SAMPLE_AUDIO_TRANSCRIPTION = applySpeakerMapping(
  diarizedTranscriptionResultSchema.parse({
    text: segments.map((segment) => segment.text).join(" "),
    duration: 42.7,
    segments,
    detectedLanguage: "English",
    model: "sample-interface-fixture",
    createdAt: "2026-07-19T00:00:00.000Z",
  }),
  SAMPLE_AUDIO_MAPPING,
);

export const SAMPLE_AUDIO_METRICS = calculateAudioMetrics(SAMPLE_AUDIO_TRANSCRIPTION);
