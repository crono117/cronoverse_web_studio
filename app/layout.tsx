import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
