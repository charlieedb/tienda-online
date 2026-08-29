const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const admin = require("firebase-admin");

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin no está configurado.");
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function requireAdmin(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Falta autenticación."), { status: 401 });
  const app = getAdminApp();
  const decoded = await app.auth().verifyIdToken(match[1]);
  const profile = await app.firestore().doc(`adminUsers/${decoded.uid}`).get();
  if (!profile.exists || profile.data()?.active !== true) throw Object.assign(new Error("Acceso denegado."), { status: 403 });
  return decoded.uid;
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
    client.runReport({ property, dateRanges, dimensions: [{ name: "itemPromotionId" }, { name: "eventName" }, { name: "itemPromotionName" }, { name: "itemBrand" }], metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }] }),
  ]);
  const metricValues = overview.rows?.[0]?.metricValues || [];
  const eventCounts = Object.fromEntries((events.rows || []).map((row) => [dimension(row, 0), number(row.metricValues?.[0])]));
  const campaignMap = new Map();
  for (const row of campaigns.rows || []) {
    const id = dimension(row, 0);
    if (!id || id === "(not set)") continue;
    const current = campaignMap.get(id) || { id, name: dimension(row, 2), advertiser: dimension(row, 3), impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    const event = dimension(row, 1);
    const count = number(row.metricValues?.[0]);
    if (event === "view_promotion") current.impressions += count;
    if (event === "select_promotion") current.clicks += count;
    if (event === "purchase") { current.purchases += count; current.revenue += number(row.metricValues?.[1]); }
    campaignMap.set(id, current);
  }
  const campaignsResult = Array.from(campaignMap.values()).map((item) => ({ ...item, ctr: item.impressions ? item.clicks / item.impressions : 0, conversion: item.clicks ? item.purchases / item.clicks : 0 })).sort((a, b) => b.impressions - a.impressions);
  const users = number(metricValues[0]);
  const purchases = Number(eventCounts.purchase || 0);
  const revenue = number(metricValues[5]);
  return {
    range: { startDate, endDate },
    updatedAt: new Date().toISOString(),
    overview: { users, sessions: number(metricValues[1]), views: number(metricValues[2]), newUsers: number(metricValues[3]), engagedSessions: number(metricValues[4]), addToCarts: Number(eventCounts.add_to_cart || 0), checkouts: Number(eventCounts.begin_checkout || 0), purchases, revenue, conversion: users ? purchases / users : 0, averageOrderValue: purchases ? revenue / purchases : 0 },
    campaigns: campaignsResult,
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
