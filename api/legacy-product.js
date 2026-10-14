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

export default async function handler(request, response) {
  const requestedSlug = slugify(request.query.slug);
  if (!requestedSlug) return response.redirect(302, "/?view=categories");

  try {
    const upstream = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const data = await upstream.json();
    const products = Array.isArray(data) ? data : data.items ?? [];
    const product = products.find((item) => {
      const id = text(item["Código"] ?? item.Codigo ?? item.codigo);
      const name = text(item.Nombre ?? item.nombre);
      return !/^R/i.test(id) && slugify(name) === requestedSlug;
    });

    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    if (product) return response.redirect(308, productPath(product));
  } catch {
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  }

  const query = searchTerms(requestedSlug);
  return response.redirect(302, query ? `/?view=search&q=${encodeURIComponent(query)}` : "/?view=categories");
}
