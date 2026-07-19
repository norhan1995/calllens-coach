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

Open **Analyze Call**. Load the Arabic sample, show automatic RTL, dialect selection, active scorecard, and privacy masking. Switch to Upload Audio and point out supported formats and progress stages.

Select **Analyze call** with no key configured.

> CallLens fails closed: “Live AI is not configured. Add OPENAI_API_KEY to .env.local.” No paid request is attempted, and it never falls back to fake analysis. Adding the server-side key activates the same validated workflows you just explored.
