export type DiscountType = "percentage" | "fixed_amount" | "fixed_sale_price";
export type PromotionStatus = "draft" | "scheduled" | "active" | "paused" | "cancelled";
export type EffectiveStatus = PromotionStatus | "expired";
export type TargetType = "product" | "category" | "all_products";
export type ExclusionType = "product" | "new_products";

export interface PromotionTarget { type: TargetType; id: string | null }
export interface PromotionExclusion { type: ExclusionType; id: string | null }

export interface Promotion {
  id: number;
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountPerProduct: number | null;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  priority: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  targets: PromotionTarget[];
  exclusions: PromotionExclusion[];
  effectiveStatus?: EffectiveStatus;
  targetSummary?: string;
  matchedCount?: number;
}

export interface PromotionPreviewRow {
  id: string;
  title: string;
  regularPrice: number;
  newPrice: number;
  currentPromotionName: string | null;
  conflict: boolean;
}

export interface PromotionPreview {
  matchedCount: number;
  excludedNewCount: number;
  excludedProductCount: number;
  priceRange: { min: number; max: number } | null;
  conflictCount: number;
  rows: PromotionPreviewRow[];
}

export interface PromotionAuditEvent {
  id: number;
  type: string;
  actor: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}
