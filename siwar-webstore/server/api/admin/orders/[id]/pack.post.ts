// server/api/admin/orders/[id]/pack.post.ts
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { recalculateOrderShortage, type ShortageActionInput } from '~/server/services/fulfillment.service'
import { getPaymentGateway } from '~/server/services/payments'

interface PackItemInput {
  productId: string
  fulfilledQuantity: number
  shortageStatus: 'NONE' | 'REDUCED' | 'REMOVED' | 'SUBSTITUTED'
  sku?: string
  name?: { ar: string; sv: string; en: string }
  unitPriceMinor?: number
  momsRate?: 12 | 25
}

interface PackOrderBody {
  items?: PackItemInput[]
  actions: ShortageActionInput[]
  markDispatched?: boolean
}

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const body = await readBody<PackOrderBody>(event)

  const order = await Order.findById(orderId)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  // 1. If explicit items are passed from the client, sync them to order.items
  if (body.items && body.items.length > 0) {
    for (const submittedItem of body.items) {
      const match = order.items.find((i) => String(i.productId) === submittedItem.productId)
      if (match) {
        match.fulfilledQuantity = submittedItem.fulfilledQuantity
        match.shortageStatus = submittedItem.shortageStatus
        if (submittedItem.unitPriceMinor) match.unitPriceMinor = submittedItem.unitPriceMinor
        if (submittedItem.momsRate) match.momsRate = submittedItem.momsRate
        if (submittedItem.name) match.name = submittedItem.name
        if (submittedItem.sku) match.sku = submittedItem.sku
      }
    }
  }

  // 2. Recalculate financial settlement and Moms
  const { updatedItems, shortageAdjustments, newPricing } = recalculateOrderShortage(
    order,
    body.actions || [],
    'Admin'
  )

  const capturedTotal = newPricing.capturedTotalMinor ?? newPricing.grandTotalMinor
  const releasedAmount = newPricing.releasedOrRefundedMinor ?? 0

  // 3. Dispatch & Settlement handling
  if (body.markDispatched) {
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
        const captureOk = await gateway.captureFunds(order.paymentId!, capturedTotal)
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
    order.fulfillmentStatus = 'PACKED'
  }

  // 4. Save order state
  order.items = updatedItems
  order.shortageAdjustments = shortageAdjustments
  order.pricing = newPricing
  order.packedAt = new Date()

  await order.save()

  return {
    success: true,
    orderReference: order.orderReference,
    capturedTotalMinor: capturedTotal,
    releasedAmountMinor: releasedAmount,
    fulfillmentStatus: order.fulfillmentStatus,
  }
})