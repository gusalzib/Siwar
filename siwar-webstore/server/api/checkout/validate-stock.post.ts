// server/api/checkout/validate-stock.post.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '../../../server/models/Product'
import {
  evaluateCheckoutStock,
  type CartItemValidationInput,
  type CheckoutStockValidationResult,
} from '../../../server/services/inventory.service'
import { isDiscountActive } from '../../../server/services/pricing.service'

export interface CartItemPriceValidationInput extends CartItemValidationInput {
  currentPriceMinor?: number
}

export interface PriceAdjustment {
  productId: string
  oldPriceMinor: number
  newPriceMinor: number
  newDiscount: number
}

export interface ExtendedCheckoutValidationResult extends CheckoutStockValidationResult {
  hasPriceAdjustments?: boolean
  priceAdjustments?: PriceAdjustment[]
}

interface ValidateStockRequestBody {
  items: CartItemPriceValidationInput[]
  currency?: 'SEK' | 'EUR' | 'USD'
}

export default defineEventHandler(
  async (event): Promise<ExtendedCheckoutValidationResult> => {
    // Read and parse the JSON payload from the POST request body
    const body = await readBody<ValidateStockRequestBody>(event)
    const cartItems = body?.items
    const currency = body?.currency || 'SEK'

    // Validate incoming request body structure
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cart items array is required',
      })
    }

    // Extract IDs and filter out invalid ObjectIds 
    const productIds = cartItems
      .map((item) => item.productId)
      .filter((id) => isValidObjectId(id))

    // Batch-fetch only the requested items from MongoDB in a single query
    const liveProducts = await Product.find({
      _id: { $in: productIds },
    })
      .select('_id stockQuantity safetyBuffer price discount discountStartsAt discountExpiresAt')
      .lean()

    // Evaluate stock availability using the pure service function
    const validationResult = evaluateCheckoutStock(cartItems, liveProducts)

    // Evaluate price invariance (AC-3: Detect expired discounts prior to payment authorization)
    const now = new Date()
    const priceAdjustments: PriceAdjustment[] = []
    const liveProductMap = new Map(liveProducts.map((p) => [String(p._id), p]))

    for (const item of cartItems) {
      const product = liveProductMap.get(item.productId)
      if (!product || typeof item.currentPriceMinor !== 'number') continue

      const baseUnitPrice = product.price?.[currency] ?? product.price?.SEK ?? 0
      const isPromoActive = isDiscountActive(
        product.discount,
        product.discountStartsAt,
        product.discountExpiresAt,
        now
      )
      const discount = isPromoActive ? (product.discount || 0) : 0
      const liveUnitPrice = discount > 0 ? Math.round(baseUnitPrice * (1 - discount / 100)) : baseUnitPrice

      if (item.currentPriceMinor !== liveUnitPrice) {
        priceAdjustments.push({
          productId: item.productId,
          oldPriceMinor: item.currentPriceMinor,
          newPriceMinor: liveUnitPrice,
          newDiscount: discount,
        })
      }
    }

    const hasPriceAdjustments = priceAdjustments.length > 0
    const isValid = validationResult.isValid && !hasPriceAdjustments

    // If stock depleted or promotional price expired, return HTTP 409 Conflict
    if (!isValid) {
      setResponseStatus(event, 409)
    }

    return {
      ...validationResult,
      isValid,
      hasAdjustments: validationResult.hasAdjustments || hasPriceAdjustments,
      hasPriceAdjustments,
      priceAdjustments,
      summaryMessage: hasPriceAdjustments
        ? 'CART_PRICE_ADJUSTED'
        : validationResult.summaryMessage,
    }
  }
)
