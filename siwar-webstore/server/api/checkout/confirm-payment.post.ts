// server/api/checkout/confirm-payment.post.ts
import Stripe from 'stripe'
import { Order } from '~/server/models/Order'
import { authorizeOrder } from '~/server/utils/orderAuthorization'

interface ConfirmPaymentBody {
  orderReference?: string
  orderId?: string
  paymentIntentId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ConfirmPaymentBody>(event)

  if (!body || (!body.orderReference && !body.orderId && !body.paymentIntentId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing order reference or paymentIntentId',
    })
  }

  // 1. Locate the Order in the database
  const query: any = {}
  if (body.orderId) query._id = body.orderId
  else if (body.orderReference) query.orderReference = body.orderReference
  else if (body.paymentIntentId) query.paymentId = body.paymentIntentId

  const order = await Order.findOne(query)
  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    })
  }

  // If already authorized or captured, return early
  if (order.paymentStatus === 'AUTHORIZED' || order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID') {
    return {
      success: true,
      paymentStatus: order.paymentStatus,
      orderReference: order.orderReference,
    }
  }

  const paymentIntentId = body.paymentIntentId || order.paymentId
  if (!paymentIntentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No payment identifier associated with this order',
    })
  }

  // 2. Verify with Stripe directly
  const config = useRuntimeConfig()
  const stripeSecretKey = (
    config.stripeSecretKey ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.NUXT_STRIPE_SECRET_KEY ||
    process.env.STRIPE_SK ||
    process.env.STRIPE_API_KEY ||
    ''
  ).trim()

  if (!stripeSecretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'STRIPE_SECRET_KEY is not configured on the server',
    })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-08-26.dahlia' })
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)

  // Validate that the payment intent actually succeeded or has authorized hold
  if (pi.status !== 'requires_capture' && pi.status !== 'succeeded') {
    throw createError({
      statusCode: 400,
      statusMessage: `Stripe PaymentIntent is in unexpected state: ${pi.status}`,
    })
  }

  // 3. Authorize order, decrement inventory, and send confirmation email
  const updatedOrder = await authorizeOrder(paymentIntentId, order.orderReference)

  return {
    success: true,
    paymentStatus: updatedOrder?.paymentStatus || 'AUTHORIZED',
    orderReference: order.orderReference,
  }
})

