import type { MetadataRoute } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Tally";

/**
 * What the browser needs before it will offer to install Tally to a home
 * screen. `standalone` drops the address bar, which is the whole point: an app
 * whose data never leaves the device should not look like a web page you are
 * visiting.
 *
 * One SVG icon covers every size. Raster sets exist to avoid scaling artefacts
 * on platforms that do not resample well, and a nine-shape ledger mark is not
 * where that shows.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — plan by time`,
    short_name: APP_NAME,
    description:
      "A quiet to-do app for people who plan by time, not by list. Capture a task in seconds, give it a date and a time, and see what is due at a glance.",
    start_url: "/",
    display: "standalone",
    // Navy, matching the default ground. The splash screen the platform
    // paints from this is the first frame of the app, and a pale one before a
    // navy shell is a flash of white in the user's face.
    background_color: "#0a2540",
    theme_color: "#0a2540",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
