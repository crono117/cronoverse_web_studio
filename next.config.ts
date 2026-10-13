import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render the per-language title, description, canonical, and hreflang tags in <head> for
  // every visitor and crawler. By default they are streamed into <body> for user agents
  // outside a short bot list, where some crawlers and SEO checks do not read them.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
