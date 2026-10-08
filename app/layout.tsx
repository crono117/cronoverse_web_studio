import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { GoogleAnalytics } from "@/components/google-analytics";
import { captchaSiteKey } from "@/lib/inquiry-intake";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cronoverse | Web Design & Development in Southern California",
  description: "Custom websites, redesigns, and web applications for Southern California businesses. Serving Orange County, Los Angeles, San Diego, and the Inland Empire. English y español.",
  icons: {
    icon: "/cronoverse-saturn-eye-navy.png",
    shortcut: "/cronoverse-saturn-eye-navy.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Present only when the captcha is fully configured; the form reads it to render the widget. */}
      <body className="antialiased" data-turnstile-sitekey={captchaSiteKey(env)}>
        {children}
        <GoogleAnalytics id={env.GA4_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
