import { z } from "zod";

const MAX_BYTES = 24_000;
const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100).refine(value => !/[\r\n]/.test(value)),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  business: z.string().trim().max(160).default(""),
  message: z.string().trim().min(10).max(4000),
  // Matches Inquiry.Service in Django and INQUIRY_SERVICES in analytics.ts; "app" is the retired choice.
  service: z.enum(["new", "redesign", "software", "automation", "unsure", "app"]),
  language: z.enum(["en", "es"]),
  website: z.string().trim().max(500).optional(),
  captchaToken: z.string().max(2048).optional(),
}).strict();

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface InquiryBackendConfig {
  INQUIRY_BACKEND_URL?: string;
  INQUIRY_API_KEY?: string;
  // Comma-separated public origins of this site, for example https://example.com.
  // Behind a TLS-terminating proxy the request arrives as plain http, so the browser's
  // Origin (https://...) never equals the request URL's origin and must be listed here.
  INQUIRY_ALLOWED_ORIGINS?: string;
  // Cloudflare Turnstile. The check is enforced only when BOTH keys are set, so it can be
  // deployed before the keys exist. The site key is public; the secret key never leaves the server.
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

/** The public site key to render, or undefined when the captcha is not fully configured. */
export function captchaSiteKey(config: Pick<InquiryBackendConfig, "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY">) {
  const site = config.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secret = config.TURNSTILE_SECRET_KEY?.trim() ?? "";
  return /^[0-9A-Za-z_-]{10,64}$/.test(site) && secret ? site : undefined;
}

type CaptchaOutcome = "ok" | "invalid" | "unavailable";

async function verifyCaptcha(
  token: string | undefined,
  inquiryId: string,
  config: InquiryBackendConfig,
  send: typeof fetch,
): Promise<CaptchaOutcome> {
  if (!token) return "invalid";
  try {
    // The inquiry UUID is the idempotency key, so retrying the same submission with the same
    // token (after a transient failure) verifies again instead of failing as a duplicate.
    const result = await send(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY!.trim(), response: token, idempotency_key: inquiryId }),
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });
    if (!result.ok) throw new Error("Turnstile unavailable");
    const payload: unknown = await result.json();
    if (!payload || typeof payload !== "object") throw new Error("Invalid Turnstile response");
    const outcome = payload as { success?: unknown; "error-codes"?: unknown };
    if (outcome.success === true) return "ok";
    const codes = Array.isArray(outcome["error-codes"]) ? outcome["error-codes"].map(String) : [];
    // A wrong or missing secret is our misconfiguration, not the visitor's failure.
    if (codes.some((code) => code === "missing-input-secret" || code === "invalid-input-secret" || code === "internal-error")) {
      console.error("captcha_misconfigured", codes.join(","));
      return "unavailable";
    }
    return "invalid";
  } catch (error) {
    console.error("captcha_unavailable", error instanceof Error ? error.name : "UnknownError");
    return "unavailable";
  }
}

function allowedOrigins(request: Request, config: InquiryBackendConfig) {
  const allowed = new Set([new URL(request.url).origin]);
  for (const entry of (config.INQUIRY_ALLOWED_ORIGINS ?? "").split(",")) {
    try {
      const url = new URL(entry.trim());
      if (["https:", "http:"].includes(url.protocol)) allowed.add(url.origin);
    } catch {
      // A malformed entry never widens the allow-list.
    }
  }
  return allowed;
}

function response(body: object, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function readBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BYTES) throw new RangeError("Too large");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError("Too large");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function backendEndpoint(config: InquiryBackendConfig) {
  if (!config.INQUIRY_BACKEND_URL || !config.INQUIRY_API_KEY) throw new Error("Missing backend configuration");
  const url = new URL(config.INQUIRY_BACKEND_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // A dotless name such as "backend" can only come from private DNS (a Docker or
  // Kubernetes service on the same host), never a public site, so plain HTTP is allowed.
  const privateService = /^[a-z0-9][a-z0-9_-]*$/i.test(url.hostname);
  if (
    (url.protocol !== "https:" && !((local || privateService) && url.protocol === "http:"))
    || url.username || url.password || url.search || url.hash || url.pathname !== "/"
  ) throw new Error("Invalid backend configuration");
  return new URL("/api/inquiries", url);
}

export async function submitInquiry(
  request: Request,
  config: InquiryBackendConfig,
  send: typeof fetch = fetch,
) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return response({ error: "Expected JSON" }, 415);
  }
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins(request, config).has(origin)) {
    return response({ error: "Invalid origin" }, 403);
  }
  let body: unknown;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    return response({ error: error instanceof RangeError ? "Too large" : "Invalid request" }, error instanceof RangeError ? 413 : 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.website) return response({ error: "Please check your details" }, 400);
  const { captchaToken, ...inquiry } = parsed.data;
  if (captchaSiteKey(config)) {
    const outcome = await verifyCaptcha(captchaToken, inquiry.id, config, send);
    if (outcome === "invalid") return response({ error: "Captcha failed" }, 403);
    if (outcome === "unavailable") return response({ error: "Your inquiry could not be saved. Please try again." }, 503);
  }
  try {
    const result = await send(backendEndpoint(config), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Inquiry-Api-Key": config.INQUIRY_API_KEY! },
      body: JSON.stringify(inquiry),
      signal: AbortSignal.timeout(10_000),
      // Workers reject redirect:"error". "manual" never follows a redirect, so the key
      // cannot reach another host; any 3xx is not 200/201 and becomes a generic 503.
      redirect: "manual",
    });
    if (result.status === 200 || result.status === 201) {
      const payload: unknown = await result.json();
      if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
        throw new Error("Invalid backend response");
      }
      return response({ ok: true }, result.status);
    }
    const messages: Record<number, string> = {
      400: "Please check your details",
      409: "Invalid inquiry ID",
      413: "Too large",
      415: "Expected JSON",
      429: "Please try again later",
    };
    if (messages[result.status]) {
      return response({ error: messages[result.status] }, result.status, result.status === 429 ? { "Retry-After": "3600" } : {});
    }
    console.error("inquiry_backend_unavailable", result.status);
  } catch (error) {
    console.error("inquiry_backend_unavailable", error instanceof Error ? error.name : "UnknownError");
  }
  return response({ error: "Your inquiry could not be saved. Please try again." }, 503);
}
