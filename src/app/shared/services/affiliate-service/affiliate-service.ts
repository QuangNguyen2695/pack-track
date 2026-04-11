/**
 * Affiliate Service Module
 * 
 * Exports:
 * - AffiliateService: Main service for managing affiliate data
 * - AffiliateItem, AffiliatePack, AffiliateSingleProduct: Type definitions
 * 
 * Example usage in a component:
 * 
 * constructor(private affiliateService: AffiliateService) {}
 * 
 * // Get random item
 * const randomItem = this.affiliateService.getRandomItem();
 * 
 * // Get item by index
 * const itemAtIndex = this.affiliateService.getItemByIndex(0);
 * 
 * // Get all items
 * const allItems = this.affiliateService.getAllItems();
 * 
 * // Get total count
 * const count = this.affiliateService.getItemCount();
 */

export { AffiliateService } from "./affiliate.service";
export { AffiliateItem, AffiliatePack, AffiliateSingleProduct, AffiliateProduct, AffiliateDataConfig } from "./affiliate.model";
