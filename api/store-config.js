const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const CACHE_MS = 60 * 1000;
let cached = null;

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin no está configurado.");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido." });
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json(cached.data);
    }
    const snapshot = await getFirestore(getAdminApp()).doc("config/tiendaOnlineStore").get();
    const source = snapshot.exists ? snapshot.data() || {} : {};
    const data = {
      configured: snapshot.exists,
      featuredProductIds: source.featuredProductIds || [],
      carouselSlides: source.carouselSlides || [],
      deliverySchedule: source.deliverySchedule || {},
      checkoutSettings: source.checkoutSettings || {},
      sponsoredProducts: source.sponsoredProducts || [],
    };
    cached = { at: Date.now(), data };
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "No se pudo cargar la configuración." });
  }
};
