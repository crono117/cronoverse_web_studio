import { NextResponse, type NextRequest } from "next/server";
import { LANGUAGE_COOKIE, LANGUAGE_HEADER, resolveLanguage } from "@/lib/site";

// Decides the page language before rendering, so the root layout can set <html lang>
// and the page can render the right copy and metadata on the server.
export function proxy(request: NextRequest) {
  const lang = resolveLanguage(request.nextUrl.searchParams.get("lang"), request.cookies.get(LANGUAGE_COOKIE)?.value);
  const headers = new Headers(request.headers);
  headers.set(LANGUAGE_HEADER, lang);
  const response = NextResponse.next({ request: { headers } });
  // "/" can render either language depending on the cookie, so caches must key on it.
  response.headers.append("Vary", "Cookie");
  return response;
}

export const config = { matcher: ["/"] };
