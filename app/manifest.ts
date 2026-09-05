import type { MetadataRoute } from "next";

/**
 * WEB APP MANIFEST — G, 2026-09-05: "I need aiASAP locked on mobile and on
 * iPad, locked in portrait mode ... when you turn your phone sideways, six
 * stays locked in portrait."
 *
 * A page in a browser tab cannot refuse the rotation - only the OS can, and it
 * only listens to an INSTALLED app. This manifest is that request: once a
 * visitor adds aiASAP to the home screen, the OS holds it portrait and drops
 * the browser bars. In an ordinary tab the site falls back to the upright 9:16
 * shell the PhonePortraitGuard already centres (see globals.css, "PHONE +
 * TABLET ORIENTATION LOCK"). Next serves this at /manifest.webmanifest and
 * links it from every page on its own.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "aiASAP",
    short_name: "aiASAP",
    description: "Gorgeous Brilliant Fast Cheap",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#241608",
    theme_color: "#241608",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
