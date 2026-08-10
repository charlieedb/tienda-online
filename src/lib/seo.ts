export const SITE_URL = "https://jomagroup.com.ar";

export const BUSINESS = {
  name: "Joma Group",
  onlineServiceName: "Joma Express",
  description: "Mayorista y tienda online de alimentos, bebidas, limpieza y productos de consumo diario en Corrientes Capital.",
  city: "Corrientes",
  region: "Corrientes",
  country: "AR",
  postalCode: "W3400",
  streetAddress: "Av. Maipú 7249",
  telephone: "+54 379 439-0919",
  jonicoName: "Jónico Supermercado Mayorista y Minorista",
} as const;

export function slugify(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function productPath(product: { id: string; name: string }) {
  return `/productos/${slugify(product.name)}--${slugify(product.id)}`;
}

export function productIdFromPath(path: string) {
  const segment = decodeURIComponent(path.split("/").filter(Boolean).at(-1) || "");
  const marker = segment.lastIndexOf("--");
  return marker >= 0 ? segment.slice(marker + 2) : segment;
}

export function navigateInStore(path: string) {
  const currentPath = `${window.location.pathname}${window.location.search}`;
  window.history.pushState(
    { ...window.history.state, jomaNavigation: true, jomaFrom: currentPath },
    "",
    path,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function setDocumentMetadata(title: string, description: string, canonicalPath: string, noindex = false) {
  document.title = title;
  const canonical = `${SITE_URL}${canonicalPath}`;
  const setMeta = (selector: string, attributes: Record<string, string>) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) { element = document.createElement("meta"); document.head.appendChild(element); }
    Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value));
  };
  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="robots"]', { name: "robots", content: noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large" });
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = canonical;
}
