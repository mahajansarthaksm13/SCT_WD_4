import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * Switzer — a Swiss grotesque with softer terminals and a taller x-height than
 * Helvetica. Chosen specifically to avoid Inter, which now signals "default"
 * more than it signals anything. Self-hosted; no Google Fonts CDN.
 */
const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Switzer-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Switzer-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

/**
 * Zodiak — a high-contrast didone, used only for the wordmark, view headings
 * and empty-state lines. Thick-to-thin strokes are the oldest visual signal
 * of engraved, expensive printing, and one weight is enough to carry it.
 */
const zodiak = localFont({
  src: [{ path: "./fonts/Zodiak-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-zodiak",
  display: "swap",
  fallback: ["Times New Roman", "serif"],
});

/**
 * Geist Mono — true tabular figures with an unambiguous 1/7/0. Every digit is
 * the same width, which is what lets the time gutter align into a spine.
 * next/font downloads this at build time and serves it from our own origin.
 */
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tally";

export const metadata: Metadata = {
  title: `${APP_NAME} — plan by time`,
  description:
    "A quiet to-do app for people who plan by time, not by list. Capture a task in seconds, give it a date and a time, and see what is due at a glance.",
  applicationName: APP_NAME,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The capture field is 16px precisely so iOS never needs to zoom. Letting
  // the user zoom anyway is an accessibility requirement, so no maximum-scale.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c7ddeb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a2540" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables belong on <html>, not <body>. Custom properties
    // inherit by *computed* value, so `--font-ui: var(--font-switzer), …`
    // declared at :root resolves to nothing if --font-switzer is only defined
    // further down the tree — and that empty value is what every descendant
    // then inherits.
    <html
      lang="en"
      className={`${switzer.variable} ${zodiak.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
