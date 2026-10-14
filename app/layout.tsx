import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { GoogleAnalytics } from "@/components/google-analytics";
import { captchaSiteKey } from "@/lib/inquiry-intake";
import { LANGUAGE_HEADER, SITE_URL, isLanguage } from "@/lib/site";
import "./globals.css";

// Page-specific title, description, canonical, and hreflang come from app/page.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Cronoverse",
  icons: {
    icon: [
      { url: "/brand/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon/favicon.ico", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/brand/favicon/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/brand/favicon/favicon.ico",
    apple: [{ url: "/brand/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/brand/favicon/site.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0d1628" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by proxy.ts from ?lang= or the remembered cookie; other routes default to English.
  const lang = (await headers()).get(LANGUAGE_HEADER);
  return (
    <html lang={isLanguage(lang) ? lang : "en"}>
      {/* Present only when the captcha is fully configured; the form reads it to render the widget. */}
      <body className="antialiased" data-turnstile-sitekey={captchaSiteKey(env)}>
        {children}
        <GoogleAnalytics id={env.GA4_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
