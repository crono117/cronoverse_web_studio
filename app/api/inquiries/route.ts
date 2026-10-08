import { env } from "cloudflare:workers";

import { submitInquiry } from "@/lib/inquiry-intake";

export async function POST(request: Request) {
  return submitInquiry(request, {
    INQUIRY_BACKEND_URL: env.INQUIRY_BACKEND_URL,
    INQUIRY_API_KEY: env.INQUIRY_API_KEY,
  });
}
