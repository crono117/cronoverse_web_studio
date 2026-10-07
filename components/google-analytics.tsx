"use client";

import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  applyAnalyticsConsent,
  measurementId,
  savedAnalyticsConsent,
} from "@/lib/analytics";

const copy = {
  en: {
    title: "Help us understand our visitors",
    text: "Allow Google Analytics cookies to measure visits and inquiry counts?",
    accept: "Allow analytics",
    decline: "Decline",
    settings: "Analytics cookie settings",
  },
  es: {
    title: "Ayúdanos a entender a nuestros visitantes",
    text: "¿Permites cookies de Google Analytics para medir visitas y consultas?",
    accept: "Permitir estadísticas",
    decline: "Rechazar",
    settings: "Preferencias de cookies de estadísticas",
  },
};

export function GoogleAnalytics({ id: rawId }: { id?: string }) {
  const id = measurementId(rawId);
  const [lang, setLang] = useState<"en" | "es">("en");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const saved = savedAnalyticsConsent();
    if (saved) applyAnalyticsConsent(id, saved);
    setOpen(saved === null);
    setReady(true);
    const language = () => setLang(document.documentElement.lang === "es" ? "es" : "en");
    language();
    const observer = new MutationObserver(language);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    const storage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
      const consent = savedAnalyticsConsent();
      applyAnalyticsConsent(id, consent ?? "denied");
      setOpen(consent === null);
    };
    window.addEventListener("storage", storage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", storage);
    };
  }, [id]);

  if (!id || !ready) return null;
  const t = copy[lang];
  function choose(consent: "granted" | "denied") {
    applyAnalyticsConsent(id, consent);
    setOpen(false);
  }
  return <>
    <div className="analytics-settings">
      <div className="wrap">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open}>
          {t.settings}
        </button>
      </div>
    </div>
    {open && <section className="analytics-banner" aria-labelledby="analytics-title">
      <h2 id="analytics-title">{t.title}</h2>
      <p>{t.text}</p>
      <div className="analytics-actions">
        <button type="button" onClick={() => choose("granted")}>{t.accept}</button>
        <button type="button" onClick={() => choose("denied")}>{t.decline}</button>
      </div>
    </section>}
  </>;
}
