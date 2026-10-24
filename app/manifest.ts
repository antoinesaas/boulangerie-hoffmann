import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Boulangerie Hoffmann",
    short_name: "Hoffmann",
    description: "Commandes des boutiques et du fornil",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#3b2a1a",
    theme_color: "#3b2a1a",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
