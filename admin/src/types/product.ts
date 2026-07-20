export interface AdminVariant {
  id: string;
  color?: string;
  colorEn?: string;
  colorHex?: string;
  sku?: string;
  price?: number | null;
  salePrice?: number | null;
  saleUntil?: string | null;
  stock?: number | null;
  images?: string[];
  available?: boolean;
  position?: number;
}

export interface AdminProduct {
  id: string;
  catId: string;
  category: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  image?: string;
  images?: string[];
  index?: number;
  custom: boolean;
  price: number | null;
  salePrice: number | null;
  saleUntil: string | null;
  stock: number | null;
  active?: boolean;
  variants: AdminVariant[];
  details?: Record<string, unknown> | null;
}

export interface ProductsResponse {
  ok: boolean;
  products: AdminProduct[];
}
