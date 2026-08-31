const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const { createVerify } = require("node:crypto");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certificateCache = { expiresAt: 0, values: {} };

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin no está configurado.");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function requireAdmin(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Falta autenticación."), { status: 401 });
  const app = getAdminApp();
  const decoded = await verifyFirebaseIdToken(match[1]);
  const profile = await getFirestore(app).doc(`adminUsers/${decoded.uid}`).get();
  if (!profile.exists || profile.data()?.active !== true) throw Object.assign(new Error("Acceso denegado."), { status: 403 });
  return decoded.uid;
}

function decodeJwtPart(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64").toString("utf8"));
}

async function getFirebaseCertificates() {
  if (certificateCache.expiresAt > Date.now()) return certificateCache.values;
  const response = await fetch(FIREBASE_CERTS_URL, { cache: "no-store" });
  if (!response.ok) throw Object.assign(new Error("No se pudieron validar las credenciales."), { status: 503 });
  const values = await response.json();
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, values };
  return values;
}

async function verifyFirebaseIdToken(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw Object.assign(new Error("Token inválido."), { status: 401 });
  let header;
  let payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    throw Object.assign(new Error("Token inválido."), { status: 401 });
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || typeof payload.sub !== "string" || !payload.sub || typeof payload.exp !== "number" || typeof payload.iat !== "number" || payload.exp <= now || payload.iat > now) {
    throw Object.assign(new Error("Token inválido o vencido."), { status: 401 });
  }
  const certificates = await getFirebaseCertificates();
  const certificate = certificates[header.kid];
  if (!certificate) throw Object.assign(new Error("Token inválido."), { status: 401 });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const signature = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (!verifier.verify(certificate, signature)) throw Object.assign(new Error("Token inválido."), { status: 401 });
  return { ...payload, uid: payload.sub };
}

function dateValue(value, fallback) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function number(cell) { return Number(cell?.value || 0); }
function dimension(row, index) { return String(row.dimensionValues?.[index]?.value || ""); }

async function fetchAnalytics(startDate, endDate) {
  const propertyId = String(process.env.GA4_PROPERTY_ID || "").replace(/^properties\//, "");
  const clientEmail = process.env.GA4_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = String(process.env.GA4_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!propertyId || !clientEmail || !privateKey) throw Object.assign(new Error("Google Analytics Data API no está configurada."), { status: 503 });
  const client = new BetaAnalyticsDataClient({ credentials: { client_email: clientEmail, private_key: privateKey } });
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate, endDate }];
  const [[overview], [events], [campaigns]] = await Promise.all([
    client.runReport({ property, dateRanges, metrics: ["activeUsers", "sessions", "screenPageViews", "newUsers", "engagedSessions", "purchaseRevenue"].map((name) => ({ name })) }),
    client.runReport({ property, dateRanges, dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }] }),
    client.runReport({
      property,
      dateRanges,
      dimensions: [
        { name: "itemPromotionId" },
        { name: "itemPromotionName" },
        { name: "itemPromotionCreativeName" },
        { name: "itemPromotionCreativeSlot" },
        { name: "itemId" },
        { name: "itemName" },
        { name: "itemBrand" },
      ],
      metrics: ["itemsViewedInPromotion", "itemsClickedInPromotion", "itemsPurchased", "itemRevenue"].map((name) => ({ name })),
    }),
  ]);
  const metricValues = overview.rows?.[0]?.metricValues || [];
  const eventCounts = Object.fromEntries((events.rows || []).map((row) => [dimension(row, 0), number(row.metricValues?.[0])]));
  const promotionMap = new Map();
  for (const row of campaigns.rows || []) {
    const campaignId = dimension(row, 0);
    if (!campaignId || campaignId === "(not set)") continue;
    const creativeName = dimension(row, 2);
    const creativeSlot = dimension(row, 3);
    const itemId = dimension(row, 4);
    const itemName = dimension(row, 5);
    const key = [campaignId, creativeSlot, creativeName || itemId].join(":");
    const current = promotionMap.get(key) || {
      key,
      campaignId,
      campaignName: dimension(row, 1),
      creativeName: creativeName === "(not set)" ? "" : creativeName,
      creativeSlot: creativeSlot === "(not set)" ? "" : creativeSlot,
      itemId: itemId === "(not set)" ? "" : itemId,
      itemName: itemName === "(not set)" ? "" : itemName,
      advertiser: dimension(row, 6),
      type: creativeSlot.startsWith("hero-carousel-") ? "banner" : "product",
      impressions: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
    };
    const rowImpressions = number(row.metricValues?.[0]);
    const rowClicks = number(row.metricValues?.[1]);
    if ((rowImpressions || rowClicks) && itemId && itemId !== "(not set)") {
      current.itemId = itemId;
      current.itemName = itemName === "(not set)" ? current.itemName : itemName;
    }
    current.impressions += rowImpressions;
    current.clicks += rowClicks;
    current.purchases += number(row.metricValues?.[2]);
    current.revenue += number(row.metricValues?.[3]);
    promotionMap.set(key, current);
  }
  const promotionsResult = Array.from(promotionMap.values()).map((item) => ({ ...item, ctr: item.impressions ? item.clicks / item.impressions : 0, conversion: item.clicks ? item.purchases / item.clicks : 0 })).sort((a, b) => b.impressions - a.impressions);
  const users = number(metricValues[0]);
  const purchases = Number(eventCounts.purchase || 0);
  const revenue = number(metricValues[5]);
  return {
    range: { startDate, endDate },
    updatedAt: new Date().toISOString(),
    overview: { users, sessions: number(metricValues[1]), views: number(metricValues[2]), newUsers: number(metricValues[3]), engagedSessions: number(metricValues[4]), addToCarts: Number(eventCounts.add_to_cart || 0), checkouts: Number(eventCounts.begin_checkout || 0), purchases, revenue, conversion: users ? purchases / users : 0, averageOrderValue: purchases ? revenue / purchases : 0 },
    promotions: promotionsResult,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido." });
  try {
    await requireAdmin(req);
    const today = new Date().toISOString().slice(0, 10);
    const defaultStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const startDate = dateValue(req.query.start, defaultStart);
    const endDate = dateValue(req.query.end, today);
    if (startDate > endDate) return res.status(400).json({ error: "El rango de fechas no es válido." });
    const key = `${startDate}:${endDate}`;
    const stored = cache.get(key);
    if (stored && Date.now() - stored.at < CACHE_MS) return res.status(200).json({ ...stored.data, cached: true });
    const data = await fetchAnalytics(startDate, endDate);
    cache.set(key, { at: Date.now(), data });
    return res.status(200).json({ ...data, cached: false });
  } catch (error) {
    const status = Number(error?.status) || (error?.code?.startsWith?.("auth/") ? 401 : 500);
    return res.status(status).json({ error: error instanceof Error ? error.message : "No se pudieron consultar las métricas." });
  }
};
