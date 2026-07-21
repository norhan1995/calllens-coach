import assert from "node:assert/strict";
import test from "node:test";

async function request(path, init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, init), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

for (const [path, expected] of [
  ["/", "Good morning, Alex."],
  ["/welcome", "The dialect-aware AI QA manager for modern contact centers."],
  ["/analyze", "Turn a conversation into clear coaching."],
  ["/results", "What your analysis will include"],
  ["/coaching", "Your coaching plan will include"],
  ["/practice", "Practice Role-play"],
  ["/settings", "Restore defaults"],
  ["/sample-analysis", "Example output for interface exploration"],
  ["/sample-audio-analysis", "Example output for interface exploration"],
  ["/report?example=1", "Maya delivered a calm, accurate resolution"],
]) {
  test(`server-renders ${path}`, async () => {
    const response = await request(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });
}

test("polished landing preview keeps the support promise and sample labels", async () => {
  const response = await request("/welcome", { headers: { accept: "text/html" } });
  const html = await response.text();
  assert.match(html, /Upload a recording\. Get timestamped evidence, QA scoring, and focused coaching\./);
  assert.match(html, /Egyptian Arabic/);
  assert.match(html, /Evidence verified/);
  assert.match(html, /Privacy masking on/);
});

test("results and coaching have honest, structurally distinct empty states", async () => {
  const results = await (await request("/results", { headers: { accept: "text/html" } })).text();
  const coaching = await (await request("/coaching", { headers: { accept: "text/html" } })).text();
  assert.match(results, /No live analysis yet/);
  assert.match(results, /Timestamped transcript/);
  assert.doesNotMatch(results, /Customer frustration detected/);
  assert.match(coaching, /structure placeholders, not generated recommendations/);
  assert.match(coaching, /Role-play scenarios/);
  assert.doesNotMatch(coaching, /What your analysis will include/);
});

test("sample Evidence Replay is interactive in markup and isolated from live empty results", async () => {
  const sample = await (await request("/sample-analysis", { headers: { accept: "text/html" } })).text();
  const live = await (await request("/results", { headers: { accept: "text/html" } })).text();
  assert.match(sample, /SAMPLE EVIDENCE REPLAY · NO PLAYABLE AUDIO/);
  assert.match(sample, /Customer frustration detected/);
  assert.match(sample, /Verification missed/);
  assert.match(sample, /Transcript-only sample/);
  assert.doesNotMatch(live, /Customer frustration detected/);
});

test("dashboard, role-play, and settings expose the final polish affordances", async () => {
  const dashboard = await (await request("/", { headers: { accept: "text/html" } })).text();
  const practice = await (await request("/practice", { headers: { accept: "text/html" } })).text();
  const settings = await (await request("/settings", { headers: { accept: "text/html" } })).text();
  assert.match(dashboard, /TODAY’S QA INSIGHT · SAMPLE/);
  assert.match(dashboard, /LATEST SAMPLE CALL/);
  assert.match(practice, /WORKFLOW PREVIEW · STATIC EXAMPLE/);
  assert.match(practice, /AI COACH FEEDBACK · PREVIEW/);
  assert.match(practice, />Easy</);
  assert.match(settings, /Restore defaults/);
  assert.match(settings, /Stored locally; no call content or credentials/);
});

test("all live AI endpoints stop before an API call when the key is missing", async () => {
  for (const path of ["/api/analyze", "/api/transcribe", "/api/role-play"]) {
    const response = await request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(response.status, 503, path);
    const payload = await response.json();
    assert.equal(payload.error.code, "live_ai_not_configured", path);
    assert.equal(payload.error.message, "Live AI is not configured. Add OPENAI_API_KEY to .env.local.", path);
  }
});

test("AI status exposes configuration state without exposing a key", async () => {
  const response = await request("/api/ai-status", { headers: { accept: "application/json" } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.transcriptionConfigured, false);
  assert.equal(payload.transcriptionModel, "gpt-4o-transcribe-diarize");
  assert.equal(payload.maxAudioFileMb, 25);
  assert.equal("apiKey" in payload, false);
});

test("Arabic Intelligence is an isolated opt-in beside the unchanged Standard mode", async () => {
  const response = await request("/analyze", { headers: { accept: "text/html" } });
  const html = await response.text();
  assert.match(html, /TRANSCRIPTION MODE/);
  assert.match(html, />Standard</);
  assert.match(html, />Arabic Intelligence</);
  assert.match(html, />Egyptian Arabic</);
  assert.match(html, /Choose a dialect when known/);
  assert.match(html, /Standard preserves the stable English flow/);
  assert.doesNotMatch(html, /OpenAI transcription response diagnostics/);
});
