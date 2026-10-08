"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cronoverse-turnstile";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_WAIT_MS = 15_000;

export interface CaptchaHandle {
  /** Resolves with a Turnstile token, or null if none arrives in time or the widget failed. */
  token(): Promise<string | null>;
  /** Discards the current token and asks Cloudflare for a new one. */
  reset(): void;
}

function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const done = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not initialize")));
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", done);
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
    document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile. It is hidden unless Cloudflare decides the visitor must interact, and
 * it is rendered again when the language changes so its own text follows the site language.
 * A token is single-use per solve, but the server verifies with the inquiry UUID as an
 * idempotency key, so an automatic retry of the same submission can reuse it.
 */
export const Captcha = forwardRef<CaptchaHandle, { siteKey: string; lang: "en" | "es" }>(function Captcha({ siteKey, lang }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const current = useRef<string | null>(null);
  const waiting = useRef<Array<(token: string | null) => void>>([]);

  function settle(token: string | null) {
    current.current = token;
    for (const resolve of waiting.current.splice(0)) resolve(token);
  }

  useImperativeHandle(ref, () => ({
    token() {
      if (current.current) return Promise.resolve(current.current);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), TOKEN_WAIT_MS);
        waiting.current.push((token) => { clearTimeout(timer); resolve(token); });
      });
    },
    reset() {
      current.current = null;
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    const element = container.current;
    if (!element) return;
    loadScript().then((turnstile) => {
      if (cancelled) return;
      widget.current = turnstile.render(element, {
        sitekey: siteKey,
        language: lang,
        theme: "light",
        size: "flexible",
        appearance: "interaction-only",
        callback: (token: string) => settle(token),
        "expired-callback": () => { current.current = null; },
        "error-callback": () => { settle(null); return true; },
      });
    }).catch(() => settle(null));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
      current.current = null;
    };
  }, [siteKey, lang]);

  return <div ref={container} className="captcha-slot" />;
});
