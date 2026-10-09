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
 * Re-audits an order's lines, tax split, and final capture total after shortage adjustments.
 */
export function recalculateOrderShortage(
  order: IOrder,
  actions: ShortageActionInput[],
  performedBy: string = 'Admin'
) {
  const lineCalculationInputs: LineItemInput[] = []
  const adjustments: IShortageAdjustment[] = []

  // Create a deep copy of items to mutate safely
  // Ensure fulfilledQuantity falls back to quantity if undefined
  const updatedItems: IOrderItem[] = order.items.map((item) => {
    const raw = typeof (item as any).toObject === 'function' ? (item as any).toObject() : item
    return {
      ...raw,
      fulfilledQuantity: typeof raw.fulfilledQuantity === 'number' ? raw.fulfilledQuantity : raw.quantity,
      shortageStatus: raw.shortageStatus || 'NONE',
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
        note: action.note,
      })
    } else if (action.action === 'SUBSTITUTE_ITEM' && action.substitutedProduct) {
      const sub = action.substitutedProduct
      const newQty = Math.max(1, action.adjustedQuantity)

      // Record adjustment audit for original item
      adjustments.push({
        timestamp: new Date(),
        performedBy,
        productId: new mongoose.Types.ObjectId(action.productId),
        action: 'SUBSTITUTE_ITEM',
        originalQuantity: originalQty,
        adjustedQuantity: 0,
        originalUnitPriceMinor: line.unitPriceMinor,
        substitutedProductId: new mongoose.Types.ObjectId(sub._id),
        substitutedSku: sub.sku,
        substitutedUnitPriceMinor: sub.priceMinor,
        note: action.note,
      })

      // Replace active line item with substitution
      updatedItems[itemIndex] = {
        productId: new mongoose.Types.ObjectId(sub._id),
        sku: sub.sku,
        name: sub.name,
        quantity: originalQty,
        fulfilledQuantity: newQty,
        unitPriceMinor: sub.priceMinor,
        momsRate: sub.momsRate,
        shortageStatus: 'SUBSTITUTED',
      }
    }
  }

  // Build lines for recalculating itemsTotal and statutory moms
  let itemsTotalMinor = 0
  for (const item of updatedItems) {
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

  // Shipping fee is kept intact unless the whole order was dropped
  const shippingFeeMinor = itemsTotalMinor > 0 ? order.pricing.shippingFeeMinor : 0
  const grandTotalMinor = itemsTotalMinor + shippingFeeMinor

  // Recalculate moms split conforming to Bokföringslagen
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
    updatedItems,
    shortageAdjustments: [...order.shortageAdjustments, ...adjustments],
    newPricing: {
      itemsTotalMinor,
      shippingFeeMinor,
      grandTotalMinor,
      authorizedTotalMinor: order.pricing.authorizedTotalMinor,
      capturedTotalMinor: grandTotalMinor,
      releasedOrRefundedMinor: Math.max(
        0,
        order.pricing.authorizedTotalMinor - grandTotalMinor
      ),
      taxSplit,
    },
  }
}