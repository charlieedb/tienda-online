export type ConsentPreferences = { analytics: boolean; advertising: boolean; decidedAt: string };
export type AnalyticsItem = { item_id: string; item_name: string; item_brand?: string; item_category?: string; item_variant?: string; price?: number; quantity?: number; discount?: number; promotion_id?: string; promotion_name?: string; creative_name?: string; creative_slot?: string };
export type PromotionContext = { campaignId: string; campaignName: string; advertiser: string; creativeName: string; creativeSlot: string; itemId?: string; itemName?: string };
export type CampaignAttribution = PromotionContext & { attributionType: "click" | "impression"; attributedAt: string };
type AnalyticsParams = Record<string, unknown>;

declare global { interface Window { dataLayer?: unknown[] } }

const CONSENT_KEY = "joma.analyticsConsent.v1";
const ATTRIBUTION_KEY = "joma.campaignAttribution.v1";
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const sentKeys = new Set<string>();
let gtmLoaded = false;

function pushGtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

export function getConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null") as Partial<ConsentPreferences> | null;
    if (!value || typeof value.analytics !== "boolean" || typeof value.advertising !== "boolean") return null;
    return { analytics: value.analytics, advertising: value.advertising, decidedAt: String(value.decidedAt || "") };
  } catch { return null; }
}

function applyConsent(preferences: ConsentPreferences | null, mode: "default" | "update") {
  const analytics = preferences?.analytics === true ? "granted" : "denied";
  const advertising = preferences?.advertising === true ? "granted" : "denied";
  pushGtag("consent", mode, { analytics_storage: analytics, ad_storage: advertising, ad_user_data: advertising, ad_personalization: advertising, functionality_storage: "granted", security_storage: "granted", ...(mode === "default" ? { wait_for_update: 500 } : {}) });
}

export function initAnalytics() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  applyConsent(getConsentPreferences(), "default");
  const containerId = String(import.meta.env.VITE_GTM_ID ?? "").trim();
  if (gtmLoaded || !/^GTM-[A-Z0-9]+$/i.test(containerId)) return;
  const existingScript = document.querySelector<HTMLScriptElement>(`script[data-joma-gtm="${containerId}"],script[src*="googletagmanager.com/gtm.js?id=${containerId}"]`);
  if (existingScript) { gtmLoaded = true; return; }
  gtmLoaded = true;
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  script.dataset.jomaGtm = containerId;
  document.head.appendChild(script);
}

export function saveConsentPreferences(values: Pick<ConsentPreferences, "analytics" | "advertising">) {
  const preferences: ConsentPreferences = { ...values, decidedAt: new Date().toISOString() };
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(preferences)); } catch { /* current page still updates */ }
  applyConsent(preferences, "update");
  if (!preferences.advertising) window.localStorage.removeItem(ATTRIBUTION_KEY);
  window.dispatchEvent(new CustomEvent("joma:consent-updated", { detail: preferences }));
  return preferences;
}

export function trackEvent(event: string, params: AnalyticsParams = {}, options: { advertising?: boolean; dedupeKey?: string } = {}) {
  const consent = getConsentPreferences();
  if (!consent?.analytics || (options.advertising && !consent.advertising)) return false;
  if (options.dedupeKey) {
    const key = `${event}:${options.dedupeKey}`;
    if (sentKeys.has(key)) return false;
    sentKeys.add(key);
  }
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
  return true;
}

export function trackPageView(pagePath: string, pageTitle = document.title) {
  return trackEvent("page_view", { page_path: pagePath, page_location: window.location.href, page_title: pageTitle }, { dedupeKey: pagePath });
}

export function trackEcommerce(event: string, params: AnalyticsParams, dedupeKey?: string) {
  window.dataLayer?.push({ ecommerce: null });
  return trackEvent(event, { ecommerce: { currency: "ARS", ...params } }, { dedupeKey });
}

function promotionItems(context: PromotionContext): AnalyticsItem[] {
  return [{ item_id: context.itemId || context.campaignId, item_name: context.itemName || context.campaignName, item_brand: context.advertiser, promotion_id: context.campaignId, promotion_name: context.campaignName, creative_name: context.creativeName, creative_slot: context.creativeSlot }];
}

function rememberAttribution(context: PromotionContext, attributionType: CampaignAttribution["attributionType"]) {
  const attribution: CampaignAttribution = { ...context, attributionType, attributedAt: new Date().toISOString() };
  try {
    const current = getCampaignAttribution();
    if (current?.attributionType === "click" && attributionType === "impression") return;
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch { /* best effort */ }
}

export function trackPromotionView(context: PromotionContext) {
  window.dataLayer?.push({ ecommerce: null });
  const sent = trackEvent("view_promotion", { ecommerce: { campaign_id: context.campaignId, campaign_name: context.campaignName, advertiser: context.advertiser, creative_slot: context.creativeSlot, items: promotionItems(context) } }, { advertising: true, dedupeKey: `${context.campaignId}:${context.creativeSlot}:${context.itemId || context.creativeName}` });
  if (sent) rememberAttribution(context, "impression");
}

export function trackPromotionClick(context: PromotionContext) {
  window.dataLayer?.push({ ecommerce: null });
  const sent = trackEvent("select_promotion", { ecommerce: { campaign_id: context.campaignId, campaign_name: context.campaignName, advertiser: context.advertiser, creative_slot: context.creativeSlot, items: promotionItems(context) } }, { advertising: true });
  if (sent) rememberAttribution(context, "click");
}

export function getCampaignAttribution(): CampaignAttribution | null {
  if (typeof window === "undefined" || !getConsentPreferences()?.advertising) return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || "null") as CampaignAttribution | null;
    if (!value?.campaignId || !value.attributedAt) return null;
    if (Date.now() - new Date(value.attributedAt).getTime() > ATTRIBUTION_WINDOW_MS) { window.localStorage.removeItem(ATTRIBUTION_KEY); return null; }
    return value;
  } catch { return null; }
}
