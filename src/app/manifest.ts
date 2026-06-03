import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Listita de Súper",
    short_name: "Listita",
    description: "Armá tu listita y agregá al carrito",
    start_url: "/",
    display: "standalone",
    background_color: "#E6E3E2",
    theme_color: "#E10600",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
