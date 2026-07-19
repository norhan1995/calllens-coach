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
  ["/practice", "Practice Role-play"],
  ["/sample-analysis", "Example output for interface exploration"],
  ["/report?example=1", "Maya delivered a calm, accurate resolution"],
]) {
  test(`server-renders ${path}`, async () => {
    const response = await request(path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });
}

test("all live AI endpoints stop before an API call when the key is missing", async () => {
  for (const path of ["/api/analyze", "/api/transcribe", "/api/role-play"]) {
    const response = await request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(response.status, 503, path);
    const payload = await response.json();
    assert.equal(payload.error.code, "live_ai_not_configured", path);
    assert.equal(payload.error.message, "Live AI is not configured. Add OPENAI_API_KEY to .env.local.", path);
  }
});
