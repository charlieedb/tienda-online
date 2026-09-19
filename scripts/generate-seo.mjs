import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const siteUrl = "https://www.jomagroup.com.ar";
const catalogUrl = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fproductos.json?alt=media";
const storageObjectsUrl = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o";
const baseHtml = await readFile(path.join(dist, "index.html"), "utf8");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const text = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalize = (value) => text(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-categoria";
const bool = (value) => value === true || ["1", "true", "si", "sí"].includes(text(value).toLowerCase());
const productPath = (product) => `/productos/${slugify(product.name)}--${slugify(product.id)}`;
const legacyProductPath = (product) => `/productos/${slugify(product.name)}`;
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
let storageImages = new Map();

async function listStorageImages(prefix) {
  let pageToken = "";
  const images = new Map();
  do {
    const url = new URL(storageObjectsUrl);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("maxResults", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    for (const item of data.items ?? []) {
      const filename = text(item.name).split("/").at(-1) || "";
      const code = filename.replace(/\.jpg$/i, "").toLowerCase();
      if (code) images.set(code, `${storageObjectsUrl}/${encodeURIComponent(item.name)}?alt=media`);
    }
    pageToken = text(data.nextPageToken);
  } while (pageToken);
  return images;
}

function normalizeProduct(raw, index) {
  const id = text(raw["Código"] ?? raw.Codigo ?? raw.codigo) || `producto-${index}`;
  const name = text(raw.Nombre ?? raw.nombre) || "Producto sin nombre";
  const category = text(raw.Linea ?? raw.linea ?? raw.Categoria ?? raw.categoria) || "Sin categoría";
  const stockValue = raw.stockReal;
  const stockReal = stockValue === null || stockValue === undefined || stockValue === "" ? undefined : Number(stockValue);
  const packQty = Math.max(1, Math.trunc(number(raw.Presentacion ?? raw.presentacion) || 1));
  const listPrice = number(raw.Precio ?? raw.precio ?? raw.PrecioMostrador);
  const discount = number(raw.descOferta ?? raw.descuentoPct ?? raw.descuento);
  const onlineManual = typeof raw.publicarOnlineManual === "boolean" ? raw.publicarOnlineManual : null;
  // `publicarOnline` puede apagarse automáticamente por falta de stock. Eso no
  // debe borrar la ficha de Google; sólo una exclusión manual la quita del SEO.
  const publishable = !/^R/i.test(id) && onlineManual !== false;
  return {
    id, name, category, categoryId: slugify(category), packQty,
    brand: text(raw.Marca ?? raw.marca ?? raw.Brand ?? raw.brand),
    gtin: text(raw.codigoBarra ?? raw.ean ?? raw.EAN),
    publishable,
    active: publishable && (Number.isFinite(stockReal) ? stockReal > 0 : !bool(raw.sinStock ?? raw.SinStock)),
    price: discount > 0 ? Math.round(listPrice * (1 - discount / 100) * 100) / 100 : listPrice,
    image: text(raw.imgUrl ?? raw.ImgUrl ?? raw.imagenThumbURL ?? raw.imagenURL ?? raw.foto)
      || storageImages.get(id.replaceAll("/", "_").toLowerCase())
      || "",
    offer: bool(raw.oferta ?? raw.Oferta ?? raw.Promo ?? raw.promo) || discount > 0,
  };
}

function withHead(html, { title, description, canonical, type = "website", image = `${siteUrl}/icon-512.png`, jsonLd }) {
  const url = `${siteUrl}${canonical}`;
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`)
    .replace(/<meta property="og:type"[^>]*>/i, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${escapeHtml(url)}" />`)
    .replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
  if (jsonLd) output = output.replace("</head>", `<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>\n</head>`);
  return output;
}

function withBody(html, content) {
const bootLogo = '<span class="boot-logo" role="status" aria-label="Cargando Joma Group"><img src="/joma-express-black.png" alt="Joma Group" width="800" height="329" /></span>';
  return html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${bootLogo}${content}</div>`);
}

async function writeRoute(route, html) {
  const segments = route.split("/").filter(Boolean);
  const folder = path.join(dist, ...segments);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "index.html"), html, "utf8");
  const cleanUrlFile = path.join(dist, ...segments.slice(0, -1), `${segments.at(-1)}.html`);
  await mkdir(path.dirname(cleanUrlFile), { recursive: true });
  await writeFile(cleanUrlFile, html, "utf8");
}

const staticRoutes = [
  ["/categorias", "Productos por categoría | Joma Group", "Explorá el catálogo mayorista y minorista de Joma Group en Corrientes Capital.", "Productos por categoría"],
  ["/ofertas", "Ofertas en Corrientes | Joma Group", "Consultá ofertas vigentes en Joma Group, Corrientes Capital.", "Ofertas vigentes"],
  ["/envios-corrientes", "Envíos en Corrientes Capital | Joma Group", "Comprá online con entrega programada en Corrientes Capital.", "Envíos en Corrientes Capital"],
  ["/locales", "Locales de Joma Group y Jónico en Corrientes", "Información de Joma Group y Jónico en Corrientes Capital.", "Nuestros locales en Corrientes"],
  ["/jonico", "Jónico Supermercado Mayorista y Minorista | Corrientes", "Conocé Jónico, supermercado mayorista y minorista vinculado a Joma Group.", "Jónico Supermercado Mayorista y Minorista"],
  ["/nosotros", "Sobre Joma Group | Corrientes", "Conocé Joma Group, distribuidora, mayorista y tienda online de Corrientes Capital.", "Sobre Joma Group"],
  ["/contacto", "Contacto | Joma Group Corrientes", "Contactá a Joma Group por consultas sobre productos, compras y entregas.", "Contacto"],
  ["/privacidad", "Política de privacidad | Joma Group", "Tratamiento de datos personales en la tienda online de Joma Group.", "Política de privacidad"],
  ["/cambios", "Cambios y devoluciones | Joma Group", "Condiciones generales para cambios e inconvenientes con una compra.", "Cambios y devoluciones"],
  ["/condiciones", "Términos y condiciones | Joma Group", "Condiciones de uso y compra de la tienda online de Joma Group.", "Términos y condiciones"],
];

const sitemapRoutes = ["/"];
const productWriteQueue = [];
for (const [route, title, description, heading] of staticRoutes) {
  const body = `<main><nav aria-label="Migas de pan"><a href="/">Inicio</a> / ${escapeHtml(heading)}</nav><article><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></article></main>`;
  await writeRoute(route, withBody(withHead(baseHtml, { title, description, canonical: route }), body));
  sitemapRoutes.push(route);
}

let products = [];
try {
  const [thumbnails, originals] = await Promise.all([
    listStorageImages("fotosProductosThumb/"),
    listStorageImages("fotosProductos/"),
  ]);
  storageImages = new Map([...originals, ...thumbnails]);
  const response = await fetch(catalogUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  products = (Array.isArray(data) ? data : data.items ?? []).map(normalizeProduct).filter((product) => product.publishable);
} catch (error) {
  console.warn(`SEO: no se pudo prerenderizar el catálogo (${error instanceof Error ? error.message : error}).`);
}

const categoryMap = new Map();
for (const product of products.filter((item) => item.active)) {
  const list = categoryMap.get(product.categoryId) ?? [];
  list.push(product);
  categoryMap.set(product.categoryId, list);
}

for (const [categoryId, items] of categoryMap) {
  const category = items[0].category;
  const route = `/categorias/${categoryId}`;
  const title = `${category} en Corrientes | Joma Group`;
  const description = `Comprá productos de ${category} en Joma Group con entrega en Corrientes Capital.`;
  const list = items.map((item) => `<li><a href="${escapeHtml(productPath(item))}">${escapeHtml(item.name)}</a> desde ${escapeHtml(money.format(item.price))}</li>`).join("");
  const body = `<main><nav aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/categorias">Productos</a> / ${escapeHtml(category)}</nav><h1>${escapeHtml(category)}</h1><p>${escapeHtml(description)}</p><ul>${list}</ul></main>`;
  await writeRoute(route, withBody(withHead(baseHtml, { title, description, canonical: route }), body));
  sitemapRoutes.push(route);
}

for (const product of products) {
  const route = productPath(product);
  const title = `${product.name} | Joma Group`;
  const description = `Comprá ${product.name}${product.packQty > 1 ? " por unidad o por caja" : ""} en Joma Group, Corrientes Capital.`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, sku: product.id, gtin13: /^\d{13}$/.test(product.gtin) ? product.gtin : undefined, image: product.image ? [product.image] : undefined, description, brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined, offers: { "@type": "Offer", url: `${siteUrl}${route}`, priceCurrency: "ARS", price: product.price, availability: product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition", seller: { "@type": "Organization", name: "Joma Group" } } };
  const body = `<main><nav aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/categorias">Productos</a> / <a href="/categorias/${escapeHtml(product.categoryId)}">${escapeHtml(product.category)}</a> / ${escapeHtml(product.name)}</nav><article><h1>${escapeHtml(product.name)}</h1>${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="500" height="500" />` : ""}<p>${escapeHtml(description)}</p><dl><dt>Código</dt><dd>${escapeHtml(product.id)}</dd><dt>Categoría</dt><dd>${escapeHtml(product.category)}</dd><dt>Presentación</dt><dd>${product.packQty > 1 ? `Unidad o caja por ${product.packQty}` : "Unidad"}</dd></dl><p><strong>${escapeHtml(money.format(product.price))}</strong></p><p>${product.active ? "Disponible" : "Temporalmente sin stock"}</p></article></main>`;
  productWriteQueue.push([route, withBody(withHead(baseHtml, { title, description, canonical: route, type: "product", image: product.image || undefined, jsonLd }), body)]);
  sitemapRoutes.push(route);
}

for (let index = 0; index < productWriteQueue.length; index += 80) {
  await Promise.all(productWriteQueue.slice(index, index + 80).map(([route, html]) => writeRoute(route, html)));
}

// Las URLs de la tienda anterior usaban solamente el nombre. Se conservan como
// puertas de entrada para que resultados históricos de Google no terminen en 404.
const legacyRoutes = new Set();
for (const product of products) {
  const legacyRoute = legacyProductPath(product);
  const canonicalRoute = productPath(product);
  if (legacyRoute === canonicalRoute || legacyRoutes.has(legacyRoute)) continue;
  legacyRoutes.add(legacyRoute);
  const title = `${product.name} | Joma Group`;
  const description = `Consultá ${product.name} en Joma Group, Corrientes Capital.`;
  const redirectHtml = withBody(
    withHead(baseHtml, { title, description, canonical: canonicalRoute, type: "product", image: product.image || undefined })
      .replace("</head>", `<meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalRoute)}" /><script>location.replace(${JSON.stringify(canonicalRoute)});</script></head>`),
    `<main><h1>${escapeHtml(product.name)}</h1><p><a href="${escapeHtml(canonicalRoute)}">Ver producto en Joma Group</a></p></main>`,
  );
  await writeRoute(legacyRoute, redirectHtml);
}

const organization = { "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Joma Group", url: siteUrl, logo: `${siteUrl}/icon-512.png` }, { "@type": ["LocalBusiness", "WholesaleStore"], "@id": `${siteUrl}/#localbusiness`, name: "Joma Group", url: siteUrl, image: `${siteUrl}/icon-512.png`, telephone: "+54 379 439-0919", address: { "@type": "PostalAddress", streetAddress: "Av. Maipú 7249", addressLocality: "Corrientes", addressRegion: "Corrientes", postalCode: "W3400", addressCountry: "AR" }, areaServed: { "@type": "City", name: "Corrientes Capital" }, parentOrganization: { "@id": `${siteUrl}/#organization` } }] };
await writeFile(path.join(dist, "index.html"), withHead(baseHtml, { title: "Joma Group | Mayorista y tienda online en Corrientes", description: "Mayorista y tienda online de alimentos, bebidas y productos de consumo diario en Corrientes Capital.", canonical: "/", jsonLd: organization }), "utf8");

const today = new Date().toISOString().slice(0, 10);
const uniqueRoutes = [...new Set(sitemapRoutes)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueRoutes.map((route) => `  <url><loc>${siteUrl}${route}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /?login=\nDisallow: /?view=cart\nSitemap: ${siteUrl}/sitemap.xml\n`, "utf8");

const merchantProducts = products.filter((product) => product.image && product.price > 0);
const merchantFeed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Joma Group</title><link>${siteUrl}</link><description>Catálogo de Joma Group</description>${merchantProducts.map((product) => `<item><g:id>${escapeHtml(product.id)}</g:id><g:title>${escapeHtml(product.name)}</g:title><g:description>${escapeHtml(`Comprá ${product.name} en Joma Group, Corrientes Capital.`)}</g:description><g:link>${siteUrl}${productPath(product)}</g:link><g:image_link>${escapeHtml(product.image)}</g:image_link><g:availability>${product.active ? "in_stock" : "out_of_stock"}</g:availability><g:price>${product.price.toFixed(2)} ARS</g:price><g:condition>new</g:condition>${product.brand ? `<g:brand>${escapeHtml(product.brand)}</g:brand>` : ""}${product.gtin ? `<g:gtin>${escapeHtml(product.gtin)}</g:gtin>` : `<g:identifier_exists>false</g:identifier_exists>`}<g:product_type>${escapeHtml(product.category)}</g:product_type></item>`).join("")}</channel></rss>\n`;
await writeFile(path.join(dist, "merchant-center.xml"), merchantFeed, "utf8");

const adminHtml = withBody(
  withHead(baseHtml, { title: "Administración | Joma Group", description: "Acceso privado de administración.", canonical: "/admin/pedidos" })
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="noindex,nofollow,noarchive" />'),
  '<div aria-label="Acceso privado"></div>',
);
await writeRoute("/admin/pedidos", adminHtml);
console.log(`SEO: ${products.length} productos, ${categoryMap.size} categorías, ${uniqueRoutes.length} URLs canónicas, ${legacyRoutes.size} rutas históricas y ${merchantProducts.length} productos en Merchant Center.`);
