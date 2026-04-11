/**
 * Affiliate product model for pack items (e.g., Shopee links)
 */
export interface AffiliateProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  links: string[];
  badge?: string;
  sold?: string;
}

/**
 * Affiliate pack model - bundle múltiple products
 */
export interface AffiliatePack {
  id: string;
  type: "pack";
  title: string;
  thumbnail: string;
  products: AffiliateProduct[];
}

/**
 * Affiliate single product model
 */
export interface AffiliateSingleProduct {
  id: string;
  type: "product";
  name: string;
  price: number;
  image: string;
  links: string[];
  badge?: string;
  sold?: string;
}

/**
 * Union type for all affiliate items
 */
export type AffiliateItem = AffiliatePack | AffiliateSingleProduct;

/**
 * Affiliate data config from Firebase
 */
export interface AffiliateDataConfig {
  items: AffiliateItem[];
}
