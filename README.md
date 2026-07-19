# CallLens Coach

CallLens Coach is the dialect-aware AI QA manager for modern contact centers. It turns English, Arabic, and code-switched conversations into evidence-based quality scores, culturally aware communication insight, and measurable agent coaching.

Built for OpenAI Build Week, the product is designed for contact-center QA managers, team leaders, coaches, and agents in customer service, medical booking, sales, and collections.

## Product problem

Traditional contact-center QA is slow, samples only a small share of calls, and often scores a checklist without explaining the evidence. English-first systems also miss Arabic dialect, indirect complaints, code-switching, and culturally specific reassurance. The result is feedback that is difficult for an agent to trust or apply.

CallLens Coach differentiates itself through:

- dialect-aware English and Arabic analysis;
- transcript evidence attached to every major finding;
- configurable scorecards by contact-center workflow;
- privacy masking before live analysis;
- critical-moment timelines and before/after call reconstruction;
- an interactive customer role-play and seven-day coaching plan;
- manager-ready printable reports.

## Architecture

The application is a Vinext/React 19 site deployed as a Cloudflare-compatible worker.

```text
Browser UI
  ├─ in-memory call state (transcript, audio result, analysis, report)
  ├─ localStorage (non-sensitive demo settings and scorecards only)
  └─ secure requests
       ├─ POST /api/analyze      → OpenAI Responses API + strict Zod output
       ├─ POST /api/transcribe   → OpenAI Audio Transcriptions API
       └─ POST /api/role-play    → OpenAI Responses API + strict Zod output
```

The OpenAI SDK is imported only by server routes. `OPENAI_API_KEY` is never read by client components, returned in errors, or written to logs. Raw uploaded audio and unmasked transcripts are never persisted by the application.

## Pages and features

- `/welcome` — public product landing page.
- `/` — existing QA dashboard.
- `/analyze` — transcript samples, pasted transcripts, validated audio upload, language/dialect selection, scorecard context, and privacy status.
- `/results` — current validated live analysis with category scores, evidence, dialect insight, critical moments, reconstruction, and improved phrases.
- `/sample-analysis` — clearly labeled example output for interface exploration; never represented as a live result.
- `/coaching` — evidence-based priorities, customer follow-up message, and seven-day plan.
- `/practice` — configurable role-play setup, turn-by-turn customer simulation, feedback, and final assessment.
- `/settings` — local workspace preferences, privacy masking, and four configurable QA scorecards.
- `/report` — print-friendly manager report using the current in-memory analysis.

## Secure API design

All three AI routes fail closed when the key is missing and return:

> Live AI is not configured. Add OPENAI_API_KEY to .env.local.

No API request is attempted in that state. Routes also provide sanitized handling for timeouts, rate limits, connection failures, model/key access errors, invalid requests, malformed structured output, and concurrent duplicate submissions.

The analysis and role-play routes use the official OpenAI JavaScript SDK, the Responses API, `store: false`, and Zod-backed structured outputs. The transcription route uses the official Audio Transcriptions API and preserves the source language rather than translating it.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
OPENAI_API_KEY=
OPENAI_ANALYSIS_MODEL=gpt-5.6-terra
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
```

`.env.local` and all other `.env*` files are ignored by Git, while `.env.example` is committed. Never expose the key through a `NEXT_PUBLIC_` variable.

## Transcript-analysis contract

The input schema requires:

- transcript, agent name, call type;
- selected language and Arabic dialect;
- a validated QA scorecard whose weights total 100%;
- optional timestamped transcript segments;
- the server-side masking preference.

The output schema validates 0–100 overall and category scores, detected language/dialect, sentiment, intent, executive summary, evidence-based strengths/mistakes/warnings/opportunities/recommendations, improved phrases, follow-up copy, confidence, dialect insight, critical moments, improved conversation, estimated revised score, and seven coaching days.

Every strength, mistake, warning, missed opportunity, and coaching recommendation must include evidence with a verbatim quote, speaker, explanation, optional timestamp/position, and scoring category. Invalid output is rejected before it reaches application state.

## Transcription flow

The browser validates non-empty MP3, WAV, M4A, MP4, OGG, WebM, and FLAC files up to 25 MB. Audio is held only in memory and sent to `/api/transcribe`. The server validates it again, calls the configured transcription model, and returns:

- the original-language transcript;
- detected language when the model supplies it;
- audio duration when supplied, otherwise clearly typed processing duration;
- timestamped segments when the selected model/format supplies them.

The UI reports Uploading, Transcribing, Detecting speakers and language, Analyzing quality, and Building coaching plan. It never invents speaker labels or timestamps.

## Arabic dialect support

The prompt and schema support Egyptian Arabic, Gulf Arabic, Modern Standard Arabic, Levantine Arabic, English, and mixed Arabic/English. Analysis guidance covers code-switching, indirect complaints, culturally appropriate tone, dialect reassurance, and overly informal or dismissive phrases. Arabic evidence is preserved and displayed right-to-left using content-aware direction logic.

The Results page includes detected dialect, code-switching, an important expression, literal and contextual interpretations, and its QA/customer-experience significance. Live values only come from a validated response.

## Privacy masking

Masking is enabled by default and runs server-side before live transcript analysis. It detects common patterns for email, phone, payment-card-like numbers, customer IDs, account numbers, and patient identifiers. The API returns the number detected, number masked, and types found.

This is defensive pattern matching, not a perfect privacy or compliance system. Do not upload confidential production data during the hackathon demo.

## Role-play design

Role-play templates cover angry billing, hesitant medical patients, price-sensitive sales prospects, escalation requests, and collections objections. Setup also controls mood, difficulty, language, dialect, and coaching goal. Live AI acts as the customer turn by turn; feedback and end actions produce a score, strengths, mistakes, a better reply, category feedback, next practice, and a comparison with the analyzed call when a valid baseline exists.

Without a key, the full setup renders but Start Practice returns the missing-live-AI message and does not simulate a reply.

## Local setup

Requirements: Node.js 22.13+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open the local URL printed by the development server.

## Testing

```bash
pnpm lint
pnpm type-check
pnpm test:unit
pnpm test
pnpm build
```

Unit coverage includes schemas, score bounds, 100% rubric totals, malformed response rejection, masking, file validation, Arabic RTL logic, state mapping, and report data. The built-worker suite renders key routes and verifies that every AI route returns the missing-key response before attempting a live call. See [TESTING.md](./TESTING.md) for manual QA.

## Deployment

1. Run the complete checks above.
2. Configure `OPENAI_API_KEY`, `OPENAI_ANALYSIS_MODEL`, and `OPENAI_TRANSCRIPTION_MODEL` as server-side runtime variables in the hosting environment.
3. Build the Cloudflare-compatible output with `pnpm build`.
4. Publish the validated source/build through OpenAI Sites. Do not place secrets in `.openai/hosting.json`; that file stores only Sites resource bindings.

The app remains buildable and useful for sample exploration without the key.

## Three-minute demo

Use [DEMO_SCRIPT.md](./DEMO_SCRIPT.md). The safest judge flow is: open `/welcome`, explore `/sample-analysis`, inspect evidence and dialect insight, show reconstruction and the report, then open `/analyze` to demonstrate transcript/audio inputs and the honest missing-key state.

## Known limitations

- Live analysis, transcription, and role-play require `OPENAI_API_KEY`; paid API calls were not run during this build.
- Audio speaker/timestamp segments appear only when the configured transcription model returns them.
- Privacy masking may miss or over-match sensitive values and is not a substitute for a production DLP review.
- Call state is intentionally in memory; a hard refresh clears sensitive working data.
- Settings persist only on the current device. There is no authentication, team database, or historical call store yet.
- Duplicate protection covers concurrent in-process submissions; production-wide idempotency would use durable storage.
- AI output still requires manager review, especially for compliance and medical workflows.

## How Codex was used

Codex audited the existing single-component application, preserved its design language, implemented the typed domain and secure server routes, upgraded the workflows, created tests and documentation, generated the product social card, and ran type, lint, unit, worker-render, production-build, and browser checks. It was used as an implementation and verification partner, not as a source of fake call results.

## How GPT-5.6 powers the final live experience

`gpt-5.6-terra` is the default analysis model because it balances quality and cost for structured multilingual QA. It will power validated transcript analysis and role-play through the Responses API. `gpt-4o-transcribe` handles source-language audio transcription. The model names remain environment-configurable so deployment can adapt to model access and evaluated quality without client changes.

## Build Week work completed

See [BUILD_WEEK.md](./BUILD_WEEK.md) for the dated feature log.
