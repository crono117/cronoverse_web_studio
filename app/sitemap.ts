import type { MetadataRoute } from "next";
import { pageUrl } from "@/lib/site";

const languages = { en: pageUrl("en"), es: pageUrl("es"), "x-default": pageUrl("en") };

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: pageUrl("en"), changeFrequency: "monthly", priority: 1, alternates: { languages } },
    { url: pageUrl("es"), changeFrequency: "monthly", priority: 1, alternates: { languages } },
  ];
}
