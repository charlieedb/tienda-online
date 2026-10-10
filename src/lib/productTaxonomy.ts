const CATEGORY_BY_SUBCATEGORY: Record<string, string> = {
  aa: "Bebidas",
  promo: "Promociones",
  alimentos: "Almacén",
  aceites: "Almacén",
  aderezos: "Almacén",
  arroz: "Almacén",
  cafeteria: "Almacén",
  carniceria: "Almacén",
  cereales: "Almacén",
  condimentos: "Almacén",
  congelados: "Almacén",
  fiambreria: "Almacén",
  fideos: "Almacén",
  infusiones: "Almacén",
  lacteos: "Almacén",
  "pastas frescas": "Almacén",
  verduleria: "Almacén",
  yerba: "Almacén",
  galletitas: "Almacén",
  snacks: "Almacén",
  golosinas: "Almacén",
  panaderia: "Almacén",
  gaseosa: "Bebidas",
  jugos: "Bebidas",
  pulpas: "Bebidas",
  "vinos finos": "Bebidas",
  aperitivos: "Bebidas",
  champagne: "Bebidas",
  espumantes: "Bebidas",
  cervezas: "Bebidas",
  vodka: "Bebidas",
  gin: "Bebidas",
  wisky: "Bebidas",
  fernet: "Bebidas",
  licores: "Bebidas",
  ron: "Bebidas",
  petacas: "Bebidas",
  tekila: "Bebidas",
  limpieza: "Limpieza y cuidado",
  higiene: "Limpieza y cuidado",
  hogar: "Hogar y bazar",
  dormitorio: "Hogar y bazar",
  "jonico max": "Hogar y bazar",
  electrodomesticos: "Tecnología y electricidad",
  electricidad: "Tecnología y electricidad",
  electronica: "Tecnología y electricidad",
  sonido: "Tecnología y electricidad",
  herramientas: "Herramientas",
  libreria: "Librería",
  infantiles: "Juguetería y regalos",
  mascotas: "Mascotas",
  ropa: "Indumentaria y accesorios",
  estuches: "Bebidas",
  aguas: "Bebidas",
  energizantes: "Bebidas",
  "combos de bebidas": "Bebidas",
  "accesorios para bebidas": "Otros",
  general: "Otros",
};

const LEGACY_AA_BY_CODE: Record<string, string> = {
  "1": "Energizantes", "1/1": "Energizantes", "1/2": "Aguas",
  "2": "Energizantes", "2/2": "Energizantes",
  "3": "Champagne", "4": "Champagne", "8": "Champagne", "8/1": "Champagne",
  "5": "Licores", "7": "Licores", "10": "Licores",
  "9": "Combos de bebidas", "9/1": "Combos de bebidas", "9/2": "Combos de bebidas",
  "9/3": "Combos de bebidas", "9/4": "Combos de bebidas", "9/66": "Combos de bebidas",
  C1: "Combos de bebidas", C2: "Combos de bebidas", C3: "Combos de bebidas",
  C51: "Combos de bebidas", C52: "Combos de bebidas", C54: "Combos de bebidas", C55: "Combos de bebidas",
  "9/5": "Accesorios para bebidas", "9/9": "Accesorios para bebidas",
  "999": "Accesorios para bebidas", "999/1": "Accesorios para bebidas", "965": "Otros",
};

function normalized(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function resolveProductTaxonomy(raw: Record<string, unknown>) {
  const sourceSubcategory = String(raw.Linea ?? raw.linea ?? raw.Familia ?? raw.familia ?? "").trim();
  const code = String(raw["Código"] ?? raw.Codigo ?? raw.codigo ?? "").trim().toUpperCase();
  const name = String(raw.Nombre ?? raw.nombre ?? "");
  const subcategory = normalized(sourceSubcategory) === "aa"
    ? LEGACY_AA_BY_CODE[code] || (normalized(name).includes("alfajor") ? "Golosinas" : "Otros")
    : sourceSubcategory || "Sin subcategoría";
  const explicitCategory = String(raw.Categoria ?? raw.categoria ?? raw["Categoría"] ?? "").trim();
  const category = explicitCategory || CATEGORY_BY_SUBCATEGORY[normalized(subcategory)] || "Otros";
  return { category, subcategory };
}
