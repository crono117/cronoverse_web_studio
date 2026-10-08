export const ANALYTICS_CONSENT_KEY = "cronoverse-analytics-consent";
export type AnalyticsConsent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, ...parameters: unknown[]) => void;
  }
}

let activeId: string | null = null;
const initializedIds = new Set<string>();
const countedInquiries = new Set<string>();

export function measurementId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^G-[A-Z0-9]{6,20}$/.test(id) ? id : null;
}

export function savedAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

// The site has no public routes containing visitor data. Drop query strings
// and fragments, which could otherwise carry contact information.
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.origin + url.pathname : "";
  } catch {
    return "";
  }
}

function disableAnalytics(id: string) {
  const browser = window as unknown as Record<string, unknown>;
  browser["ga-disable-" + id] = true;
  activeId = null;
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  try {
    const names = document.cookie.split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .filter((name) => /^_ga(?:_|$)/.test(name));
    const domains = [""];
    const parts = window.location.hostname.split(".");
    while (parts.length > 1) {
      domains.push(parts.join("."), "." + parts.join("."));
      parts.shift();
    }
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = name + "=; Max-Age=0; Path=/" + (domain ? "; Domain=" + domain : "");
      }
    }
  } catch {
    // Browser storage restrictions must not interfere with the inquiry form.
  }
}

export function applyAnalyticsConsent(rawId: unknown, consent: AnalyticsConsent): boolean {
  const id = measurementId(rawId);
  if (!id || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // The explicit choice still applies to the current page.
  }
  if (consent !== "granted") {
    disableAnalytics(id);
    return false;
  }
  const browser = window as unknown as Record<string, unknown>;
  browser["ga-disable-" + id] = false;
  window.dataLayer ??= [];
  window.gtag ??= function () {
    // gtag.js only recognizes the Arguments object; a rest-parameter array is ignored.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  if (!initializedIds.has(id)) {
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", id, {
      send_page_view: true,
      page_location: analyticsUrl(window.location.href),
      page_referrer: analyticsUrl(document.referrer),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    // Let the Google tag send the initial pageview; no second manual pageview.
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
    script.id = "cronoverse-google-analytics";
    document.head.appendChild(script);
    initializedIds.add(id);
  } else {
    window.gtag("consent", "update", { analytics_storage: "granted" });
  }
  activeId = id;
  return true;
}

export function trackInquirySuccess(id: string, service: string, language: string): boolean {
  if (!activeId || !id || countedInquiries.has(id) || typeof window === "undefined") return false;
  try {
    if (!window.gtag) return false;
    window.gtag("event", "generate_lead", {
      send_to: activeId,
      form_name: "project_inquiry",
      service: ["new", "redesign", "app", "unsure"].includes(service) ? service : "unsure",
      language: language === "es" ? "es" : "en",
    });
    // Used only for local deduplication; never sent to Google.
    countedInquiries.add(id);
    return true;
  } catch {
    return false;
  }
}
