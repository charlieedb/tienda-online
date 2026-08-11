export type Product = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  categoryId: string;
  imageUrl?: string;
  imageFallbackUrl?: string;
  unit: { label: string; price: number; listPrice?: number; discountPct?: number };
  pack?: { qty: number; label: string; price: number; listPrice?: number; discountPct?: number };
  sortPrice: number;
  keywords: string[];
  active: boolean;
  stockReal?: number;
  offer?: boolean;
  offerDiscount?: number;
  offerCondition?: "pack";
  packPromoUnitPrice?: number;
  featured?: boolean;
  featuredOrder?: number;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  color: string;
  image: string;
  count: number;
};

export type CatalogManifest = {
  version: number;
  featuredCount: number;
  categories: Category[];
};

export interface CatalogProvider {
  getManifest(signal?: AbortSignal): Promise<CatalogManifest>;
  getFeaturedProducts(signal?: AbortSignal): Promise<Product[]>;
  getOfferProducts(signal?: AbortSignal): Promise<Product[]>;
  getCategoryProducts(categoryId: string, signal?: AbortSignal): Promise<Product[]>;
  searchProducts(query: string, signal?: AbortSignal): Promise<Product[]>;
  getProduct(productId: string, signal?: AbortSignal): Promise<Product | null>;
  getAllProducts(signal?: AbortSignal): Promise<Product[]>;
  getCatalogVersion(signal?: AbortSignal): Promise<number>;
  checkForUpdates?(): Promise<boolean>;
}
