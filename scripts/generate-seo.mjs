import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dist = path.join(process.cwd(), "dist");
const siteUrl = "https://jomagroup.com.ar";
const catalogUrl = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fproductos.json?alt=media";
const baseHtml = await readFile(path.join(dist, "index.html"), "utf8");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const text = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalize = (value) => text(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-categoria";
const bool = (value) => value === true || ["1", "true", "si", "sí"].includes(text(value).toLowerCase());
const productPath = (product) => `/productos/${slugify(product.name)}--${slugify(product.id)}`;
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function normalizeProduct(raw, index) {
  const id = text(raw["Código"] ?? raw.Codigo ?? raw.codigo) || `producto-${index}`;
  const name = text(raw.Nombre ?? raw.nombre) || "Producto sin nombre";
  const category = text(raw.Linea ?? raw.linea ?? raw.Categoria ?? raw.categoria) || "Sin categoría";
  const stockValue = raw.stockReal;
  const stockReal = stockValue === null || stockValue === undefined || stockValue === "" ? undefined : Number(stockValue);
  const packQty = Math.max(1, Math.trunc(number(raw.Presentacion ?? raw.presentacion) || 1));
  const listPrice = number(raw.Precio ?? raw.precio ?? raw.PrecioMostrador);
  const discount = number(raw.descOferta ?? raw.descuentoPct ?? raw.descuento);
  return {
    id, name, category, categoryId: slugify(category), packQty,
    active: !/^R/i.test(id) && (Number.isFinite(stockReal) ? stockReal > 0 : !bool(raw.sinStock ?? raw.SinStock)),
    price: discount > 0 ? Math.round(listPrice * (1 - discount / 100) * 100) / 100 : listPrice,
    image: text(raw.imgUrl ?? raw.ImgUrl ?? raw.imagenThumbURL ?? raw.imagenURL ?? raw.foto),
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
  return html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${content}</div>`);
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
  const response = await fetch(catalogUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  products = (Array.isArray(data) ? data : data.items ?? []).map(normalizeProduct).filter((product) => !/^R/i.test(product.id));
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
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, sku: product.id, image: product.image ? [product.image] : undefined, offers: { "@type": "Offer", url: `${siteUrl}${route}`, priceCurrency: "ARS", price: product.price, availability: product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" } };
  const body = `<main><nav aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/categorias">Productos</a> / <a href="/categorias/${escapeHtml(product.categoryId)}">${escapeHtml(product.category)}</a> / ${escapeHtml(product.name)}</nav><article><h1>${escapeHtml(product.name)}</h1>${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="500" height="500" />` : ""}<p>${escapeHtml(description)}</p><dl><dt>Código</dt><dd>${escapeHtml(product.id)}</dd><dt>Categoría</dt><dd>${escapeHtml(product.category)}</dd><dt>Presentación</dt><dd>${product.packQty > 1 ? `Unidad o caja por ${product.packQty}` : "Unidad"}</dd></dl><p><strong>${escapeHtml(money.format(product.price))}</strong></p><p>${product.active ? "Disponible" : "Temporalmente sin stock"}</p></article></main>`;
  productWriteQueue.push([route, withBody(withHead(baseHtml, { title, description, canonical: route, type: "product", image: product.image || undefined, jsonLd }), body)]);
  sitemapRoutes.push(route);
}

for (let index = 0; index < productWriteQueue.length; index += 80) {
  await Promise.all(productWriteQueue.slice(index, index + 80).map(([route, html]) => writeRoute(route, html)));
}

const organization = { "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Joma Group", url: siteUrl, logo: `${siteUrl}/icon-512.png` }, { "@type": ["LocalBusiness", "WholesaleStore"], "@id": `${siteUrl}/#localbusiness`, name: "Joma Group", url: siteUrl, image: `${siteUrl}/icon-512.png`, telephone: "+54 379 439-0919", address: { "@type": "PostalAddress", streetAddress: "Av. Maipú 7249", addressLocality: "Corrientes", addressRegion: "Corrientes", postalCode: "W3400", addressCountry: "AR" }, areaServed: { "@type": "City", name: "Corrientes Capital" }, parentOrganization: { "@id": `${siteUrl}/#organization` } }] };
await writeFile(path.join(dist, "index.html"), withHead(baseHtml, { title: "Joma Group | Mayorista y tienda online en Corrientes", description: "Mayorista y tienda online de alimentos, bebidas y productos de consumo diario en Corrientes Capital.", canonical: "/", jsonLd: organization }), "utf8");

const today = new Date().toISOString().slice(0, 10);
const uniqueRoutes = [...new Set(sitemapRoutes)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueRoutes.map((route) => `  <url><loc>${siteUrl}${route}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /?login=\nDisallow: /?view=cart\nSitemap: ${siteUrl}/sitemap.xml\n`, "utf8");

const adminHtml = withBody(
  withHead(baseHtml, { title: "Administración | Joma Group", description: "Acceso privado de administración.", canonical: "/admin/pedidos" })
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="noindex,nofollow,noarchive" />'),
  '<div aria-label="Acceso privado"></div>',
);
await writeRoute("/admin/pedidos", adminHtml);
console.log(`SEO: ${products.length} productos, ${categoryMap.size} categorías y ${uniqueRoutes.length} URLs prerenderizadas.`);
