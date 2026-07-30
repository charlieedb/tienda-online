export const SPEED_PRIMARY_PRODUCT_CODES = ["1", "1/1", "2", "2/2"] as const;

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isSpeedPrioritySearch(query: string) {
  const normalized = normalizeSearch(query);
  return normalized.includes("speed") || normalized.includes("energizante");
}

export function getSpeedProductPriority(productId: string, query: string) {
  if (!isSpeedPrioritySearch(query)) return null;
  const index = SPEED_PRIMARY_PRODUCT_CODES.indexOf(
    productId.trim() as (typeof SPEED_PRIMARY_PRODUCT_CODES)[number],
  );
  return index >= 0 ? index : null;
}

export function prioritizeSpeedProducts<T extends { id: string }>(products: T[], query: string) {
  if (!isSpeedPrioritySearch(query)) return products;
  return products
    .map((product, order) => ({ product, order }))
    .sort((a, b) => {
      const priorityA = getSpeedProductPriority(a.product.id, query);
      const priorityB = getSpeedProductPriority(b.product.id, query);
      if (priorityA !== null && priorityB !== null) return priorityA - priorityB;
      if (priorityA !== null) return -1;
      if (priorityB !== null) return 1;
      return a.order - b.order;
    })
    .map(({ product }) => product);
}
