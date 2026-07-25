import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

const MAX_CAROUSEL_IMAGE_BYTES = 4 * 1024 * 1024;

export async function uploadCarouselPng(file: File, slideId: string, viewport: "mobile" | "desktop") {
  if (file.type !== "image/png") throw new Error("La imagen debe estar en formato PNG.");
  if (file.size > MAX_CAROUSEL_IMAGE_BYTES) throw new Error("El PNG no puede superar los 4 MB.");
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase no está configurado.");
  const safeId = slideId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const imageRef = ref(getStorage(app), `tiendaOnline/carousel/${safeId}-${viewport}.png`);
  await uploadBytes(imageRef, file, {
    contentType: "image/png",
    cacheControl: "public,max-age=300",
  });
  return getDownloadURL(imageRef);
}

export async function deleteCarouselPng(imageUrl: string) {
  const app = getFirebaseApp();
  if (!app || !imageUrl) return;
  await deleteObject(ref(getStorage(app), imageUrl));
}
