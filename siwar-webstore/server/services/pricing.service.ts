// server/services/pricing.service.ts

/**
 * 1. Type Aliases & Unions
 * Union types ('|') restrict variables to an exact set of allowed values.
 */

// Permitted physical units for comparison price normalization (jämförpris)
export type SupportedUnit = 'g' | 'kg' | 'ml' | 'l' | 'st' | 'dl' | 'cl' | 'قطعة'

// Explicit Swedish moms rates: 6% for books/periodicals, 12% for food, 25% for non-food & shipping
export type MomsRate = 6 | 12 | 25

/**
 * 2. Interfaces (Data Contracts)
 * Interfaces describe the exact shape an object must have.
 */

// Represents an individual item in a cart or order line
export interface LineItemInput {
  productId?: string
  unitPriceMinor: number  // Gross unit price in minor currency units (e.g., öre)
  quantity: number        // Quantity purchased (positive integer)
  momsRate: MomsRate      // Product VAT tier (6, 12 or 25)
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
  totalNetMinor: number     // Overall net amount. equal to moms6.taxableNetMinor + moms12.taxableNetMinor + moms25.taxableNetMinor
  totalMomsMinor: number    // Total VAT across 6%, 12% and 25% tiers.
  moms6: TaxBracketBreakdown
  moms12: TaxBracketBreakdown
  moms25: TaxBracketBreakdown
}

// Statutory tax split breakdown alias
export type ITaxSplitBreakdown = MomsSplitResult
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

  // the 6 tier for books and periodicals
  const moms6tier: TaxBracketBreakdown = {
    taxableGrossMinor: 0,
    taxableNetMinor: 0,
    momsAmountMinor: 0,
  }
  // the 12 tier for food products
  const moms12tier: TaxBracketBreakdown = {
    taxableGrossMinor: 0,
    taxableNetMinor: 0,
    momsAmountMinor: 0,
  }
  // 25 tier for non-food products
  const moms25tier: TaxBracketBreakdown = {
    taxableGrossMinor: 0,
    taxableNetMinor: 0,
    momsAmountMinor: 0,
  }
    
  for (const item of lineItems) {
    // line as in a row in the cart table
    let lineTax = 0
    let lineNet = 0
    let lineGross = 0

    if (item) {
      lineGross = item.quantity * item.unitPriceMinor

      if (item.momsRate === 6) {
        // Books & periodicals rate: tax is 6/106 of gross amount
        lineTax = Math.round((lineGross * 6) / 106)
        lineNet = lineGross - lineTax

        // Aggregate results in the moms6tier object
        moms6tier.taxableGrossMinor += lineGross
        moms6tier.taxableNetMinor += lineNet
        moms6tier.momsAmountMinor += lineTax
      } else if (item.momsRate === 12) {
        // Food item rate: tax is 12/112 of gross amount
        lineTax = Math.round((lineGross * 12) / 112)
        lineNet = lineGross - lineTax

        // Aggregate results in the moms12tier object
        moms12tier.taxableGrossMinor += lineGross
        moms12tier.taxableNetMinor += lineNet
        moms12tier.momsAmountMinor += lineTax
      } else if (item.momsRate === 25) {
        // non-food item tax is 25/125 of gross amount 
        lineTax = Math.round((lineGross * 25) / 125)
        lineNet = lineGross - lineTax

        // Aggregate results into the moms25tier object
        moms25tier.taxableGrossMinor += lineGross
        moms25tier.taxableNetMinor += lineNet
        moms25tier.momsAmountMinor += lineTax
      } else {
        // it's not possible to have other moms rates than 6, 12 or 25
        throw new Error(`Unsupported moms rate: ${(item as any).momsRate}`)
      }
    }
  }

  if (shippingFeeMinor > 0) {
    const shippingGross = shippingFeeMinor
    const shippingTax = Math.round((shippingGross * 25) / 125) 
    const shippingNet = shippingGross - shippingTax

    // Add shipping costs to the moms25tier because shipping is always 25% in sweden
    moms25tier.taxableGrossMinor += shippingGross
    moms25tier.taxableNetMinor += shippingNet
    moms25tier.momsAmountMinor += shippingTax
  }

  // Calculate consolidated order totals across 6%, 12%, and 25% tiers
  const totalGross = moms6tier.taxableGrossMinor + moms12tier.taxableGrossMinor + moms25tier.taxableGrossMinor
  const totalNet = moms6tier.taxableNetMinor + moms12tier.taxableNetMinor + moms25tier.taxableNetMinor
  const totalTax = moms6tier.momsAmountMinor + moms12tier.momsAmountMinor + moms25tier.momsAmountMinor

  return {
    totalGrossMinor: totalGross, 
    totalNetMinor: totalNet,
    totalMomsMinor: totalTax,
    moms6: moms6tier,
    moms12: moms12tier,
    moms25: moms25tier,
  }
}

/**
 * 4. Campaign Scheduling & Time-Window Validation (FR-1, FR-6, FR-12)
 */

export interface MultiCurrencyPrices {
  SEK: number
  EUR: number
  USD: number
}

/**
 * Evaluates whether a product's promotional discount is currently active based on
 * the campaign time window formula:
 *
 * Is Discount Active <=> discount > 0 AND (startsAt <= now) AND (expiresAt is null OR expiresAt > now)
 *
 * @param discount - Discount percentage (e.g. 15 for 15% off)
 * @param startsAt - Campaign start timestamp (defaults to active if null or omitted)
 * @param expiresAt - Campaign expiration timestamp (indefinite if null or omitted)
 * @param referenceDate - Comparison timestamp (defaults to current time new Date())
 * @returns boolean indicating if promotional price applies
 */
export function isDiscountActive(
  discount?: number | null,
  startsAt?: Date | string | null,
  expiresAt?: Date | string | null,
  referenceDate: Date = new Date()
): boolean {
  const numericDiscount = Number(discount)
  if (!numericDiscount || Number.isNaN(numericDiscount) || numericDiscount <= 0) {
    return false
  }

  const nowMs = referenceDate.getTime()

  // Evaluate startsAt window boundary
  if (startsAt) {
    const startDate = startsAt instanceof Date ? startsAt : new Date(startsAt)
    if (!Number.isNaN(startDate.getTime()) && startDate.getTime() > nowMs) {
      return false
    }
  }

  // Evaluate expiresAt window boundary
  if (expiresAt) {
    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() <= nowMs) {
      return false
    }
  }

  return true
}

/**
 * Calculates discounted minor prices for all supported currencies when a promotion is active.
 * Automatically returns null if the discount is inactive or expired.
 *
 * @param price - Base retail prices in minor currency units (SEK, EUR, USD)
 * @param discount - Discount percentage
 * @param startsAt - Scheduled campaign start date
 * @param expiresAt - Scheduled campaign expiration deadline
 * @param referenceDate - Current evaluation timestamp
 * @returns MultiCurrencyPrices or null if promotion is expired / inactive
 */
export function calculateDiscountedPrice(
  price: MultiCurrencyPrices,
  discount?: number | null,
  startsAt?: Date | string | null,
  expiresAt?: Date | string | null,
  referenceDate: Date = new Date()
): MultiCurrencyPrices | null {
  if (!isDiscountActive(discount, startsAt, expiresAt, referenceDate)) {
    return null
  }

  const numericDiscount = Number(discount)
  const multiplier = 1 - numericDiscount / 100

  return {
    SEK: Math.round((price?.SEK || 0) * multiplier),
    EUR: Math.round((price?.EUR || 0) * multiplier),
    USD: Math.round((price?.USD || 0) * multiplier),
  }
}

/**
 * Checks whether an active discount is approaching its scheduled deadline
 * (within threshold hours, e.g. 48 hours for urgent "Slutar snart" badge).
 *
 * @param expiresAt - Scheduled campaign expiration timestamp
 * @param referenceDate - Current evaluation timestamp
 * @param thresholdHours - Urgency threshold in hours (defaults to 48)
 * @returns boolean indicating if urgent expiry badge should be displayed
 */
export function isDiscountExpiringSoon(
  expiresAt?: Date | string | null,
  referenceDate: Date = new Date(),
  thresholdHours: number = 48
): boolean {
  if (!expiresAt) return false

  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)
  if (Number.isNaN(expiryDate.getTime())) return false

  const nowMs = referenceDate.getTime()
  const expiryMs = expiryDate.getTime()
  const diffMs = expiryMs - nowMs

  // Urgent if still in future but within the threshold window
  return diffMs > 0 && diffMs <= thresholdHours * 60 * 60 * 1000
}

/**
 * 5. Promotional Precedence & Kortdatum Clearance Levers
 */
export interface KortdatumPricingInput {
  isKortdatum?: boolean
  bestBeforeDate?: Date | string | null
  clearanceDiscount?: number | null
}

export interface CategoryPromotionPricingInput {
  discountPercent?: number | null
  discountStartsAt?: Date | string | null
  discountExpiresAt?: Date | string | null
  isActiveDiscount?: boolean | null
}

export interface ResolvedPriceResult {
  effectivePriceMinor: MultiCurrencyPrices
  originalPriceMinor: MultiCurrencyPrices
  appliedDiscountPercent: number
  activeDiscountType: 'KORTDATUM' | 'CATEGORY' | 'ORDINARY' | 'NONE'
  isKortdatum: boolean
  badgeText?: { ar: string; sv: string; en: string }
  deadlineDate?: Date | null
}

export interface EffectiveDiscountResult {
  discountPercent: number
  isKortdatum: boolean
  isCategoryDiscount: boolean
  source: 'none' | 'kortdatum' | 'product' | 'category'
  activeDiscountType: 'KORTDATUM' | 'CATEGORY' | 'ORDINARY' | 'NONE'
  deadlineDate?: Date | null
  badgeText?: { ar: string; sv: string; en: string }
}

/**
 * Validates that Kortdatum clearance item has not passed its best-before date
 */
function isKortdatumDateValid(bestBeforeDate?: Date | string | null, refDate: Date = new Date()): boolean {
  if (!bestBeforeDate) return true
  const bb = new Date(bestBeforeDate)
  if (Number.isNaN(bb.getTime())) return true
  const startOfToday = new Date(refDate)
  startOfToday.setHours(0, 0, 0, 0)
  return bb.getTime() >= startOfToday.getTime()
}

/**
 * Evaluates the deterministic effective promotional discount for a product following the
 * strict precedence hierarchy:
 * 1. Kortdatum (Short-Dated Clearance): Always wins if active and unexpired. Overrides category & item sales.
 * 2. Category-Wide Promotion: Active broad marketing sale overrides ordinary item-level discounts.
 * 3. Ordinary Product Discount: Applies only if no active Kortdatum and no active category sale.
 * 4. Regular Retail Price: Base fallback.
 *
 * @param productOrParams - Product discounts, Kortdatum settings, and parent Category promotion
 * @param categoryPromotion - Optional category promotion override
 * @param referenceDate - Comparison timestamp (defaults to new Date())
 * @returns EffectiveDiscountResult
 */
export function resolveEffectiveProductDiscount(
  productOrParams: {
    discount?: number | null
    discountStartsAt?: Date | string | null
    discountExpiresAt?: Date | string | null
    kortdatum?: KortdatumPricingInput | null
    categoryPromotion?: CategoryPromotionPricingInput | null
    category?: CategoryPromotionPricingInput | null
    referenceDate?: Date
  },
  categoryPromotion?: CategoryPromotionPricingInput | null,
  referenceDate?: Date
): EffectiveDiscountResult {
  const kortdatum = productOrParams?.kortdatum
  const discount = productOrParams?.discount
  const discountStartsAt = productOrParams?.discountStartsAt
  const discountExpiresAt = productOrParams?.discountExpiresAt

  const cat = categoryPromotion !== undefined
    ? categoryPromotion
    : (productOrParams?.categoryPromotion || (productOrParams as any)?.category)

  const refDate = referenceDate || productOrParams?.referenceDate || new Date()

  // 1. Priority 1 (Highest): Kortdatum Clearance (Operational Imperative)
  if (
    kortdatum?.isKortdatum &&
    typeof kortdatum.clearanceDiscount === 'number' &&
    kortdatum.clearanceDiscount > 0 &&
    isKortdatumDateValid(kortdatum.bestBeforeDate, refDate)
  ) {
    const clearancePct = Math.min(90, Math.max(1, kortdatum.clearanceDiscount))
    return {
      discountPercent: clearancePct,
      isKortdatum: true,
      isCategoryDiscount: false,
      source: 'kortdatum',
      activeDiscountType: 'KORTDATUM',
      deadlineDate: kortdatum.bestBeforeDate ? new Date(kortdatum.bestBeforeDate) : null,
      badgeText: { ar: 'تاريخ قصير', sv: 'Kort datum', en: 'Short-dated' },
    }
  }

  // 2. Priority 2 (Medium): Active Category-Wide Sale (Broad Marketing Override)
  // Overrides any ordinary individual product discount
  if (
    cat &&
    cat.isActiveDiscount &&
    typeof cat.discountPercent === 'number' &&
    cat.discountPercent > 0 &&
    isDiscountActive(cat.discountPercent, cat.discountStartsAt, cat.discountExpiresAt, refDate)
  ) {
    const categoryPct = Math.min(90, Math.max(1, cat.discountPercent))
    return {
      discountPercent: categoryPct,
      isKortdatum: false,
      isCategoryDiscount: true,
      source: 'category',
      activeDiscountType: 'CATEGORY',
      deadlineDate: cat.discountExpiresAt ? new Date(cat.discountExpiresAt) : null,
      badgeText: {
        ar: `خصم ${categoryPct}%`,
        sv: `-${categoryPct}%`,
        en: `-${categoryPct}%`,
      },
    }
  }

  // 3. Priority 3 (Lowest): Ordinary Product Discount
  if (isDiscountActive(discount, discountStartsAt, discountExpiresAt, refDate)) {
    const ordinaryPct = Math.min(100, Math.max(0, Number(discount) || 0))
    return {
      discountPercent: ordinaryPct,
      isKortdatum: false,
      isCategoryDiscount: false,
      source: 'product',
      activeDiscountType: 'ORDINARY',
      deadlineDate: discountExpiresAt ? new Date(discountExpiresAt) : null,
      badgeText: {
        ar: `خصم ${ordinaryPct}%`,
        sv: `-${ordinaryPct}%`,
        en: `-${ordinaryPct}%`,
      },
    }
  }

  // 4. Priority 4: Regular Retail Price (No active promotional lever)
  return {
    discountPercent: 0,
    isKortdatum: false,
    isCategoryDiscount: false,
    source: 'none',
    activeDiscountType: 'NONE',
    deadlineDate: null,
  }
}

/**
 * Resolves full multi-currency pricing following the deterministic 4-tier discount hierarchy.
 * Computes effective minor units deterministically using integer arithmetic:
 * effectivePriceMinor = round(retailPriceMinor * (100 - appliedDiscountPercent) / 100)
 *
 * @param productOrParams - Product with price, discounts, and category details
 * @param categoryPromotion - Optional category promotion
 * @param referenceDate - Current evaluation timestamp
 * @returns ResolvedPriceResult
 */
export function resolveEffectiveProductPrice(
  productOrParams: {
    price?: MultiCurrencyPrices | null
    discount?: number | null
    discountStartsAt?: Date | string | null
    discountExpiresAt?: Date | string | null
    kortdatum?: KortdatumPricingInput | null
    categoryPromotion?: CategoryPromotionPricingInput | null
    category?: CategoryPromotionPricingInput | null
    referenceDate?: Date
  },
  categoryPromotion?: CategoryPromotionPricingInput | null,
  referenceDate?: Date
): ResolvedPriceResult {
  const originalPriceMinor: MultiCurrencyPrices = {
    SEK: Number(productOrParams?.price?.SEK) || 0,
    EUR: Number(productOrParams?.price?.EUR) || 0,
    USD: Number(productOrParams?.price?.USD) || 0,
  }

  const discountDetails = resolveEffectiveProductDiscount(productOrParams, categoryPromotion, referenceDate)
  const appliedDiscountPercent = discountDetails.discountPercent

  const effectivePriceMinor: MultiCurrencyPrices = {
    SEK: Math.round((originalPriceMinor.SEK * (100 - appliedDiscountPercent)) / 100),
    EUR: Math.round((originalPriceMinor.EUR * (100 - appliedDiscountPercent)) / 100),
    USD: Math.round((originalPriceMinor.USD * (100 - appliedDiscountPercent)) / 100),
  }

  return {
    effectivePriceMinor,
    originalPriceMinor,
    appliedDiscountPercent,
    activeDiscountType: discountDetails.activeDiscountType,
    isKortdatum: discountDetails.isKortdatum,
    badgeText: discountDetails.badgeText,
    deadlineDate: discountDetails.deadlineDate,
  }
}