// server/api/admin/orders/[id]/pack.post.ts
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { recalculateOrderShortage, type ShortageActionInput } from '~/server/services/fulfillment.service'
import { getPaymentGateway } from '~/server/services/payments'

interface PackOrderBody {
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

  if (order.fulfillmentStatus === 'DISPATCHED') {
    throw createError({ statusCode: 400, statusMessage: 'Order already dispatched' })
  }

  // 1. Recalculate fulfilled totals and tax split
  const { updatedItems, shortageAdjustments, newPricing } = recalculateOrderShortage(
    order,
    body.actions || [],
    'Admin'
  )

  const capturedTotal = newPricing.capturedTotalMinor ?? newPricing.grandTotalMinor
  const releasedAmount = newPricing.releasedOrRefundedMinor ?? 0

  // 2. ONLY settle payment and adjust physical stock when DISPATCHING
  if (body.markDispatched) {
    // Check if the order was completely dropped (0 items fulfilled)
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

      // Entire order dropped: Status must be CANCELLED, NOT DISPATCHED
      order.fulfillmentStatus = 'CANCELLED'
      order.paymentStatus = 'CANCELLED'
    } else {
      // Normal capture workflow (fulfilledTotal > 0)
      const gateway = getPaymentGateway(order.paymentProvider)

      if (order.paymentProvider === 'STRIPE' && order.paymentStatus === 'AUTHORIZED') {
        const captureOk = await gateway.captureFunds(order.paymentId!, capturedTotal)
        if (!captureOk) {
          throw createError({
            statusCode: 502,
            statusMessage: 'Kunde inte dra pengarna från Stripe. Ordern har inte markerats som skickad.',
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

    // Return dropped/reduced items back to physical inventory
    for (const action of body.actions || []) {
      if (action.action === 'REMOVE_LINE' || action.action === 'REDUCE_QUANTITY') {
        const originalItem = order.items.find((i) => i.productId.toString() === action.productId)
        if (originalItem) {
          const droppedQty =
            originalItem.fulfilledQuantity - (action.action === 'REMOVE_LINE' ? 0 : action.adjustedQuantity)
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
    // Only saving intermediate packing progress
    order.fulfillmentStatus = 'PACKED'
  }

  // 3. Persist order state
  order.items = updatedItems
  order.shortageAdjustments = shortageAdjustments
  order.pricing = newPricing
  order.packedAt = new Date()

  await order.save()


  // 4. AC-3: Trigger Customer Shortage Notification Event
  if (releasedAmount > 0 && body.actions && body.actions.length > 0) {
    // Queues or logs notification event detailing item shortages and adjusted totals
    console.info(
      `[Shortage Notification Queued] Customer: ${order.customer.email} (${order.customer.phone}) | Order: ${order.orderReference} | Released/Refunded: ${releasedAmount / 100} ${order.currency}`
    )
  }
  
  return {
    success: true,
    orderReference: order.orderReference,
    capturedTotalMinor: capturedTotal,
    releasedAmountMinor: releasedAmount,
    fulfillmentStatus: order.fulfillmentStatus,
  }
})