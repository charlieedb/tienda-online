type AnalyticsParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function initAnalytics() {
  const containerId = String(import.meta.env.VITE_GTM_ID ?? "").trim();
  if (!/^GTM-[A-Z0-9]+$/i.test(containerId)) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(script);
}

export function trackEvent(event: string, params: AnalyticsParams = {}) {
  window.dataLayer?.push({ event, ...params });
}
