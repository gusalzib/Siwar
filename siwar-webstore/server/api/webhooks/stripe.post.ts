// server/api/webhooks/stripe.post.ts
import { getPaymentGateway } from '~/server/services/payments'

export default defineEventHandler(async (event) => {
  // 1. Extract signature header
  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing stripe-signature header',
    })
  }

  // 2. Read raw string payload for cryptographic HMAC verification
  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Empty request payload',
    })
  }

  // 3. Verify via our Stripe Adapter Strategy
  try {
    const gateway = getPaymentGateway('STRIPE')
    const webhookResult = await gateway.verifyWebhook(
      { 'stripe-signature': signature },
      rawBody
    )

    // Handle payment lifecycle events
    switch (webhookResult.eventType) {
      case 'payment_intent.amount_capturable_updated': {
        // AC-2: Card authorization hold succeeded (status: requires_capture)
        // Order reference and amounts are accessible via webhookResult:
        // webhookResult.paymentId
        // webhookResult.orderReference
        // webhookResult.amountMinor
        break
      }

      case 'payment_intent.payment_failed': {
        // Payment failed or declined
        break
      }

      default:
        break
    }

    // 4. Return 200 OK so Stripe knows the event was delivered
    return { received: true }
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: `Webhook verification failed: ${err.message}`,
    })
  }
})