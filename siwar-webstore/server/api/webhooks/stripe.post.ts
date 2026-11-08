// server/api/webhooks/stripe.post.ts
import type Stripe from 'stripe'
import { getPaymentGateway } from '~/server/services/payments'
import { Order } from '~/server/models/Order'
import { ProcessedWebhookEvent } from '~/server/models/ProcessedWebhookEvent'
import { authorizeOrder } from '~/server/utils/orderAuthorization'

export default defineEventHandler(async (event) => {
  // 1. AC-1: Extract signature header
  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing stripe-signature header',
    })
  }

  // 2. Read raw string payload for HMAC verification
  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Empty request payload',
    })
  }

  // 3. Cryptographically verify signature via Stripe Adapter
  let webhookResult
  try {
    const gateway = getPaymentGateway('STRIPE')
    webhookResult = await gateway.verifyWebhook(
      { 'stripe-signature': signature },
      rawBody
    )
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: `Webhook verification failed: ${err.message}`,
    })
  }

  const stripeEvent = webhookResult.rawPayload as Stripe.Event
  const eventId = stripeEvent?.id || webhookResult.paymentId

  // 4. AC-3: Webhook Idempotency Check
  const alreadyProcessed = await ProcessedWebhookEvent.findOne({ eventId })
  if (alreadyProcessed) {
    // Responding with 200 immediately stops Stripe retries without re-decrementing
    setResponseStatus(event, 200)
    return { received: true, duplicate: true }
  }

  // 5. Handle lifecycle events
  if (
    webhookResult.eventType === 'payment_intent.amount_capturable_updated' ||
    webhookResult.eventType === 'payment_intent.succeeded'
  ) {
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent
    const orderRef =
      webhookResult.orderReference || paymentIntent.metadata?.orderReference

    await authorizeOrder(webhookResult.paymentId, orderRef)
  } else if (webhookResult.eventType === 'payment_intent.payment_failed') {
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent
    const orderRef =
      webhookResult.orderReference || paymentIntent.metadata?.orderReference

    await Order.updateOne(
      {
        $or: [
          { paymentId: webhookResult.paymentId },
          { orderReference: orderRef },
        ],
        paymentStatus: 'PENDING',
      },
      {
        $set: {
          paymentStatus: 'FAILED',
        },
      }
    )
  }

  // 6. Record event for idempotency tracking
  try {
    await ProcessedWebhookEvent.create({
      eventId,
      provider: 'STRIPE',
      eventType: webhookResult.eventType,
      orderReference: webhookResult.orderReference,
      rawPayload: stripeEvent,
    })
  } catch (err: any) {
    // If caught by duplicate index constraint, event is already logged
    if (err.code !== 11000) {
      console.error('[Stripe Webhook] Error recording event log:', err)
    }
  }

  setResponseStatus(event, 200)
  return { received: true }
})