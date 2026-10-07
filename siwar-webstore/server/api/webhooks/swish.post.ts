// server/api/webhooks/swish.post.ts
import { getPaymentGateway } from '~/server/services/payments'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { ProcessedWebhookEvent } from '~/server/models/ProcessedWebhookEvent'

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Empty payload' })
  }

  let result
  try {
    const gateway = getPaymentGateway('SWISH')
    result = await gateway.verifyWebhook({}, rawBody)
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid Swish payload: ${err.message}`,
    })
  }

  const payload = result.rawPayload
  // Build a unique event ID for Swish callbacks (combination of transaction ID & status)
  const eventId =
    payload.callbackIdentifier ||
    `${payload.id || result.paymentId}_${payload.status}`

  // AC-3: Webhook Idempotency Check
  const alreadyProcessed = await ProcessedWebhookEvent.findOne({ eventId })
  if (alreadyProcessed) {
    setResponseStatus(event, 200)
    return { received: true, duplicate: true }
  }

  if (result.eventType === 'PAID') {
    // Atomically transition the order to PAID
    const order = await Order.findOneAndUpdate(
      {
        orderReference: result.orderReference,
        paymentStatus: { $in: ['PENDING', 'FAILED'] }
      },
      {
        $set: {
          paymentId: result.paymentId,
          paymentStatus: 'PAID',
          paidAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    )

    // AC-2: Atomic Stock Decrementing
    if (order && !order.inventoryDecremented) {
      for (const item of order.items) {
        await Product.updateOne(
          {
            _id: item.productId,
            stockQuantity: { $gte: item.quantity }, // Guard condition against negative stock
          },
          {
            $inc: { stockQuantity: -item.quantity },
          }
        )
      }

      await Order.updateOne(
        { _id: order._id },
        { $set: { inventoryDecremented: true } }
      )
    }
  } else if (result.eventType === 'DECLINED' || result.eventType === 'CANCELLED') {
    await Order.updateOne(
      {
        orderReference: result.orderReference,
        paymentStatus: 'PENDING',
      },
      {
        $set: {
          paymentStatus: 'CANCELLED',
        },
      }
    )
  }

  // Record event for idempotency tracking
  try {
    await ProcessedWebhookEvent.create({
      eventId,
      provider: 'SWISH',
      eventType: result.eventType,
      orderReference: result.orderReference,
      rawPayload: payload,
    })
  } catch (err: any) {
    if (err.code !== 11000) {
      console.error('[Swish Webhook] Error recording event log:', err)
    }
  }

  setResponseStatus(event, 200)
  return { received: true }
})