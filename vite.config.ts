import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/catalog-version": {
        target: "https://firebasestorage.googleapis.com",
        changeOrigin: true,
        rewrite: () => "/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fversion.json?alt=media",
      },
      "/api/catalog-products": {
        target: "https://firebasestorage.googleapis.com",
        changeOrigin: true,
        rewrite: () => "/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fproductos.json?alt=media",
      },
    },
  },
  preview: { port: 4173, strictPort: true },
});
