import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.CLUB_NAME || "Kegelclub",
    short_name: "Kegelclub",
    lang: "de",
    start_url: "/",
    display: "standalone",
    background_color: "#1d1510",
    theme_color: "#1d1510",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
