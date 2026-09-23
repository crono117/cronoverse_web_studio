import { env } from "cloudflare:workers";
export function inquiryDb(){ if(!env.DB) throw new Error("Inquiry storage is unavailable"); return env.DB; }
