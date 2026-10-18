// server/api/admin/orders/[id]/pack.post.ts
import mongoose from 'mongoose'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { recalculateOrderShortage, computeOrderPricing, type ShortageActionInput } from '~/server/services/fulfillment.service'
import { getPaymentGateway } from '~/server/services/payments'
import { mailService, type EmailLocale } from '~/server/services/mail.service'

interface PackItemInput {
  index?: number
  productId: string
  originalProductId?: string
  fulfilledQuantity: number
  shortageStatus: 'NONE' | 'REDUCED' | 'REMOVED' | 'SUBSTITUTED'
  sku?: string
  name?: { ar: string; sv: string; en: string }
  unitPriceMinor?: number
  momsRate?: 12 | 25
  isPacked?: boolean
}

interface PackOrderBody {
  items?: PackItemInput[]
  actions: ShortageActionInput[]
  markDispatched?: boolean
  trackingCode?: string
}

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const body = await readBody<PackOrderBody>(event)

  const order = await Order.findById(orderId)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  // ──────────────────────────────────────────────────────────────────────
  // 1. Run recalculate FIRST on the untouched DB items so the service
  //    can match new actions against original product IDs and produce
  //    the correct audit trail entries (shortageAdjustments).
  // ──────────────────────────────────────────────────────────────────────
  const { updatedItems, shortageAdjustments } = recalculateOrderShortage(
    order,
    body.actions || [],
    'Admin'
  )

  // ──────────────────────────────────────────────────────────────────────
  // 2. Merge the FULL client item state on top of recalculated items.
  //    The client always holds the correct state: applyShortageAction
  //    mutates it for new actions, and resetLineItem reverts it for
  //    resets. So the client is the source of truth for item identity
  //    and quantities; recalculate was only needed for audit trail +
  //    applying new shortage actions against the original DB items.
  // ──────────────────────────────────────────────────────────────────────
  if (body.items && body.items.length > 0) {
    body.items.forEach((submittedItem, idx) => {
      const targetIndex = typeof submittedItem.index === 'number' ? submittedItem.index : idx
      let match = updatedItems[targetIndex]

      if (!match) {
        match = updatedItems.find(
          (i) =>
            String(i.productId) === submittedItem.productId ||
            (submittedItem.originalProductId && String(i.productId) === submittedItem.originalProductId)
        ) as typeof match
      }

      if (match) {
        // Always sync full item state from client
        match.productId = new mongoose.Types.ObjectId(submittedItem.productId) as any
        match.fulfilledQuantity = submittedItem.fulfilledQuantity
        match.shortageStatus = submittedItem.shortageStatus
        if (typeof submittedItem.isPacked === 'boolean') {
          match.isPacked = submittedItem.isPacked
        }
        if (submittedItem.unitPriceMinor != null) match.unitPriceMinor = submittedItem.unitPriceMinor
        if (submittedItem.momsRate != null) match.momsRate = submittedItem.momsRate
        if (submittedItem.name) match.name = submittedItem.name
        if (submittedItem.sku !== undefined) match.sku = submittedItem.sku

        // Persist or clear the original-product link
        if (submittedItem.originalProductId) {
          match.originalProductId = new mongoose.Types.ObjectId(submittedItem.originalProductId) as any
        } else {
          match.originalProductId = undefined
        }
      }
    })

    // Clean up shortage adjustment audit records for items that the
    // client has reset back to NONE. We compare against the DB's
    // items to only target lines that actually had a shortage before.
    const dbStatusByProductId = new Map<string, string>()
    for (const dbItem of order.items) {
      dbStatusByProductId.set(String(dbItem.productId), dbItem.shortageStatus || 'NONE')
      if (dbItem.originalProductId) {
        dbStatusByProductId.set(String(dbItem.originalProductId), dbItem.shortageStatus || 'NONE')
      }
    }

    const resetProductIds = body.items
      .filter((si) => {
        if (si.shortageStatus !== 'NONE') return false
        // Only count as a reset if the DB had a non-NONE status for this product
        const dbStatus = dbStatusByProductId.get(si.productId)
          || (si.originalProductId ? dbStatusByProductId.get(si.originalProductId) : undefined)
        return dbStatus && dbStatus !== 'NONE'
      })
      .flatMap((si) => [si.productId, si.originalProductId].filter(Boolean) as string[])

    if (resetProductIds.length > 0) {
      const resetSet = new Set(resetProductIds)
      shortageAdjustments.splice(
        0,
        shortageAdjustments.length,
        ...shortageAdjustments.filter(
          (adj) =>
            !resetSet.has(String(adj.productId)) &&
            !resetSet.has(String(adj.substitutedProductId || ''))
        )
      )
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 3. Recompute pricing from the FINAL merged item state so that
  //    financial totals correctly reflect any resets (restored items)
  //    or new shortages applied above.
  // ──────────────────────────────────────────────────────────────────────
  const finalPricing = computeOrderPricing(
    updatedItems,
    order.customer?.fulfillmentMethod,
    order.pricing?.shippingFeeMinor || 0,
    order.pricing?.authorizedTotalMinor || 0
  )

  const capturedTotal = finalPricing.capturedTotalMinor ?? finalPricing.grandTotalMinor
  const releasedAmount = finalPricing.releasedOrRefundedMinor ?? 0

  const authorizedHold = order.pricing.authorizedTotalMinor ?? order.pricing.grandTotalMinor
  const safeCaptureTotal = Math.min(capturedTotal, authorizedHold)

  // ──────────────────────────────────────────────────────────────────────
  // 4. Dispatch & Settlement handling
  // ──────────────────────────────────────────────────────────────────────
  if (body.markDispatched) {
    if (capturedTotal > authorizedHold) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Kan inte skicka ordern: Ersättningsvaran överstiger kundens auktoriserade belopp.',
      })
    }

    if (capturedTotal === 0) {
      if (order.paymentId) {
        const gateway = getPaymentGateway(order.paymentProvider)
        if (order.paymentProvider === 'STRIPE') {
          await gateway.cancelAuthorization(order.paymentId)
        } else if (order.paymentProvider === 'SWISH' && gateway.refundPayment) {
          await gateway.refundPayment({
            paymentId: order.paymentId,
            orderReference: order.orderReference,
            amountMinor: order.pricing.authorizedTotalMinor,
            reason: `Ordern avbruten pga total varubrist (${order.orderReference})`,
          })
        }
      }
      order.fulfillmentStatus = 'CANCELLED'
      order.paymentStatus = 'CANCELLED'
    } else {
      const gateway = getPaymentGateway(order.paymentProvider)
      if (order.paymentProvider === 'STRIPE' && order.paymentStatus === 'AUTHORIZED') {
        const captureOk = await gateway.captureFunds(order.paymentId!, safeCaptureTotal)
        if (!captureOk) {
          throw createError({
            statusCode: 502,
            statusMessage: `Stripe capture failed for ${order.orderReference}`,
          })
        }
      } else if (order.paymentProvider === 'SWISH' && releasedAmount > 0 && gateway.refundPayment) {
        await gateway.refundPayment({
          paymentId: order.paymentId!,
          orderReference: order.orderReference,
          amountMinor: releasedAmount,
          reason: `Prisjustering för varubrist i order ${order.orderReference}`,
        })
      }

      order.fulfillmentStatus = 'DISPATCHED'
      order.paymentStatus = releasedAmount > 0 ? 'PARTIALLY_CAPTURED' : 'CAPTURED'
      order.dispatchedAt = new Date()
    }

    // Rebalance inventory for removed/reduced items
    for (const action of body.actions || []) {
      if (action.action === 'REMOVE_LINE' || action.action === 'REDUCE_QUANTITY') {
        const originalItem = order.items.find((i) => String(i.productId) === action.productId)
        if (originalItem) {
          const droppedQty =
            originalItem.quantity - (action.action === 'REMOVE_LINE' ? 0 : action.adjustedQuantity)
          if (droppedQty > 0) {
            await Product.updateOne(
              { _id: action.productId },
              { $inc: { stockQuantity: droppedQty } }
            )
          }
        }
      }
    }
  } else {
    const allPacked = updatedItems.every(
      (item) => item.fulfilledQuantity === 0 || item.isPacked === true
    )
    order.fulfillmentStatus = allPacked ? 'PACKED' : 'PENDING_PACKING'
  }

  // ──────────────────────────────────────────────────────────────────────
  // 5. Save order state
  // ──────────────────────────────────────────────────────────────────────
  order.items = updatedItems as any
  order.markModified('items')
  order.shortageAdjustments = shortageAdjustments
  order.markModified('shortageAdjustments')
  finalPricing.capturedTotalMinor = safeCaptureTotal
  order.pricing = finalPricing
  order.markModified('pricing')
  order.packedAt = new Date()

  await order.save()

  if (releasedAmount > 0 && body.actions && body.actions.length > 0) {
    console.info(`[Shortage Notification Queued] Customer: ${order.customer.email} | Released: ${releasedAmount / 100} SEK`)
  }
  // Trigger post-fulfillment notices asynchronously
  try {
    const preferredLocale = (order.customerLocale || 'sv') as EmailLocale

    if (body.markDispatched) {
      if (order.customer.fulfillmentMethod === 'DELIVERY') {
        // Carrier Dispatch Email with tracking code
        await mailService.sendOrderDispatched(
          {
            order,
            trackingCode: body.trackingCode, // e.g. PostNord Kolli-ID
            carrier: 'PostNord',
          },
          preferredLocale
        )
      }
    } else if (order.fulfillmentStatus === 'PACKED' && order.customer.fulfillmentMethod === 'PICKUP') {
      // In-store pickup notification (AC-4)
      await mailService.sendReadyForPickup(order, preferredLocale)
    }
  } catch (mailErr) {
    console.error('[MailService] Failed to send transactional notice:', mailErr)
  }
  return {
    success: true,
    orderReference: order.orderReference,
    capturedTotalMinor: safeCaptureTotal,
    releasedAmountMinor: releasedAmount,
    fulfillmentStatus: order.fulfillmentStatus,
  }
})