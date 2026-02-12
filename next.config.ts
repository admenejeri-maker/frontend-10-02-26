import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Content Security Policy for Scoop AI Frontend (P1.6)
 *
 * - 'self' for scripts, styles, fonts, images
 * - 'unsafe-inline' for styles (Next.js injects inline styles)
 * - 'unsafe-eval' NOT included (secure by default)
 * - connect-src allows backend API (env-configured)
 * - fonts.googleapis.com / fonts.gstatic.com for Google Fonts fallback
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'} https://fonts.googleapis.com https://fonts.gstatic.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const ContentSecurityPolicy = cspDirectives.join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
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
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
