// Site-wide constants and the language contract shared by the server (proxy, layout,
// metadata) and the browser (language toggle). The page is one URL per language:
// "/" is English (and x-default), "/?lang=es" is Spanish. A cookie remembers the
// visitor's choice so a plain "/" visit renders their language on the server, with
// no flash of the other language before hydration.
export type Language = "en" | "es";

export const SITE_URL = "https://cronoverse.online";
export const LANGUAGE_COOKIE = "cronoverse-language";
export const LANGUAGE_HEADER = "x-cronoverse-lang";
export const LANGUAGE_STORAGE_KEY = "cronoverse-language";

export const isLanguage = (value: unknown): value is Language => value === "en" || value === "es";

/** An explicit ?lang= wins, then the remembered cookie, then English. */
export function resolveLanguage(query: string | null | undefined, cookie: string | null | undefined): Language {
  if (isLanguage(query)) return query;
  if (isLanguage(cookie)) return cookie;
  return "en";
}

export function pageUrl(lang: Language) {
  return lang === "es" ? `${SITE_URL}/?lang=es` : `${SITE_URL}/`;
}

export const pageMeta = {
  en: {
    title: "Cronoverse | Web Development & Business Software in Southern California",
    description: "Custom websites, business software, and automation for Southern California businesses. Build better digital tools with Cronoverse.",
    locale: "en_US",
    ogAlt: "Cronoverse: better websites, smarter business. Illustrated California palm trees at sunset.",
  },
  es: {
    title: "Cronoverse | Desarrollo Web y Software Empresarial en California",
    description: "Creamos sitios web, software empresarial y automatizaciones a medida para negocios del sur de California. Conoce Cronoverse.",
    locale: "es_US",
    ogAlt: "Cronoverse: mejores sitios web, negocios más eficientes. Ilustración de palmeras californianas al atardecer.",
  },
} as const;

/** schema.org Organization data. Only facts the business has published: no address, phone, or reviews. */
export function organizationJsonLd(lang: Language) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Cronoverse",
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/cronoverse-mark-128.png`,
        image: `${SITE_URL}/cronoverse-og.jpg`,
        description: pageMeta[lang].description,
        areaServed: [
          { "@type": "AdministrativeArea", name: "Orange County, California" },
          { "@type": "Place", name: "Southern California" },
        ],
        knowsLanguage: ["en", "es"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: "Cronoverse",
        inLanguage: lang === "es" ? "es-US" : "en-US",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}
