// server/api/checkout/cancel-session.post.ts
import { Order } from '~/server/models/Order'
import { getPaymentGateway } from '~/server/services/payments'

interface CancelSessionBody {
  orderReference: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CancelSessionBody>(event)

  if (!body.orderReference) {
    throw createError({ statusCode: 400, statusMessage: 'Missing order reference' })
  }

  // Find the pending order
  const order = await Order.findOne({
    orderReference: body.orderReference,
    paymentStatus: { $in: ['PENDING', 'FAILED'] },
  })

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found or cannot be cancelled.',
    })
  }

  // Cancel authorization hold or intent on the gateway if applicable
  if (order.paymentId && order.paymentProvider === 'STRIPE') {
    try {
      const gateway = getPaymentGateway('STRIPE')
      await gateway.cancelAuthorization(order.paymentId)
    } catch (err: any) {
      console.warn(`[Stripe Cancel] Failed to void intent ${order.paymentId}:`, err.message)
    }
  }

  // Mutate database status to CANCELLED
  order.paymentStatus = 'CANCELLED'
  await order.save()

  return { success: true }
})