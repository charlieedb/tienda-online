const STORAGE_URL = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fproductos.json?alt=media";

export default async function handler(_request, response) {
  try {
    const upstream = await fetch(STORAGE_URL, { cache: "no-store" });
    if (!upstream.ok) return response.status(upstream.status).json({ error: "No se pudo descargar el catálogo" });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=31536000, immutable");
    return response.status(200).send(body);
  } catch {
    return response.status(502).json({ error: "Storage no disponible" });
  }
}
