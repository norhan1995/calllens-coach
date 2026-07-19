# CallLens Coach — Manual QA Checklist

## Automated gate

- [ ] `pnpm lint` exits successfully.
- [ ] `pnpm type-check` exits successfully.
- [ ] `pnpm test:unit` passes all analysis and audio-domain tests.
- [ ] `pnpm test` passes unit, build, worker-render, and missing-key route tests.
- [ ] `pnpm build` produces the Cloudflare-compatible worker output.

## Navigation and responsive shell

- [ ] Dashboard, Analyze, Results, Coaching, Practice Role-play, and Settings appear in the sidebar.
- [ ] Practice Role-play is directly below Coaching Plan.
- [ ] `/welcome` has no app sidebar and both CTA buttons work.
- [ ] Mobile bottom navigation remains usable with all pages accessible.
- [ ] No horizontal overflow appears at 390 px, 768 px, or desktop widths.

## Demo and empty states

- [ ] Dashboard **View sample analysis** opens `/sample-analysis`.
- [ ] Sample output banner says it was not generated from this session.
- [ ] `/results` with no in-memory analysis shows a helpful empty state.
- [ ] Sample transcripts populate inputs only and do not create results.

## Transcript analysis

- [ ] Empty or short transcripts are rejected in the browser.
- [ ] English sample is left-to-right.
- [ ] Arabic sample is right-to-left and its quotes remain Arabic.
- [ ] All dialect options and call types are selectable.
- [ ] Active QA scorecard name is visible and links to Settings.
- [ ] With no key, Analyze displays the exact missing-live-AI message.
- [ ] Rapid double activation does not create duplicate submissions.

## Audio upload and local playback

- [ ] Drag/drop and file picker accept MP3, WAV, M4A, MP4, MPEG, MPGA, OGG, WebM, and FLAC.
- [ ] Empty files, unsupported extensions, files above `MAX_AUDIO_FILE_MB`, and browser-detectable unreadable audio show clear errors.
- [ ] Selected audio shows filename, MIME type, size, duration, validation status, Replace, and Remove.
- [ ] Play/pause, seek, ±5 seconds, volume, and 0.75x/1x/1.25x/1.5x/2x controls work by pointer and keyboard.
- [ ] Replacing/removing/unmounting revokes temporary object URLs.
- [ ] Raw audio is absent from localStorage and sessionStorage.
- [ ] Progress UI contains the six requested stages.
- [ ] With no key, only local preparation can complete; the exact live-transcription message appears and `/api/transcribe` is not requested.
- [ ] Cancel and retry controls leave the selected local audio intact.

## Diarized transcript workspace

- [ ] Live responses enter state only after strict schema validation.
- [ ] Speaker A/B defaults are labeled suggestions and can be remapped without changing provider speaker IDs.
- [ ] Mapping changes update every related row and recalculate metrics.
- [ ] Timestamp buttons seek audio and the active row follows playback.
- [ ] Search, role filters, auto-scroll, quote/full copy, TXT export, and JSON export work.
- [ ] Editing preserves original text, shows Edited, keeps timestamps, recalculates text metrics, and supports Undo.
- [ ] Arabic rows render right-to-left without translating the provider text.
- [ ] Continue to QA analysis remains disabled until a validated live transcript exists.

## Deterministic audio insights

- [ ] Talk duration/percentage, role ratio, words, and approximate WPM match the segment fixture.
- [ ] Silence totals, longest/average gap, and possible/severe dead-air thresholds are correct.
- [ ] Cross-speaker overlaps show pairs and durations; potential interruptions use only the configured minimum overlap.
- [ ] UI wording does not claim interruption intent or rudeness.
- [ ] English, Egyptian Arabic, and Gulf Arabic filler lists are editable and phrase-aware.
- [ ] Filler evidence links to existing segment IDs and timestamps.
- [ ] Audio Settings reject invalid thresholds and persist only non-sensitive values locally.

## Sample audio analysis

- [ ] `/sample-audio-analysis` prominently says it was not generated from this recording or session.
- [ ] The sample is never attached to a newly selected file and never replaces user content.
- [ ] Sample playback/edit controls do not imply that a recording exists.

## Results

- [ ] Overall and all eight standard category scores are 0–100.
- [ ] Executive summary, sentiment, intent, and confidence are visible.
- [ ] Major findings show a supporting quote, speaker, and position/timestamp.
- [ ] Privacy summary shows detected count, masked count, and matched types.
- [ ] Dialect insight shows dialect, code-switching, expression, literal/contextual meaning, and QA significance.
- [ ] Timeline events expand and collapse with keyboard and pointer input.
- [ ] Text without timestamps uses call positions rather than fabricated timecodes.
- [ ] **Show improved conversation** toggles the reconstruction.
- [ ] Revised score carries the exact AI-estimate disclaimer.

## Coaching and role-play

- [ ] Coaching renders seven ordered days from current analysis state.
- [ ] Follow-up copy button copies the current analysis message.
- [ ] All five role-play templates are available.
- [ ] Mood, difficulty, language, dialect, and coaching goal are configurable.
- [ ] With no key, Start Practice shows the exact configuration message and creates no chat turn.
- [ ] With a configured test key, turn, feedback, and end responses validate before display.

## Settings and privacy

- [ ] Four scorecards are present: General, Medical Booking, Sales, Collections.
- [ ] Each template contains its required categories.
- [ ] A scorecard cannot save unless its total is exactly 100%.
- [ ] Privacy masking is enabled by default.
- [ ] Saved non-sensitive settings survive a refresh.
- [ ] API keys, audio, transcripts, and analysis are absent from browser persistence.
- [ ] Hackathon confidential-data warning is visible.

## Report

- [ ] Report uses current analysis data, not unrelated fixed copy.
- [ ] Branding, metadata, summary, scores, signals, evidence, warnings, timeline, priorities, phrases, follow-up, plan, notes, and sign-off are present.
- [ ] Sample report retains the example-output label.
- [ ] Print preview uses A4-friendly spacing and hides the toolbar.
- [ ] Browser **Save as PDF** produces a readable multi-page report.

## Security review

- [ ] `.env.local` is ignored and `.env.example` is tracked.
- [ ] No `NEXT_PUBLIC_OPENAI_*` variable exists.
- [ ] No error body or log contains a key, transcript, or raw model payload.
- [ ] All AI endpoints return HTTP 503 before request parsing when the key is absent.
- [ ] Server masking runs before the live analysis request.
- [ ] Model responses are Zod-validated before state mapping.
