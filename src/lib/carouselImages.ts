import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

const MAX_CAROUSEL_IMAGE_BYTES = 4 * 1024 * 1024;
const CAROUSEL_IMAGE_SIZE = {
  mobile: { width: 720, height: 420, label: "móvil" },
  desktop: { width: 1440, height: 420, label: "PC" },
} as const;

async function readImageSize(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("No se pudieron leer las dimensiones del PNG."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadCarouselPng(file: File, slideId: string, viewport: "mobile" | "desktop") {
  if (file.type !== "image/png") throw new Error("La imagen debe estar en formato PNG.");
  if (file.size > MAX_CAROUSEL_IMAGE_BYTES) throw new Error("El PNG no puede superar los 4 MB.");
  const expected = CAROUSEL_IMAGE_SIZE[viewport];
  const actual = await readImageSize(file);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`El PNG para ${expected.label} debe medir exactamente ${expected.width} × ${expected.height} px. El archivo elegido mide ${actual.width} × ${actual.height} px.`);
  }
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase no está configurado.");
  const safeId = slideId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const imageRef = ref(getStorage(app), `tiendaOnline/carousel/${safeId}-${viewport}.png`);
  await uploadBytes(imageRef, file, {
    contentType: "image/png",
    cacheControl: "public,max-age=86400",
  });
  return getDownloadURL(imageRef);
}

export async function deleteCarouselPng(imageUrl: string) {
  const app = getFirebaseApp();
  if (!app || !imageUrl) return;
  await deleteObject(ref(getStorage(app), imageUrl));
}
