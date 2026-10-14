const CATALOG_URL = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fproductos.json?alt=media";

function text(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return text(value)
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productPath(product) {
  const id = text(product["Código"] ?? product.Codigo ?? product.codigo);
  const name = text(product.Nombre ?? product.nombre);
  return `/productos/${slugify(name)}--${slugify(id)}`;
}

function searchTerms(slug) {
  return slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function renderProductHtml(baseHtml, product) {
  const id = text(product["Código"] ?? product.Codigo ?? product.codigo);
  const name = text(product.Nombre ?? product.nombre);
  const route = productPath(product);
  const siteUrl = "https://www.jomagroup.com.ar";
  const description = `Comprá ${name} por unidad o por caja en Joma Group, Corrientes Capital.`;
  const listPrice = number(product.Precio ?? product.precio ?? product.PrecioMostrador);
  const discount = number(product.descOferta ?? product.descuentoPct ?? product.descuento);
  const price = discount > 0 ? Math.round(listPrice * (1 - discount / 100) * 100) / 100 : listPrice;
  const stock = product.stockReal === null || product.stockReal === undefined || product.stockReal === ""
    ? null
    : number(product.stockReal);
  const available = stock === null ? product.sinStock !== true : stock > 0;
  const image = text(product.imgUrl ?? product.ImgUrl ?? product.imagenThumbURL ?? product.imagenURL ?? product.foto)
    || `https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/fotosProductosThumb%2F${encodeURIComponent(id.replaceAll("/", "_"))}.jpg?alt=media`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: id,
    image: [image],
    description,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}${route}`,
      priceCurrency: "ARS",
      price,
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Joma Group" },
    },
  };
  const body = `<main><nav aria-label="Migas de pan"><a href="/">Inicio</a> / <a href="/categorias">Productos</a> / ${escapeHtml(name)}</nav><article><h1>${escapeHtml(name)}</h1><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="500" height="500" /><p>${escapeHtml(description)}</p><p><strong>$${price.toLocaleString("es-AR")}</strong></p><p>${available ? "Disponible" : "Temporalmente sin stock"}</p></article></main>`;
  return baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(name)} | Joma Group</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="index,follow,max-image-preview:large" />')
    .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${siteUrl}${route}" />`)
    .replace(/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="product" />')
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(name)} | Joma Group" />`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${siteUrl}${route}" />`)
    .replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>\n</head>`)
    .replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${body}</div>`);
}

export default async function handler(request, response) {
  const requestedSlug = slugify(request.query.slug);
  if (!requestedSlug) return response.redirect(302, "/?view=categories");

  try {
    const [upstream, home] = await Promise.all([
      fetch(CATALOG_URL, { cache: "no-store" }),
      fetch(`https://${request.headers.host}/`, { cache: "no-store" }),
    ]);
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const data = await upstream.json();
    const products = Array.isArray(data) ? data : data.items ?? [];
    const product = products.find((item) => {
      const id = text(item["Código"] ?? item.Codigo ?? item.codigo);
      const name = text(item.Nombre ?? item.nombre);
      return !/^R/i.test(id) && slugify(`${slugify(name)}--${slugify(id)}`) === requestedSlug;
    });

    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    if (product && home.ok) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.status(200).send(renderProductHtml(await home.text(), product));
    }

    const legacyProduct = products.find((item) => {
      const id = text(item["Código"] ?? item.Codigo ?? item.codigo);
      const name = text(item.Nombre ?? item.nombre);
      return !/^R/i.test(id) && slugify(name) === requestedSlug;
    });
    if (legacyProduct) return response.redirect(308, productPath(legacyProduct));
  } catch {
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  }

  const query = searchTerms(requestedSlug);
  return response.redirect(302, query ? `/?view=search&q=${encodeURIComponent(query)}` : "/?view=categories");
}
