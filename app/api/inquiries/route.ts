import { env } from "cloudflare:workers";

import { submitInquiry } from "@/lib/inquiry-intake";

export async function POST(request: Request) {
  return submitInquiry(request, {
    INQUIRY_BACKEND_URL: env.INQUIRY_BACKEND_URL,
    INQUIRY_API_KEY: env.INQUIRY_API_KEY,
    INQUIRY_ALLOWED_ORIGINS: env.INQUIRY_ALLOWED_ORIGINS,
    TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
  });
}
