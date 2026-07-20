# CallLens Coach — Three-Minute Demo

## 0:00–0:25 — The problem and promise

Open `/welcome`.

> Contact-center QA is slow, sampled, and often English-first. CallLens Coach is the dialect-aware AI QA manager for modern contact centers: English and Arabic, evidence with every finding, and coaching that changes the next call.

Select **View sample analysis**.

## 0:25–1:20 — Evidence and dialect insight

Point out the banner:

> This is clearly labeled example output for interface exploration. It is not presented as live AI from this session.

Show:

1. overall and category scores;
2. privacy detection/masking counts;
3. the executive summary, sentiment, and intent;
4. evidence quotes under strengths, mistakes, compliance, and missed opportunities;
5. **Dialect and communication insight**, including “أبشر,” its literal meaning, contextual meaning, and why it matters for QA.

Open two critical timeline moments—one empathy moment and the verification risk.

> Pasted text gets honest call-position labels. CallLens never creates fake timestamps.

## 1:20–2:00 — From QA to better performance

Select **Show improved conversation**.

> CallLens preserves the customer's meaning and rewrites only weak agent responses. The revised score is explicitly labeled as an AI estimate, not a guaranteed result.

Open **Coaching Plan** and scan the seven-day actions and customer follow-up message. Then open **Practice Role-play** and show scenario, mood, difficulty, language, dialect, and coaching goal controls.

> With a live key, the AI acts as the customer turn by turn and provides category-level feedback. Without a key, it never invents a reply.

## 2:00–2:35 — Manager-ready output

Return to the sample result and select **Download Summary**.

Show the branded report: metadata, scorecard, evidence, timeline, improved phrases, follow-up message, seven-day plan, manager notes, and sign-off.

Select **Print / Save as PDF** if the demo environment allows the browser print dialog.

## 2:35–3:00 — Honest live architecture

Open **Analyze Call**. Load the Arabic sample, show automatic RTL, dialect selection, active scorecard, and privacy masking. Switch to Upload Audio and show drag/drop, the local player, supported formats, six honest progress stages, and the **View sample audio analysis** link.

Open the sample audio analysis and point out the prominent example-only banner, speaker mapping, timestamped evidence rows, talk balance, possible dead air, neutral overlap wording, and filler evidence. Emphasize that the fixed fixture is not connected to any upload.

Select **Analyze call** with no key configured.

> CallLens fails closed: “Live AI is not configured. Add OPENAI_API_KEY to .env.local.” No paid request is attempted, and it never falls back to fake analysis. Adding the server-side key activates the same validated workflows you just explored.

## Final exact judge flow

1. Start on `/welcome`. Point out the miniature product preview, timestamped evidence, score 88, dialect badge, and privacy/evidence labels.
2. Select **Open workspace** and show the clearly labeled sample insight and latest sample call on the dashboard.
3. Open **Analyze Call**. Show both Upload Audio and Paste transcript, the six promised outputs, dialect helper, privacy masking, and the honest server-key requirement.
4. Open **View sample analysis**, select each Evidence Replay event, and show the synchronized transcript highlight and coaching detail. State that the fixture has no recording, so playback and seeking are intentionally disabled.
5. Explain that live transcription, analysis, and role-play activate only after `OPENAI_API_KEY` is configured server-side; no key or paid call was used for this build.
6. Show the coaching empty-state/sample coaching path, then the static role-play workflow preview and Easy/Intermediate/Advanced labels. Do not imply that the preview is a running simulation.
7. Return to `/` and end on the sample-only dashboard insight and latest sample call.
