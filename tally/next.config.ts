import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * TODO_APP_SECURITY.md §3.3 / TODO_APP_FRONTEND_SPEC.md §8.2.
 *
 * Tally has no backend and makes no runtime third-party calls, so the policy
 * can be close to the strictest useful form: everything comes from our own
 * origin and nothing else.
 *
 * Two deliberate relaxations, both required by the framework rather than by us:
 *   • `'unsafe-inline'` on script-src — the App Router streams its payload
 *     through inline <script> tags. Avoiding it needs per-request nonces, which
 *     force every page to render dynamically and cost the static-CDN delivery
 *     the performance budget depends on. Our own inline scripts stay at zero
 *     (see public/theme.js), and `react/no-danger` is a lint error, so the XSS
 *     path this would otherwise open is closed at the source instead.
 *   • `'unsafe-eval'` in development only — React uses eval to reconstruct
 *     error stacks. It is never sent in production.
 */
/**
 * `upgrade-insecure-requests` rewrites every http:// request to https://.
 *
 * That is what we want in production and actively wrong over plain HTTP.
 * Chromium quietly exempts localhost; WebKit does not — it upgrades the
 * script URLs, the TLS handshake fails against a plain HTTP server, and the
 * page loads its shell and then nothing at all. The end-to-end suite found
 * this on Safari, which is precisely the browser it would have shipped to.
 */
const upgradeInsecure = process.env.TALLY_ALLOW_INSECURE !== "1";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(upgradeInsecure ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
