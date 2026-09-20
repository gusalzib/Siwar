// server/services/pricing.service.ts

/**
 * 1. Type Aliases & Unions
 * Union types ('|') restrict variables to an exact set of allowed values.
 */

// Permitted physical units for comparison price normalization (jämförpris)
export type SupportedUnit = 'g' | 'kg' | 'ml' | 'l' | 'st' | 'dl' | 'cl' | 'قطعة'

// Explicit Swedish moms rates: 12% for food, 25% for non-food & shipping
export type MomsRate = 12 | 25

/**
 * 2. Interfaces (Data Contracts)
 * Interfaces describe the exact shape an object must have.
 */

// Represents an individual item in a cart or order line
export interface LineItemInput {
  unitPriceMinor: number  // Gross unit price in minor currency units (e.g., öre)
  quantity: number        // Quantity purchased (positive integer)
  momsRate: MomsRate      // Product VAT tier (12 or 25)
}

// Financial breakdown for an individual tax bracket
// momsAmountMinor = taxableGrossMinor - taxableNetMinor
export interface TaxBracketBreakdown {
  taxableGrossMinor: number // Gross amount collected for this tax tier
  taxableNetMinor: number   // Net amount before VAT
  momsAmountMinor: number   // Calculated VAT amount
}

// The complete audited tax split result for carts and checkout
export interface MomsSplitResult {
  totalGrossMinor: number   // Overall gross amount (items + shipping). The final amount transmitted to the payment gateway
  totalNetMinor: number     // Overall net amount. equal to moms12.taxableNetMinor + moms25.taxableNetMinor
  totalMomsMinor: number    // Total VAT across both 12% and 25% tiers. totalMomsMinor = moms12.momsAmountMinor + moms25.momsAmountMinor
  moms12: TaxBracketBreakdown
  moms25: TaxBracketBreakdown
}
// totalGrossMinor = moms12.taxableGrossMinor + moms25.taxableGrossMinor


/**
 * 3. Exported Function Skeletons
 */

/**
 * Computes the mandatory Swedish comparison price (jämförpris per kg or liter).
 *
 * @param priceMinor - Retail price in minor currency units (e.g., öre or cents)
 * @param netQuantity - Stated package content quantity
 * @param unit - Unit of measure ('g', 'kg', 'ml', 'l')
 * @returns Minor units per standard unit (e.g., öre per kg or öre per L)
 */
export function calculateJamforpris(
  priceMinor: number,
  netQuantity: number,
  unit: SupportedUnit
): number {

  if (netQuantity <= 0){
    throw new Error("Quantity must be greater than zero");
    
  }
  let conversionFactor = 0;

    // Determine multiplier to scale to standard reference unit (1 kg or 1 L)
    // 1 kg = 1000 g, 1 L = 1000 ml
    switch (unit) {
      case 'g':
        conversionFactor = 1000;
        break;
      case 'kg':
        conversionFactor = 1;
        break;
      case 'ml':
        conversionFactor = 1000;
        break;
      case 'l':
        conversionFactor = 1;
        break;
      default:
        throw new Error('Invalid unit')
    }

    // Keep intermediate math in minor units before dividing to preserve precision
    // Formula: (priceMinor * conversionFactor) / netQuantity
    let comparisonPriceMinor = Math.round((priceMinor * conversionFactor) / netQuantity);
    
  
  return comparisonPriceMinor;
}

/**
 * Extracts 12% and 25% Swedish moms allocations using line-item half-up rounding.
 * Shipping fees are always assessed at the standard 25% rate.
 *
 * @param lineItems - Array of cart items with quantity, price, and moms rate
 * @param shippingFeeMinor - Shipping charge in minor units (defaults to 0)
 * @returns Complete gross, net, and moms split breakdown
 */
export function calculateMomsSplit(
  lineItems: LineItemInput[],
  shippingFeeMinor: number = 0
): MomsSplitResult {

  // the 12 tier for food products
    const moms12tier: TaxBracketBreakdown = {
    taxableGrossMinor: 0,
    taxableNetMinor: 0,
    momsAmountMinor: 0
    };
    // 25 tier for non-food products
    const moms25tier: TaxBracketBreakdown = {
    taxableGrossMinor: 0,
    taxableNetMinor: 0,
    momsAmountMinor: 0
    };
    
  for ( const item of lineItems) {
    // line as in a row in the cart table
    let lineTax = 0;
    let lineNet = 0;
    let lineGross = 0;

    if (item) {

        lineGross = item.quantity * item.unitPriceMinor; 

      if (item.momsRate === 12) {
        // Food item rate: tax is 12/112 of gross amount
        lineTax = Math.round((lineGross * 12) / 112);
        lineNet = lineGross - lineTax;

        // Aggregate results in the moms12tier object
        moms12tier.taxableGrossMinor = moms12tier.taxableGrossMinor + lineGross;
        moms12tier.taxableNetMinor = moms12tier.taxableNetMinor + lineNet;
        moms12tier.momsAmountMinor = moms12tier.momsAmountMinor + lineTax;
      }
      else if (item.momsRate === 25) {
        // non-food item tax is 25/125 of gross amount 
        lineTax = Math.round((lineGross * 25) / 125);
        lineNet = lineGross - lineTax;

        // Aggregate results into the moms25tier object
        moms25tier.taxableGrossMinor = moms25tier.taxableGrossMinor + lineGross;
        moms25tier.taxableNetMinor = moms25tier.taxableNetMinor + lineNet;
        moms25tier.momsAmountMinor = moms25tier.momsAmountMinor + lineTax;
      }else{
        // it's not possible to have other moms rates than 12 or 25
        throw new Error(`Unsupported moms rate: ${(item as any).momsRate}`);
      }

    }
  }

  if (shippingFeeMinor > 0) {
    let shippingGross = shippingFeeMinor;
    let shippingTax = Math.round((shippingGross * 25) / 125); 
    let shippingNet = shippingGross - shippingTax;

    // Add shipping costs to the moms25tier because shipping is always 25% in sweden
    moms25tier.taxableGrossMinor = moms25tier.taxableGrossMinor + shippingGross;
    moms25tier.taxableNetMinor = moms25tier.taxableNetMinor + shippingNet;
    moms25tier.momsAmountMinor = moms25tier.momsAmountMinor + shippingTax;

  }

  // Calculate consolidated order totals
  const totalGross = moms25tier.taxableGrossMinor + moms12tier.taxableGrossMinor;
  const totalNet = moms25tier.taxableNetMinor + moms12tier.taxableNetMinor; 
  const totalTax = moms25tier.momsAmountMinor + moms12tier.momsAmountMinor;

  return {
    totalGrossMinor: totalGross, 
    totalNetMinor: totalNet,
    totalMomsMinor: totalTax,
    moms12: moms12tier,
    moms25: moms25tier
  }
}