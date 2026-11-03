// server/api/checkout/cancel-session.post.ts
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { getPaymentGateway } from '~/server/services/payments'

/**
 * Payload interface for cancelling or abandoning an in-flight payment session.
 */
interface CancelSessionBody {
  orderReference: string
  status?: 'CANCELLED' | 'ABANDONED'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CancelSessionBody>(event)

  if (!body?.orderReference) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order reference' })
  }

  // 1. Locate the active draft order by reference.
  // We allow transition from PENDING, FAILED, or ABANDONED (e.g. if beacon abandoned first and user explicitly cancels later)
  const order = await Order.findOne({
    orderReference: body.orderReference,
    paymentStatus: { $in: ['PENDING', 'FAILED', 'ABANDONED'] },
  })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found or cannot be cancelled.',
    })
  }

  // 2. Void payment intent / authorization hold on the payment gateway if applicable
  if (order.paymentId && order.paymentProvider === 'STRIPE') {
    try {
      const gateway = getPaymentGateway('STRIPE')
      await gateway.cancelAuthorization(order.paymentId)
    } catch (err: any) {
      console.warn(`[Stripe Cancel] Failed to void intent ${order.paymentId}:`, err.message)
    }
  }

  // 3. Atomically restore physical product inventory if stock was decremented during checkout
  if (order.inventoryDecremented) {
    for (const item of order.items) {
      const qtyToRestore = item.quantity
      if (qtyToRestore > 0 && item.productId) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stockQuantity: qtyToRestore } }
        )
      }
    }
    order.inventoryDecremented = false
  }

  // 4. Synchronously transition both paymentStatus and fulfillmentStatus to prevent state drift
  // Abandoned or Cancelled checkout sessions must NEVER remain in PENDING_PACKING
  const targetPaymentStatus = body.status === 'ABANDONED' ? 'ABANDONED' : 'CANCELLED'
  order.paymentStatus = targetPaymentStatus
  order.fulfillmentStatus = 'CANCELLED'
  order.cancelledAt = new Date()

  await order.save()

  return {
    success: true,
    orderReference: order.orderReference,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
  }
})