// server/services/inventory.service.ts

/**
 * 1. Constants & Defaults
 */

// Default buffer applied when a product does not specify an explicit override
export const DEFAULT_GLOBAL_SAFETY_BUFFER = 5

/**
 * Machine-readable inventory status codes.
 * Passed to the frontend to trigger UI styles and i18n translation keys.
 */
export type InventoryStatusCode =
  | 'IN_STOCK'             // availableStock > 0
  | 'OUT_OF_STOCK_ONLINE'  // totalStock <= buffer, but totalStock > 0
  | 'OUT_OF_STOCK'         // totalStock === 0


  /**
 * Machine-readable outcome codes for cart additions and quantity adjustments.
 * Matches i18n translation keys in the frontend.
 */
export type CartValidationCode =
  | 'OK'                      // Requested quantity is fully available
  | 'EXCEEDS_AVAILABLE_STOCK' // Available stock is greater than 0, but less than requested
  | 'OUT_OF_STOCK_ONLINE'     // Available stock is 0 (total stock at or below safety buffer)
  | 'INVALID_QUANTITY'        // Requested quantity is <= 0 or not an integer

/**
 * 2. Type Definitions & Contracts
 */

/**
 * Minimal product shape required to compute stock availability.Decouples the inventory service from Mongoose and the database schema. In MongoDB, your full Product document contains multilingual descriptions, image arrays, allergen references, 
 * and nutritional tables.
 * If inventory.service.ts required the full IProduct document, every stock check would have to fetch the entire document.
 */
export interface ProductStockInput {
  _id?: string | unknown
  stockQuantity: number // The single source of truth for physical inventory recorded on the shelf.
  safetyBuffer?: number | null // An optional product-level override. It is nullable so that products without a specific threshold can seamlessly fall back to the storewide global default.
}

/**
 * Acts as the consolidated response model returned by the live availability API endpoint and consumed by Vue product pages. 
 * It pre-computes presentation states on the server so frontend components never have to re-implement inventory formulas.
 */
export interface ProductAvailability {
  totalStock: number // The recorded physical inventory, useful for admin dashboards or back-office inspection.
  effectiveBuffer: number // Reveals the exact buffer resolved (whether from the product override or the global default), making calculation auditing transparent.
  availableStock: number // Computed as max(0, totalStock - effectiveBuffer), this is the actual number of units available for purchase online.
  statusCode: InventoryStatusCode // Maps directly to frontend i18n translation keys like IN_STOCK or OUT_OF_STOCK_ONLINE, driving visual status badges.
  canAddToCart: boolean // A boolean flag used by Vue components to conditionally enable or disable the add-to-cart button.
}

/**
 * Defines the minimal payload sent across the network when a shopper adds an item to their cart or when the frontend 
 * submits the active cart for pre-checkout evaluation. Isolates the untrusted client payload from internal system fields. 
 * The browser only submits what it intends to purchase; it cannot manipulate stock values, buffers, or price calculations.
 */
export interface CartItemValidationInput {
  productId: string
  requestedQuantity: number // The quantity the user wants to buy.
}

/**
 * Evaluates the boundary between requested line quantities and live warehouse inventory. 
 * It handles the scenario where an in-store sale occurs while a customer is browsing.
 */
export interface CartItemStockValidation {
  productId: string
  requestedQuantity: number
  availableStock: number
  isValid: boolean // isValid: true if requestedQuantity <= availableStock; false if stock was depleted below the requested quantity.
  adjustedQuantity: number // The self-healing clamp value. If a user requested 3 units but only 1 remains above the safety buffer, this value is set to 1 (or 0 if at or below the buffer).
  hasAdjustment: boolean // A quick boolean allowing the cart store to detect changes without re-comparing old and new numbers manually.
  code: CartValidationCode
}

/**
 * Directly implements Acceptance Criterion 3 (AC-3: Pre-Checkout Boundary Check). 
 * Before initializing payment sessions with Swish or card gateways, the checkout controller must evaluate the entire cart in one atomic pass.
 */
export interface CheckoutStockValidationResult {
  isValid: boolean // The primary order guard. If any single line item in the cart violates available stock thresholds, isValid evaluates to false, preventing the creation of payment sessions.
  items: CartItemStockValidation[] // The array of individual line evaluations (CartItemStockValidation[]), giving the frontend cart store the exact data needed to update local cart quantities to newly available levels automatically.
  hasAdjustments: boolean // Signals the checkout UI to interrupt the standard checkout progression, display an informative banner to the shopper, and require confirmation of the adjusted cart prior to payment.
  summaryMessage?: string // An aggregated alert message summarizing the order conflict for error handling and audit logging.
}

/**
 * 3. Exported Service Function Skeletons
 */

/**
 * Resolves the effective buffer to use for a given product.
 * Returns the product-level override if defined; otherwise falls back to global default.
 *
 * @param product - Target product containing optional safetyBuffer override
 * @param globalBuffer - Global fallback buffer (defaults to DEFAULT_GLOBAL_SAFETY_BUFFER)
 * @returns The resolved buffer number
 */
export function resolveEffectiveBuffer(
  product: ProductStockInput,
  globalBuffer: number = DEFAULT_GLOBAL_SAFETY_BUFFER
): number {

    // Check that product-level buffer is:
    // 1. A number type (excludes null, undefined, strings)
    // 2. A valid numeric value (excludes NaN)
    // 3. Non-negative (allows 0 to disable buffer, rejects negative numbers)
  if (typeof product.safetyBuffer === 'number' && !Number.isNaN(product.safetyBuffer) && product.safetyBuffer >= 0) {
    return product.safetyBuffer;
  }
  return globalBuffer;
}

/**
 * Computes available online stock using the safety buffer formula:
 * Available Stock = max(0, Total Stock - Buffer).
 *
 * @param product - Target product with stockQuantity and optional safetyBuffer
 * @param globalBuffer - Fallback safety buffer threshold
 * @returns Units available for online purchase (integer >= 0)
 */
export function getAvailableStock(
  product: ProductStockInput,
  globalBuffer: number = DEFAULT_GLOBAL_SAFETY_BUFFER
): number {

  const effectivebuffer = resolveEffectiveBuffer(product, globalBuffer);

  return Math.max(0, product.stockQuantity - effectivebuffer);
}

/**
 * Produces complete storefront flags including "Tillfälligt slut online" badge trigger
 * and cart button disabled state (AC-1, AC-2).
 *
 * @param product - Target product data
 * @param globalBuffer - Fallback safety buffer threshold
 * @returns Consolidated availability flags and display metadata
 */
export function getProductAvailability(
  product: ProductStockInput,
  globalBuffer: number = DEFAULT_GLOBAL_SAFETY_BUFFER
): ProductAvailability {


    const totalStock = product.stockQuantity;
    const effectiveBuffer = resolveEffectiveBuffer(product, globalBuffer);
    const availableStock = getAvailableStock(product, globalBuffer); 

    /**
     * Declares a mutable (reassignable) variable in JavaScript. 
     * You use let instead of const here because the value may need to change later in the function (e.g., reassigned to 'OUT_OF_STOCK_ONLINE' or 'OUT_OF_STOCK' if inventory conditions fail).
     * In plain JavaScript, variables can hold anything (numbers, strings, booleans, objects) and change types at any time.
     * The colon (:) tells TypeScript: "Restrict this variable strictly to the InventoryStatusCode type."
     * Because InventoryStatusCode is a union type ('IN_STOCK' | 'OUT_OF_STOCK_ONLINE' | 'OUT_OF_STOCK'), TypeScript will throw a
     *  compile-time error if anyone tries to assign an unsupported string (like 'AVAILABLE', 'SOLD_OUT', or a typo like 'IN_STOK').
     */
    let statusCode : InventoryStatusCode = 'IN_STOCK';


    let canAddToCart = true;


    if (totalStock <= 0) {
        statusCode = 'OUT_OF_STOCK'
        canAddToCart = false;
    }else if (availableStock <= 0) {
        // this means the totalStock is greater than 0, but within or below the safety buffer
        statusCode = 'OUT_OF_STOCK_ONLINE'
        canAddToCart = false;
    }

    // In modern JavaScript and TypeScript, writing totalStock, inside an object is shorthand for totalStock: totalStock
    return {
        totalStock,
        effectiveBuffer,
        availableStock,
        statusCode,
        canAddToCart
    }
}

/**
 * Validates whether a requested cart quantity can be fulfilled by online stock.
 * Used when adding items to cart or modifying line item quantities.
 *
 * @param product - Target product data
 * @param requestedQuantity - Desired purchase quantity
 * @param globalBuffer - Fallback safety buffer threshold
 * @returns Item-level validation with adjusted quantity if requested exceeds stock
 */
export function validateCartAddition(
  product: ProductStockInput,
  requestedQuantity: number,
  globalBuffer: number = DEFAULT_GLOBAL_SAFETY_BUFFER
): CartItemStockValidation {

    const availableStock = getAvailableStock(product, globalBuffer); 

    // Ternary check: If product._id is truthy, cast it (e.g., MongoDB ObjectId or string) to a string primitive; 
    // otherwise, fall back to an empty string ('') to prevent String(undefined) evaluating to the literal text "undefined".
    let productId = product._id ? String(product._id) : '';

    // Guard: Zero or negative quantities are invalid
    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
        return {
            productId,
            requestedQuantity, 
            availableStock,
            isValid: false,
            adjustedQuantity: 0,
            hasAdjustment: true,
            code: 'INVALID_QUANTITY'
        }
    }

    // Case: Available stock satisfies the entire request
    if (requestedQuantity <= availableStock) {
        return {
            productId,
            requestedQuantity,
            availableStock,
            isValid: true,
            adjustedQuantity: requestedQuantity,
            hasAdjustment: false,
            code: 'OK'
        }

    }
    // Stock is completely exhausted online (at or below buffer)
    if (availableStock === 0) {
        return {
            productId,
            requestedQuantity,
            availableStock,
            isValid: false,
            adjustedQuantity: 0,
            hasAdjustment: true,
            code: 'OUT_OF_STOCK_ONLINE',
        }
    }

  return {
    productId: productId,
    requestedQuantity,
    availableStock,
    isValid: false,
    adjustedQuantity: availableStock,
    hasAdjustment: true,
    code: 'EXCEEDS_AVAILABLE_STOCK'

  }
}

/**
 * Evaluates full cart items against live database records prior to payment authorization (AC-3).
 * Detects in-store drift, flags adjustments, and provides corrected quantities.
 * Instead, it is designed as a pure in-memory function. You query MongoDB before calling this function and pass the fetched records into liveProducts. 
 * This keeps our business math 100% testable without needing a running database or mock connections.
 *
 * @param cartItems - Array of customer cart items with desired quantities
 * @param liveProducts - Map or array of fresh product documents fetched from database
 * @param globalBuffer - Fallback safety buffer threshold
 * @returns Re-evaluation verdict with updated quantities and customer messaging
 */
export function evaluateCheckoutStock(
  cartItems: CartItemValidationInput[],
  liveProducts: Map<string, ProductStockInput> | ProductStockInput[],
  globalBuffer: number = DEFAULT_GLOBAL_SAFETY_BUFFER
): CheckoutStockValidationResult {
  // TODO: Match each cart item to live product data, calculate adjusted availableStock,
  // and flag order rejection if any line item changed due to physical store sales

  // Normalize liveProducts into a Map for fast O(1) lookups by IDs. 
  // If it is already a Map, use it; if it is an Array, convert it into a Map
  const productMap: Map<string, ProductStockInput> = liveProducts instanceof Map ? liveProducts : new Map(liveProducts.map((p) => [String(p._id), p]));

  const items: CartItemStockValidation[] = [];

  // Evaluate each cart item line against the fresh product data
  for (const cartItem of cartItems) {
    const product = productMap.get(cartItem.productId);

    // Edge case: Product no longer exists in the db
    if (!product) {
        items.push({
            productId: cartItem.productId,
            requestedQuantity: cartItem.requestedQuantity,
            availableStock: 0,
            isValid: false,
            adjustedQuantity: 0,
            hasAdjustment: true,
            code: 'OUT_OF_STOCK_ONLINE'
        })
        continue // to the next item
    }

    // reuse validateCartAddition for consistent single-item validation rules
    const validation = validateCartAddition(product, cartItem.requestedQuantity, globalBuffer)
    items.push(validation);
  }

  // Determine if the entire checkout order can proceed (AC-3)
  // hasAdjustments is true if ANY item was modified
  const hasAdjustments = items.some((item) => item.hasAdjustment)

  // isValid is true ONLY IF every single item it valid
  const isValid = items.every((item) => item.isValid);

  return {
    isValid,
    items, 
    hasAdjustments, 
    summaryMessage: hasAdjustments ? 'CART_STOCK_ADJUSTED' : undefined
  }

}