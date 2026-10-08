import { z } from "zod";

const MAX_BYTES = 24_000;
const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(100).refine(value => !/[\r\n]/.test(value)),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  business: z.string().trim().max(160).default(""),
  message: z.string().trim().min(10).max(4000),
  service: z.enum(["new", "redesign", "app", "unsure"]),
  language: z.enum(["en", "es"]),
  website: z.string().trim().max(500).optional(),
}).strict();

export interface InquiryBackendConfig {
  INQUIRY_BACKEND_URL?: string;
  INQUIRY_API_KEY?: string;
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
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
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
  if (origin && origin !== new URL(request.url).origin) {
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
  try {
    const result = await send(backendEndpoint(config), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Inquiry-Api-Key": config.INQUIRY_API_KEY! },
      body: JSON.stringify(parsed.data),
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
