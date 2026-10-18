// server/services/fulfillment.service.ts
import mongoose from 'mongoose'
import type { IOrder, IOrderItem, IShortageAdjustment } from '~/server/models/Order'
import { calculateMomsSplit, type LineItemInput } from '~/server/services/pricing.service'

export interface ShortageActionInput {
  productId: string
  action: 'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'
  adjustedQuantity: number
  substitutedProduct?: {
    _id: string
    sku?: string
    name: { ar: string; sv: string; en: string }
    priceMinor: number
    momsRate: 12 | 25
  }
  note?: string
}

/**
 * Compute pricing (item totals, shipping, moms, capture amounts) from a set of items.
 * Extracted so it can be called independently after client-state merges.
 */
export function computeOrderPricing(
  items: IOrderItem[],
  fulfillmentMethod: string | undefined,
  existingShippingFee: number,
  authorizedTotalMinor: number
) {
  const lineCalculationInputs: LineItemInput[] = []
  let itemsTotalMinor = 0

  for (const item of items) {
    if (item.fulfilledQuantity > 0) {
      const lineGross = item.unitPriceMinor * item.fulfilledQuantity
      itemsTotalMinor += lineGross
      lineCalculationInputs.push({
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.fulfilledQuantity,
        momsRate: item.momsRate,
      })
    }
  }

  // Dynamic shipping recalculation:
  // 1. If 0 items or In-Store Pickup, shipping is 0
  // 2. If delivery, free shipping threshold is 899 SEK (89900 öre)
  let shippingFeeMinor = 0
  if (itemsTotalMinor > 0 && fulfillmentMethod === 'DELIVERY') {
    if (itemsTotalMinor >= 89900) {
      shippingFeeMinor = 0
    } else {
      shippingFeeMinor = existingShippingFee > 0 ? existingShippingFee : 7700
    }
  }

  const grandTotalMinor = itemsTotalMinor + shippingFeeMinor

  // Recalculate moms split
  const rawMoms = calculateMomsSplit(lineCalculationInputs, shippingFeeMinor)

  const taxSplit = {
    totalMomsMinor: rawMoms.totalMomsMinor,
    moms12: {
      netAmountMinor: rawMoms.moms12.taxableNetMinor,
      momsAmountMinor: rawMoms.moms12.momsAmountMinor,
    },
    moms25: {
      netAmountMinor: rawMoms.moms25.taxableNetMinor,
      momsAmountMinor: rawMoms.moms25.momsAmountMinor,
    },
  }

  return {
    itemsTotalMinor,
    shippingFeeMinor,
    grandTotalMinor,
    authorizedTotalMinor: authorizedTotalMinor || grandTotalMinor,
    capturedTotalMinor: grandTotalMinor,
    releasedOrRefundedMinor: Math.max(
      0,
      (authorizedTotalMinor || grandTotalMinor) - grandTotalMinor
    ),
    taxSplit,
  }
}

export function recalculateOrderShortage(
  order: IOrder,
  actions: ShortageActionInput[],
  performedBy: string = 'Admin'
) {
  const adjustments: IShortageAdjustment[] = []

  // Create a deep copy of items to mutate safely
  const updatedItems: IOrderItem[] = order.items.map((item) => {
    const raw = typeof (item as any).toObject === 'function' ? (item as any).toObject() : item
    return {
      ...raw,
      fulfilledQuantity: typeof raw.fulfilledQuantity === 'number' ? raw.fulfilledQuantity : raw.quantity,
      shortageStatus: raw.shortageStatus || 'NONE',
      isPacked: typeof raw.isPacked === 'boolean' ? raw.isPacked : false,
    }
  })

  for (const action of actions) {
    const itemIndex = updatedItems.findIndex(
      (i) => i.productId.toString() === action.productId
    )
    if (itemIndex === -1) continue

    const line = updatedItems[itemIndex]
    if (!line) continue
    const originalQty = line.fulfilledQuantity

    if (action.action === 'REMOVE_LINE') {
      line.fulfilledQuantity = 0
      line.shortageStatus = 'REMOVED'

      adjustments.push({
        timestamp: new Date(),
        performedBy,
        productId: new mongoose.Types.ObjectId(action.productId),
        action: 'REMOVE_LINE',
        originalQuantity: originalQty,
        adjustedQuantity: 0,
        originalUnitPriceMinor: line.unitPriceMinor,
        originalSku: line.sku,
        originalName: line.name ? { ...line.name } : undefined,
        originalMomsRate: line.momsRate,
        note: action.note,
      })
    } else if (action.action === 'REDUCE_QUANTITY') {
      const newQty = Math.max(0, Math.min(action.adjustedQuantity, originalQty))
      line.fulfilledQuantity = newQty
      line.shortageStatus = newQty === 0 ? 'REMOVED' : 'REDUCED'

      adjustments.push({
        timestamp: new Date(),
        performedBy,
        productId: new mongoose.Types.ObjectId(action.productId),
        action: 'REDUCE_QUANTITY',
        originalQuantity: originalQty,
        adjustedQuantity: newQty,
        originalUnitPriceMinor: line.unitPriceMinor,
        originalSku: line.sku,
        originalName: line.name ? { ...line.name } : undefined,
        originalMomsRate: line.momsRate,
        note: action.note,
      })
    } else if (action.action === 'SUBSTITUTE_ITEM' && action.substitutedProduct) {
      const sub = action.substitutedProduct
      const newQty = Math.max(1, action.adjustedQuantity)

      adjustments.push({
        timestamp: new Date(),
        performedBy,
        productId: new mongoose.Types.ObjectId(action.productId),
        action: 'SUBSTITUTE_ITEM',
        originalQuantity: originalQty,
        adjustedQuantity: 0,
        originalUnitPriceMinor: line.unitPriceMinor,
        originalSku: line.sku,
        originalName: line.name ? { ...line.name } : undefined,
        originalMomsRate: line.momsRate,
        substitutedProductId: new mongoose.Types.ObjectId(sub._id),
        substitutedSku: sub.sku,
        substitutedUnitPriceMinor: sub.priceMinor,
        note: action.note,
      })

      updatedItems[itemIndex] = {
        productId: new mongoose.Types.ObjectId(sub._id),
        originalProductId: line.productId, // preserve link to the original product
        sku: sub.sku,
        name: sub.name,
        quantity: originalQty,
        fulfilledQuantity: newQty,
        unitPriceMinor: sub.priceMinor,
        momsRate: sub.momsRate,
        shortageStatus: 'SUBSTITUTED',
        isPacked: line.isPacked ?? false,
      }
    }
  }

  // Compute pricing from the updated items
  const newPricing = computeOrderPricing(
    updatedItems,
    order.customer?.fulfillmentMethod,
    order.pricing?.shippingFeeMinor || 0,
    order.pricing?.authorizedTotalMinor || 0
  )

  return {
    updatedItems,
    shortageAdjustments: [...(order.shortageAdjustments || []), ...adjustments],
    newPricing,
  }
}