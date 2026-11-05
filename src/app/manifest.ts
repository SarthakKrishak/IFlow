import type { MetadataRoute } from "next";

/** Installable web app: standalone window, opens on Overview. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IFlow by Imaginum",
    short_name: "IFlow",
    description: "Boards, page tracker, meetings and wiki for the Imaginum team.",
    start_url: "/overview",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101012",
    theme_color: "#101012",
    icons: [
      { src: "/logo-large.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "any", type: "image/png" },
    ],
  };
}
