import type { MetadataRoute } from "next";

// Web app manifest. Names the brand mark for install/manifest use and
// carries the near-black theme so an installed shell matches the app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Super Sub",
    short_name: "Super Sub",
    description:
      "Choose the minute you enter a real live match, and get scored on what actually happens next.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      { src: "/mark-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
