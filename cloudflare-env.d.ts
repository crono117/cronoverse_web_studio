declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    INQUIRY_BACKEND_URL?: string;
    INQUIRY_API_KEY?: string;
  }
}
