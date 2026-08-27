import { getDownloadURL, getStorage, ref } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

const memory = new Map<string, string>();
const preloadMemory = new Map<string, Promise<string>>();

function variants(code: string) {
  const raw = code.trim();
  const underscored = raw.replaceAll("/", "_");
  return [...new Set([raw, underscored, raw.toUpperCase(), underscored.toUpperCase(), raw.toLowerCase(), underscored.toLowerCase()])].filter(Boolean);
}

function publicStorageUrl(folder: string, filename: string) {
  const bucket = String(import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim();
  if (!bucket || !filename) return "";
  const objectPath = encodeURIComponent(`${folder}/${filename}`);
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${objectPath}?alt=media`;
}

export function getProductThumbnailUrl(code: string) {
  const filename = code.trim().replaceAll("/", "_");
  return filename ? publicStorageUrl("fotosProductosThumb", `${filename}.jpg`) : "";
}

export function getProductOriginalUrl(code: string) {
  const filename = code.trim().replaceAll("/", "_");
  return filename ? publicStorageUrl("fotosProductos", `${filename}.jpg`) : "";
}

export function isProductThumbnailUrl(url: string) {
  return /fotosProductosThumb(?:%2F|\/)/i.test(url);
}

export function preloadImage(url: string, priority: "high" | "low" = "high") {
  if (!url || typeof window === "undefined") return Promise.resolve("");
  const existing = preloadMemory.get(url);
  if (existing) return existing;
  const request = new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.onload = async () => {
      try { await image.decode(); } catch { /* onload ya confirmó una imagen utilizable */ }
      resolve(url);
    };
    image.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    image.src = url;
  }).catch((error) => {
    preloadMemory.delete(url);
    throw error;
  });
  preloadMemory.set(url, request);
  return request;
}

export async function getProductImageUrl(code: string) {
  const key = code.trim().toUpperCase();
  if (!key) return "";
  if (/^P/.test(key)) return "";
  if (memory.has(key)) return memory.get(key) ?? "";

  const app = getFirebaseApp();
  if (!app) return "";
  const storage = getStorage(app);
  const names = variants(code);
  // La foto principal es la fuente de verdad. No usar primero la miniatura:
  // puede pertenecer a una versión anterior del mismo producto.
  for (const folder of ["fotosProductos"]) {
    for (const name of names) {
      try {
        const url = await getDownloadURL(ref(storage, `${folder}/${name}.jpg`));
        memory.set(key, url);
        return url;
      } catch { /* probar siguiente variante */ }
    }
  }
  memory.set(key, "");
  return "";
}
