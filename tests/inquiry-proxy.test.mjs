import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { submitInquiry } from "../lib/inquiry-intake.ts";

const config = { INQUIRY_BACKEND_URL: "https://backend.example.com", INQUIRY_API_KEY: "test-server-secret" };
const payload = { id: randomUUID(), name: "Alex Rivera", email: "ALEX@EXAMPLE.COM", message: "A website for my business.", service: "new", language: "en", website: "" };
const request = (data = payload, headers = {}) => new Request("https://studio.example.com/api/inquiries", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://studio.example.com", ...headers },
  body: JSON.stringify(data),
});

test("forwards validated data and server secret, with no visitor cookies", async () => {
  let calls = 0;
  const result = await submitInquiry(request(payload, { Cookie: "private=1", "X-Inquiry-Api-Key": "client-controlled" }), config, async (url, options) => {
    calls++;
    assert.equal(url.href, "https://backend.example.com/api/inquiries");
    assert.equal(options.headers["X-Inquiry-Api-Key"], config.INQUIRY_API_KEY);
    assert.equal(options.headers.Cookie, undefined);
    assert.equal(JSON.parse(options.body).email, "alex@example.com");
    assert.equal(options.redirect, "error");
    return Response.json({ ok: true }, { status: 201 });
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(result.headers.get("cache-control"), "no-store");
});

test("passes an acknowledged unchanged retry through as 200", async () => {
  const result = await submitInquiry(request(), config, async () => Response.json({ ok: true }, { status: 200 }));
  assert.equal(result.status, 200);
});

test("rejects invalid origin, JSON, fields and honeypot before contacting backend", async () => {
  const never = async () => { throw new Error("Should not contact backend"); };
  assert.equal((await submitInquiry(request(payload, { Origin: "https://other.example.com" }), config, never)).status, 403);
  assert.equal((await submitInquiry(request(payload, { "Content-Type": "text/plain" }), config, never)).status, 415);
  for (const changes of [{ email: "invalid" }, { website: "spam" }, { service: "other" }, { unknown: true }, { name: "Multi\nLine" }]) {
    assert.equal((await submitInquiry(request({ ...payload, ...changes }), config, never)).status, 400);
  }
  const malformed = new Request("https://studio.example.com/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await submitInquiry(malformed, config, never)).status, 400);
});

test("enforces actual UTF-8 byte limits, including streams without content-length", async () => {
  const body = JSON.stringify({ ...payload, message: "é".repeat(12_001) });
  const oversized = new Request("https://studio.example.com/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.equal((await submitInquiry(oversized, config)).status, 413);
});

test("fails clearly if Django is unconfigured rather than silently saving only in D1", async () => {
  let called = false;
  const result = await submitInquiry(request(), {}, async () => { called = true; return Response.json({ ok: true }); });
  assert.equal(called, false);
  assert.equal(result.status, 503);
});

test("requires HTTPS for a remote backend and permits loopback for development", async () => {
  for (const url of ["http://backend.example.com", "https://user:pass@backend.example.com", "https://backend.example.com/path", "https://backend.example.com?query=1"]) {
    assert.equal((await submitInquiry(request(), { ...config, INQUIRY_BACKEND_URL: url })).status, 503);
  }
  const result = await submitInquiry(request(), { ...config, INQUIRY_BACKEND_URL: "http://127.0.0.1:8000" }, async () => Response.json({ ok: true }));
  assert.equal(result.status, 200);
});

test("preserves quota and validation status codes without exposing backend details", async () => {
  for (const status of [400, 409, 413, 415, 429]) {
    const result = await submitInquiry(request(), config, async () => Response.json({ error: "private backend details" }, { status }));
    assert.equal(result.status, status);
    assert.ok(!(await result.text()).includes("private backend details"));
    if (status === 429) assert.equal(result.headers.get("retry-after"), "3600");
  }
});

test("reports failures without false success or leaking the shared key", async () => {
  const replies = [
    async () => Response.json({ secret: config.INQUIRY_API_KEY }, { status: 403 }),
    async () => new Response("<html>private error</html>", { status: 500 }),
    async () => Response.json({ ok: false }),
    async () => { throw new Error("network down"); },
  ];
  for (const reply of replies) {
    const result = await submitInquiry(request(), config, reply);
    assert.equal(result.status, 503);
    assert.ok(!(await result.text()).includes(config.INQUIRY_API_KEY));
  }
});
