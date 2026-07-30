import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOMA Express",
    short_name: "JOMA",
    description: "Catálogo móvil para armar tu compra por unidad o por caja.",
    start_url: "/",
    display: "standalone",
    background_color: "#c81b16",
    theme_color: "#c81b16",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
