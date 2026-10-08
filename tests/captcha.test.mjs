import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { captchaSiteKey, submitInquiry } from "../lib/inquiry-intake.ts";

const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const base = { INQUIRY_BACKEND_URL: "https://backend.example.com", INQUIRY_API_KEY: "test-server-secret" };
const enabled = { ...base, TURNSTILE_SITE_KEY: "0x4AAAAAAATESTKEY1234", TURNSTILE_SECRET_KEY: "test-turnstile-secret" };
const inquiry = () => ({ id: randomUUID(), name: "Alex Rivera", email: "alex@example.com", message: "A website for my business.", service: "new", language: "en", website: "" });
const post = (data) => new Request("https://studio.example.com/api/inquiries", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://studio.example.com" }, body: JSON.stringify(data),
});

// A fetch double that answers Cloudflare and Django separately and records both calls.
function double({ cloudflare = () => Response.json({ success: true }), django = () => Response.json({ ok: true }, { status: 201 }) } = {}) {
  const calls = { cloudflare: [], django: [] };
  const send = async (url, options) => {
    const href = String(url);
    if (href === VERIFY) { calls.cloudflare.push(options); return cloudflare(options); }
    calls.django.push(options);
    return django(options);
  };
  return { send, calls };
}

test("the captcha is enforced only when both keys are set, and a site key must look valid", async () => {
  assert.equal(captchaSiteKey({}), undefined);
  assert.equal(captchaSiteKey({ TURNSTILE_SITE_KEY: "0x4AAAAAAATESTKEY1234" }), undefined);
  assert.equal(captchaSiteKey({ TURNSTILE_SECRET_KEY: "secret" }), undefined);
  assert.equal(captchaSiteKey({ TURNSTILE_SITE_KEY: "short", TURNSTILE_SECRET_KEY: "secret" }), undefined);
  assert.equal(captchaSiteKey({ TURNSTILE_SITE_KEY: '"><script>alert(1)</script>', TURNSTILE_SECRET_KEY: "secret" }), undefined);
  assert.equal(captchaSiteKey(enabled), "0x4AAAAAAATESTKEY1234");
  // Disabled means no token is needed and Cloudflare is never contacted.
  for (const config of [base, { ...base, TURNSTILE_SITE_KEY: "0x4AAAAAAATESTKEY1234" }]) {
    const { send, calls } = double();
    assert.equal((await submitInquiry(post(inquiry()), config, send)).status, 201);
    assert.equal(calls.cloudflare.length, 0);
  }
});

test("a missing or empty token is refused before Cloudflare or Django is contacted", async () => {
  for (const data of [inquiry(), { ...inquiry(), captchaToken: "" }]) {
    const { send, calls } = double();
    const result = await submitInquiry(post(data), enabled, send);
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), { error: "Captcha failed" });
    assert.equal(calls.cloudflare.length + calls.django.length, 0);
  }
});

test("a valid token is verified with the secret and inquiry UUID, then never forwarded to Django", async () => {
  const data = { ...inquiry(), captchaToken: "token-from-the-browser" };
  const { send, calls } = double();
  const result = await submitInquiry(post(data), enabled, send);
  assert.equal(result.status, 201);
  assert.equal(calls.cloudflare.length, 1);
  const form = calls.cloudflare[0].body;
  assert.equal(form.get("secret"), "test-turnstile-secret");
  assert.equal(form.get("response"), "token-from-the-browser");
  assert.equal(form.get("idempotency_key"), data.id);
  assert.equal(calls.cloudflare[0].redirect, "manual");
  assert.equal(calls.django.length, 1);
  const forwarded = JSON.parse(calls.django[0].body);
  assert.ok(!("captchaToken" in forwarded));
  assert.ok(!JSON.stringify(forwarded).includes("token-from-the-browser"));
  assert.equal(calls.django[0].headers["X-Inquiry-Api-Key"], base.INQUIRY_API_KEY);
});

test("a retry of the same inquiry and token verifies again, so a transient failure does not lose the submission", async () => {
  const data = { ...inquiry(), captchaToken: "reused-token" };
  let attempts = 0;
  const { send, calls } = double({ django: () => (++attempts === 1 ? new Response("down", { status: 502 }) : Response.json({ ok: true }, { status: 201 })) });
  assert.equal((await submitInquiry(post(data), enabled, send)).status, 503);
  assert.equal((await submitInquiry(post(data), enabled, send)).status, 201);
  assert.equal(calls.cloudflare.length, 2);
  assert.deepEqual(calls.cloudflare.map((call) => call.body.get("idempotency_key")), [data.id, data.id]);
});

test("a rejected token is the visitor's failure, but our own misconfiguration or an outage is not", async () => {
  const data = () => ({ ...inquiry(), captchaToken: "some-token" });
  for (const codes of [["invalid-input-response"], ["timeout-or-duplicate"], []]) {
    const { send, calls } = double({ cloudflare: () => Response.json({ success: false, "error-codes": codes }) });
    const result = await submitInquiry(post(data()), enabled, send);
    assert.equal(result.status, 403, codes.join());
    assert.equal(calls.django.length, 0);
  }
  const unavailable = [
    () => Response.json({ success: false, "error-codes": ["invalid-input-secret"] }),
    () => Response.json({ success: false, "error-codes": ["internal-error"] }),
    () => new Response("<html>error</html>", { status: 500 }),
    () => new Response("not json", { status: 200 }),
    () => { throw new Error("network down"); },
  ];
  for (const cloudflare of unavailable) {
    const { send, calls } = double({ cloudflare });
    const result = await submitInquiry(post(data()), enabled, send);
    assert.equal(result.status, 503);
    assert.ok(!(await result.text()).includes("test-turnstile-secret"));
    assert.equal(calls.django.length, 0);
  }
});

test("an oversized token is rejected as invalid input without contacting anyone", async () => {
  const { send, calls } = double();
  const result = await submitInquiry(post({ ...inquiry(), captchaToken: "x".repeat(2049) }), enabled, send);
  assert.equal(result.status, 400);
  assert.equal(calls.cloudflare.length + calls.django.length, 0);
});
