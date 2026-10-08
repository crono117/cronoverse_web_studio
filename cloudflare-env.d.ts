declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GA4_MEASUREMENT_ID?: string;
    INQUIRY_BACKEND_URL?: string;
    INQUIRY_API_KEY?: string;
    INQUIRY_ALLOWED_ORIGINS?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}
