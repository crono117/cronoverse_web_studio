import type { Metadata } from "next";
import { headers } from "next/headers";
import { Home } from "@/components/home";
import { LANGUAGE_HEADER, isLanguage, organizationJsonLd, pageMeta, pageUrl, type Language } from "@/lib/site";

async function requestLanguage(): Promise<Language> {
  const lang = (await headers()).get(LANGUAGE_HEADER);
  return isLanguage(lang) ? lang : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLanguage();
  const meta = pageMeta[lang];
  const image = { url: "/cronoverse-og.jpg", width: 1200, height: 630, alt: meta.ogAlt };
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: pageUrl(lang),
      languages: { en: pageUrl("en"), es: pageUrl("es"), "x-default": pageUrl("en") },
    },
    openGraph: {
      type: "website",
      siteName: "Cronoverse",
      url: pageUrl(lang),
      title: meta.title,
      description: meta.description,
      locale: meta.locale,
      alternateLocale: lang === "es" ? pageMeta.en.locale : pageMeta.es.locale,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: [image] },
    robots: { index: true, follow: true },
  };
}

export default async function Page() {
  const lang = await requestLanguage();
  return <>
    {/* JSON.stringify output contains no "</script>": every value is a fixed string from lib/site.ts. */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(lang)) }}/>
    <Home initialLang={lang}/>
  </>;
}
