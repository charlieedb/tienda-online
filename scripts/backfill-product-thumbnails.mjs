import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const BUCKET = "app-presu.firebasestorage.app";
const API = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;
const apply = process.argv.includes("--apply");
const runtimeModules = process.env.CODEX_NODE_MODULES;
const require = createRequire(import.meta.url);
const sharp = runtimeModules
  ? require(`${runtimeModules}/sharp`)
  : require("sharp");

async function list(prefix) {
  const names = [];
  let pageToken = "";
  do {
    const url = new URL(API);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("maxResults", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo listar ${prefix}: HTTP ${response.status}`);
    const data = await response.json();
    names.push(...(data.items ?? []).map((item) => item.name));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return names;
}

function stem(name) {
  return name.split("/").pop().replace(/\.[^.]+$/, "").toUpperCase();
}

function mediaUrl(name) {
  return `${API}/${encodeURIComponent(name)}?alt=media`;
}

function accessToken() {
  return execFileSync("cmd.exe", ["/d", "/s", "/c", "gcloud.cmd auth print-access-token"], {
    encoding: "utf8",
  }).trim();
}

async function upload(name, body, token) {
  const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("name", name);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "image/jpeg",
      "cache-control": "public,max-age=300,must-revalidate",
    },
    body,
  });
  if (!response.ok) throw new Error(`No se pudo subir ${name}: HTTP ${response.status} ${await response.text()}`);
}

const [originals, thumbnails] = await Promise.all([
  list("fotosProductos/"),
  list("fotosProductosThumb/"),
]);
const thumbnailStems = new Set(thumbnails.map(stem));
const seen = new Set();
const missing = originals.filter((name) => {
  const code = stem(name);
  if (thumbnailStems.has(code) || seen.has(code)) return false;
  seen.add(code);
  return true;
});

console.log(`Originales: ${originals.length}. Miniaturas: ${thumbnails.length}. Faltantes: ${missing.length}.`);
if (!apply || !missing.length) {
  if (!apply && missing.length) console.log("Vista previa solamente. Usá --apply para crear las miniaturas faltantes.");
  process.exit(0);
}

const token = accessToken();
let completed = 0;
for (const originalName of missing) {
  const source = await fetch(mediaUrl(originalName));
  if (!source.ok) throw new Error(`No se pudo descargar ${originalName}: HTTP ${source.status}`);
  const thumbnail = await sharp(Buffer.from(await source.arrayBuffer()))
    .resize(220, 220, { fit: "cover", position: "centre" })
    .jpeg({ quality: 55, mozjpeg: true })
    .toBuffer();
  const targetName = `fotosProductosThumb/${stem(originalName)}.jpg`;
  await upload(targetName, thumbnail, token);
  completed += 1;
  console.log(`[${completed}/${missing.length}] ${targetName}`);
}
