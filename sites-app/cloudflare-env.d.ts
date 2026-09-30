declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AFTER_CLOSE_KEY?: string;
  }
}
