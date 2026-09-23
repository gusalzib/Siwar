// tests/unit/inventory.service.spec.ts
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_GLOBAL_SAFETY_BUFFER,
  resolveEffectiveBuffer,
  getAvailableStock,
  getProductAvailability,
  validateCartAddition,
  evaluateCheckoutStock,
  type ProductStockInput,
  type CartItemValidationInput,
} from '../../server/services/inventory.service'

describe('Inventory Service - resolveEffectiveBuffer', () => {
  it('returns the product-level override when a positive number is specified', () => {
    const product: ProductStockInput = { stockQuantity: 10, safetyBuffer: 6 }
    expect(resolveEffectiveBuffer(product)).toBe(6)
  })

  it('honors an explicit buffer override of 0 (disabling the buffer)', () => {
    const product: ProductStockInput = { stockQuantity: 10, safetyBuffer: 0 }
    expect(resolveEffectiveBuffer(product)).toBe(0)
  })

  it('falls back to the global default when safetyBuffer is undefined', () => {
    const product: ProductStockInput = { stockQuantity: 10 }
    expect(resolveEffectiveBuffer(product, 3)).toBe(3)
  })

  it('falls back to the global default when safetyBuffer is null', () => {
    const product: ProductStockInput = { stockQuantity: 10, safetyBuffer: null }
    expect(resolveEffectiveBuffer(product, 3)).toBe(3)
  })

  it('falls back to the global default when safetyBuffer is negative', () => {
    const product: ProductStockInput = { stockQuantity: 10, safetyBuffer: -2 }
    expect(resolveEffectiveBuffer(product, 3)).toBe(3)
  })

  it('falls back to the global default when safetyBuffer is NaN', () => {
    const product: ProductStockInput = { stockQuantity: 10, safetyBuffer: NaN }
    expect(resolveEffectiveBuffer(product, 3)).toBe(3)
  })

  it('uses DEFAULT_GLOBAL_SAFETY_BUFFER when no globalBuffer argument is passed', () => {
    const product: ProductStockInput = { stockQuantity: 10 }
    expect(resolveEffectiveBuffer(product)).toBe(DEFAULT_GLOBAL_SAFETY_BUFFER)
  })
})

describe('Inventory Service - getAvailableStock', () => {
  // AC-1 (Buffer Threshold Cut-off)
  it('AC-1: returns 2 units when totalStock is 5 and safetyBuffer is 3', () => {
    const product: ProductStockInput = { stockQuantity: 5, safetyBuffer: 3 }
    expect(getAvailableStock(product)).toBe(2)
  })

  // AC-2 Availability Formula Check
  it('AC-2: returns 0 units when totalStock equals safetyBuffer (3 units)', () => {
    const product: ProductStockInput = { stockQuantity: 3, safetyBuffer: 3 }
    expect(getAvailableStock(product)).toBe(0)
  })

  it('never returns negative numbers when total stock is below the safety buffer', () => {
    const product: ProductStockInput = { stockQuantity: 1, safetyBuffer: 3 }
    expect(getAvailableStock(product)).toBe(0)
  })

  it('allows all physical units to be sold online when safetyBuffer is explicitly 0', () => {
    const product: ProductStockInput = { stockQuantity: 8, safetyBuffer: 0 }
    expect(getAvailableStock(product)).toBe(8)
  })

  it('correctly uses the fallback global buffer when product-level buffer is omitted', () => {
    const product: ProductStockInput = { stockQuantity: 10 }
    // 10 - 4 = 6
    expect(getAvailableStock(product, 4)).toBe(6)
  })
})

describe('Inventory Service - getProductAvailability', () => {
  it('returns IN_STOCK and allows adding to cart when availableStock > 0', () => {
    const product: ProductStockInput = { stockQuantity: 8, safetyBuffer: 3 }
    const result = getProductAvailability(product)

    expect(result).toEqual({
      totalStock: 8,
      effectiveBuffer: 3,
      availableStock: 5,
      statusCode: 'IN_STOCK',
      canAddToCart: true,
    })
  })

  // AC-2 (Temporarily Out of Stock Online Trigger)
  it('AC-2: returns OUT_OF_STOCK_ONLINE and disables cart button when totalStock equals buffer', () => {
    const product: ProductStockInput = { stockQuantity: 3, safetyBuffer: 3 }
    const result = getProductAvailability(product)

    expect(result.availableStock).toBe(0)
    expect(result.statusCode).toBe('OUT_OF_STOCK_ONLINE')
    expect(result.canAddToCart).toBe(false)
  })

  it('returns OUT_OF_STOCK_ONLINE when total stock is greater than 0 but below the buffer', () => {
    const product: ProductStockInput = { stockQuantity: 2, safetyBuffer: 3 }
    const result = getProductAvailability(product)

    expect(result.availableStock).toBe(0)
    expect(result.statusCode).toBe('OUT_OF_STOCK_ONLINE')
    expect(result.canAddToCart).toBe(false)
  })

  it('returns OUT_OF_STOCK and disables cart button when physical totalStock is 0', () => {
    const product: ProductStockInput = { stockQuantity: 0, safetyBuffer: 3 }
    const result = getProductAvailability(product)

    expect(result.totalStock).toBe(0)
    expect(result.availableStock).toBe(0)
    expect(result.statusCode).toBe('OUT_OF_STOCK')
    expect(result.canAddToCart).toBe(false)
  })

  it('handles negative physical totalStock by returning OUT_OF_STOCK', () => {
    const product: ProductStockInput = { stockQuantity: -2, safetyBuffer: 3 }
    const result = getProductAvailability(product)

    expect(result.statusCode).toBe('OUT_OF_STOCK')
    expect(result.canAddToCart).toBe(false)
    expect(result.availableStock).toBe(0)
  })
})

describe('Inventory Service - validateCartAddition', () => {
  const baseProduct: ProductStockInput = {
    _id: 'prod_123',
    stockQuantity: 7,
    safetyBuffer: 3, // availableStock = 4
  }

  it('approves addition when requested quantity is within available stock', () => {
    const result = validateCartAddition(baseProduct, 3)

    expect(result).toEqual({
      productId: 'prod_123',
      requestedQuantity: 3,
      availableStock: 4,
      isValid: true,
      adjustedQuantity: 3,
      hasAdjustment: false,
      code: 'OK',
    })
  })

  it('clamps quantity and flags EXCEEDS_AVAILABLE_STOCK when request exceeds available units', () => {
    const result = validateCartAddition(baseProduct, 6)

    expect(result).toEqual({
      productId: 'prod_123',
      requestedQuantity: 6,
      availableStock: 4,
      isValid: false,
      adjustedQuantity: 4,
      hasAdjustment: true,
      code: 'EXCEEDS_AVAILABLE_STOCK',
    })
  })

  it('blocks addition and returns OUT_OF_STOCK_ONLINE when total stock is at or below buffer', () => {
    const depletedProduct: ProductStockInput = {
      _id: 'prod_456',
      stockQuantity: 3,
      safetyBuffer: 3, // availableStock = 0
    }
    const result = validateCartAddition(depletedProduct, 1)

    expect(result).toEqual({
      productId: 'prod_456',
      requestedQuantity: 1,
      availableStock: 0,
      isValid: false,
      adjustedQuantity: 0,
      hasAdjustment: true,
      code: 'OUT_OF_STOCK_ONLINE',
    })
  })

  it('rejects non-positive quantities with INVALID_QUANTITY', () => {
    expect(validateCartAddition(baseProduct, 0).code).toBe('INVALID_QUANTITY')
    expect(validateCartAddition(baseProduct, -2).code).toBe('INVALID_QUANTITY')
    expect(validateCartAddition(baseProduct, 1.5).code).toBe('INVALID_QUANTITY')
  })

  it('safely handles missing product _id by defaulting to an empty string', () => {
    const productWithoutId: ProductStockInput = { stockQuantity: 10, safetyBuffer: 2 }
    const result = validateCartAddition(productWithoutId, 2)
    expect(result.productId).toBe('')
  })
})

describe('Inventory Service - evaluateCheckoutStock', () => {
  // AC-3 (Pre-Checkout Boundary Check)
  it('AC-3: rejects checkout and clamps quantity to 0 when in-store sales deplete stock to the buffer', () => {
    const cartItems: CartItemValidationInput[] = [
      { productId: 'prod_halva', requestedQuantity: 2 },
    ]

    // Fresh DB fetch: physical stock reduced to 3, buffer is 3 -> available stock is now 0
    const liveProducts: ProductStockInput[] = [
      { _id: 'prod_halva', stockQuantity: 3, safetyBuffer: 3 },
    ]

    const result = evaluateCheckoutStock(cartItems, liveProducts)

    expect(result.isValid).toBe(false)
    expect(result.hasAdjustments).toBe(true)
    expect(result.summaryMessage).toBe('CART_STOCK_ADJUSTED')

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual({
      productId: 'prod_halva',
      requestedQuantity: 2,
      availableStock: 0,
      isValid: false,
      adjustedQuantity: 0,
      hasAdjustment: true,
      code: 'OUT_OF_STOCK_ONLINE',
    })
  })

  it('rejects checkout and clamps quantity when in-store sales reduce stock partially', () => {
    const cartItems: CartItemValidationInput[] = [
      { productId: 'prod_dates', requestedQuantity: 5 },
    ]

    // Physical stock is 5, buffer is 3 -> available stock is 2
    const liveProducts: ProductStockInput[] = [
      { _id: 'prod_dates', stockQuantity: 5, safetyBuffer: 3 },
    ]

    const result = evaluateCheckoutStock(cartItems, liveProducts)

    expect(result.isValid).toBe(false)
    expect(result.hasAdjustments).toBe(true)
    expect(result.items[0].adjustedQuantity).toBe(2)
    expect(result.items[0].code).toBe('EXCEEDS_AVAILABLE_STOCK')
  })

  it('approves checkout when all cart items are fully available in live stock', () => {
    const cartItems: CartItemValidationInput[] = [
      { productId: 'prod_dates', requestedQuantity: 2 },
      { productId: 'prod_tahini', requestedQuantity: 1 },
    ]

    const liveProducts: ProductStockInput[] = [
      { _id: 'prod_dates', stockQuantity: 10, safetyBuffer: 3 },  // available: 7
      { _id: 'prod_tahini', stockQuantity: 5, safetyBuffer: 2 }, // available: 3
    ]

    const result = evaluateCheckoutStock(cartItems, liveProducts)

    expect(result.isValid).toBe(true)
    expect(result.hasAdjustments).toBe(false)
    expect(result.summaryMessage).toBeUndefined()
    expect(result.items.every((item) => item.isValid)).toBe(true)
  })

  it('handles products missing from database during checkout evaluation', () => {
    const cartItems: CartItemValidationInput[] = [
      { productId: 'prod_deleted', requestedQuantity: 1 },
    ]

    const liveProducts: ProductStockInput[] = [] // Empty DB result

    const result = evaluateCheckoutStock(cartItems, liveProducts)

    expect(result.isValid).toBe(false)
    expect(result.hasAdjustments).toBe(true)
    expect(result.items[0]).toEqual({
      productId: 'prod_deleted',
      requestedQuantity: 1,
      availableStock: 0,
      isValid: false,
      adjustedQuantity: 0,
      hasAdjustment: true,
      code: 'OUT_OF_STOCK_ONLINE',
    })
  })

  it('accepts a Map of liveProducts directly for high-throughput calls', () => {
    const cartItems: CartItemValidationInput[] = [
      { productId: 'p1', requestedQuantity: 1 },
    ]

    const productMap = new Map<string, ProductStockInput>([
      ['p1', { _id: 'p1', stockQuantity: 10, safetyBuffer: 3 }],
    ])

    const result = evaluateCheckoutStock(cartItems, productMap)
    expect(result.isValid).toBe(true)
  })
})