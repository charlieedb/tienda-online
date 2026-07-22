const STORAGE_URL = "https://firebasestorage.googleapis.com/v0/b/app-presu.firebasestorage.app/o/catalogo%2Fversion.json?alt=media";

export default async function handler(_request, response) {
  try {
    const upstream = await fetch(`${STORAGE_URL}&t=${Date.now()}`, { cache: "no-store" });
    if (!upstream.ok) return response.status(upstream.status).json({ error: "No se pudo consultar la versión" });
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json(await upstream.json());
  } catch {
    return response.status(502).json({ error: "Storage no disponible" });
  }
}
