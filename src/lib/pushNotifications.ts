import type { User } from "firebase/auth";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebase";

const REGISTER_PUSH_URL = "https://us-central1-app-presu.cloudfunctions.net/registerTiendaPushDevice";

export function isInstalledPwa() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function enablePushNotifications(user: User) {
  if (!isInstalledPwa()) throw new Error("Instalá JOMA en este dispositivo antes de activar las notificaciones.");
  if (!(await isSupported()) || !("serviceWorker" in navigator) || !("Notification" in window)) {
    throw new Error("Este navegador no admite notificaciones push.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("El permiso de notificaciones no fue concedido.");
  return registerPushDevice(user);
}

async function registerPushDevice(user: User) {
  const app = getFirebaseApp();
  const vapidKey = String(import.meta.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "").trim();
  if (!app || !vapidKey) throw new Error("Las notificaciones todavía no están configuradas.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("No se pudo registrar este dispositivo.");
  const idToken = await user.getIdToken();
  const response = await fetch(REGISTER_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ token }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error || "No se pudo activar el dispositivo.");
  return token;
}

export async function syncPushNotificationRegistration(user: User) {
  if (!isInstalledPwa()) return false;
  if (!(await isSupported()) || !('serviceWorker' in navigator) || !('Notification' in window)) return false;
  if (Notification.permission !== "granted") return false;
  await registerPushDevice(user);
  return true;
}
