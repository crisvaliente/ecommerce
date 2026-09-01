import type { NextConfig } from "next";
import { parseAppBaseUrl } from "./src/config/instance";

const appBaseUrl = parseAppBaseUrl(process.env.APP_BASE_URL);
const appUsesHttps = new URL(appBaseUrl).protocol === "https:";
const supabaseLocalConnectOrigin = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || appUsesHttps) return null;

  try {
    const url = new URL(supabaseUrl);
    return url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
})();
const connectSources = ["'self'", "https:", "wss:", supabaseLocalConnectOrigin]
  .filter((source): source is string => Boolean(source))
  .join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https: data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  `connect-src ${connectSources}`,
  "frame-src 'self' https://www.mercadopago.com https://*.mercadopago.com",
  ...(appUsesHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  env: {
    APP_BASE_URL: appBaseUrl,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
