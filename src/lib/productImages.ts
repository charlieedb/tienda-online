import { getDownloadURL, getStorage, ref } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

const memory = new Map<string, string>();
const imageSessionVersion = Date.now();

function withImageVersion(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${imageSessionVersion}`;
}

function variants(code: string) {
  const raw = code.trim();
  const underscored = raw.replaceAll("/", "_");
  return [...new Set([raw, underscored, raw.toUpperCase(), underscored.toUpperCase(), raw.toLowerCase(), underscored.toLowerCase()])].filter(Boolean);
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
  for (const folder of ["fotosProductosThumb", "fotosProductos"]) {
    for (const name of names) {
      try {
        const url = withImageVersion(await getDownloadURL(ref(storage, `${folder}/${name}.jpg`)));
        memory.set(key, url);
        return url;
      } catch { /* probar siguiente variante */ }
    }
  }
  memory.set(key, "");
  return "";
}
