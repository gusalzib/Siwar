// server/api/webhooks/swish.post.ts
import { getPaymentGateway } from '~/server/services/payments'

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Empty payload' })
  }

  const gateway = getPaymentGateway('SWISH')
  const result = await gateway.verifyWebhook({}, rawBody)

  if (result.eventType === 'PAID') {
    // Swish payment confirmed!
    // In Issue #11/12: update order status to PAID in MongoDB
    console.log(`[Swish Webhook] Payment SUCCESS for order ${result.orderReference}: ${result.amountMinor} öre`)
  } else if (result.eventType === 'DECLINED' || result.eventType === 'CANCELLED') {
    console.log(`[Swish Webhook] Payment ${result.eventType} for order ${result.orderReference}`)
  }

  setResponseStatus(event, 200)
  return { received: true }
})