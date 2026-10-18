// server/api/admin/orders/[id]/cancel.post.ts
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { getPaymentGateway } from '~/server/services/payments'
import { sanitizeSwishMessage } from '~/server/utils/swish'

interface CancelOrderBody {
  reason?: string
}

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const body = await readBody<CancelOrderBody>(event)

  const order = await Order.findById(orderId)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Ordern hittades inte' })
  }

  if (order.fulfillmentStatus === 'DISPATCHED') {
    throw createError({ statusCode: 400, statusMessage: 'Kan inte avbryta en redan skickad order' })
  }

  if (order.fulfillmentStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, statusMessage: 'Ordern är redan avbruten' })
  }

  // 1. Release hold or refund through Payment Gateway
  if (order.paymentId) {
    const gateway = getPaymentGateway(order.paymentProvider)
    if (order.paymentProvider === 'STRIPE' && order.paymentStatus === 'AUTHORIZED') {
      try {
        await gateway.cancelAuthorization(order.paymentId)
      } catch (err: any) {
        console.warn(`[Stripe Void Warning] ${err.message}`)
      }
    } else if (order.paymentProvider === 'SWISH' && gateway.refundPayment) {
      await gateway.refundPayment({
        paymentId: order.paymentId,
        orderReference: order.orderReference,
        amountMinor: order.pricing.authorizedTotalMinor,
        reason: sanitizeSwishMessage(body.reason, `Order avbruten av admin (${order.orderReference})`),
      })
    }
  }

  // 2. Return physical items to inventory (if stock was decremented during authorization)
  if (order.inventoryDecremented) {
    for (const item of order.items) {
      // Re-increment based on the quantity originally held
      const qtyToRestore = item.quantity
      if (qtyToRestore > 0) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stockQuantity: qtyToRestore } }
        )
      }
    }
    order.inventoryDecremented = false
  }

  // 3. Mutate Order status
  order.fulfillmentStatus = 'CANCELLED'
  order.paymentStatus = 'CANCELLED'
  order.cancelledAt = new Date()

  // Record audit adjustments
  for (const item of order.items) {
    order.shortageAdjustments.push({
      productId: item.productId,
      action: 'REMOVE_LINE',
      originalQuantity: item.quantity,
      adjustedQuantity: 0,
      originalUnitPriceMinor: item.unitPriceMinor,
      performedBy: 'Admin',
      timestamp: new Date(),
      note: body.reason || 'Manuell orderavbrytning av admin',
    })
  }

  await order.save()

  return {
    success: true,
    orderReference: order.orderReference,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
  }
})