// server/api/webhooks/mollie.post.ts
import { getPaymentGateway } from '~/server/services/payments'
import { Order } from '~/server/models/Order'
import { ProcessedWebhookEvent } from '~/server/models/ProcessedWebhookEvent'
import { authorizeOrder } from '~/server/utils/orderAuthorization'

/**
 * Inbound Mollie Payment Webhook Handler (Issue #53 — AC-2 & AC-3).
 *
 * Mollie dispatches an `application/x-www-form-urlencoded` (or JSON in test/proxy setups)
 * HTTP POST containing only the transaction identifier (`id=tr_...`).
 *
 * Security & Lifecycle Guarantee:
 * 1. Extracts the raw body (with fallback to parsed body) and delegates to
 *    `MollieGatewayAdapter.verifyWebhook`, which performs an authoritative server-to-server
 *    lookup via `mollieClient.payments.get(id)`.
 * 2. Enforces compound idempotency in `ProcessedWebhookEvent` using `${paymentId}_${eventType}`
 *    so legitimate lifecycle transitions (e.g. `AUTHORIZED` -> `PAID`) are processed while
 *    duplicate webhook retries are safely ignored without double-decrementing inventory or
 *    sending duplicate emails.
 * 3. On `AUTHORIZED` (Card manual hold) or `PAID` (Swish instant settlement):
 *    atomically updates `Order.paymentStatus`, decrements `Product.stockQuantity` via `$inc`
 *    (guarded by `inventoryDecremented`), and dispatches the Stage 1 confirmation email in
 *    `order.customerLocale` (guarded by `confirmationEmailSent`).
 * 4. On `FAILED` or `CANCELLED`: transitions `Order.paymentStatus` if still `PENDING` or `FAILED`.
 * 5. Always responds with HTTP `200 OK` to acknowledge receipt to Mollie and prevent unnecessary
 *    retry storms or payment ID enumeration.
 */
export default defineEventHandler(async (event) => {
  // 1. Read incoming webhook payload (supports application/x-www-form-urlencoded or JSON)
  let rawBody = await readRawBody(event)

  if (!rawBody) {
    try {
      const parsedBody = await readBody(event)
      if (typeof parsedBody === 'string') {
        rawBody = parsedBody
      } else if (parsedBody && typeof parsedBody === 'object' && 'id' in parsedBody) {
        rawBody = JSON.stringify(parsedBody)
      }
    } catch {
      // Ignore body read error; handled cleanly below
    }
  }

  if (!rawBody) {
    console.warn('[Mollie Webhook] Received empty request body; acknowledging with 200 OK.')
    setResponseStatus(event, 200)
    return { received: true, ignored: true, reason: 'Empty payload' }
  }

  // 2. Verify payment state directly with Mollie API via MollieGatewayAdapter
  let webhookResult
  try {
    const gateway = getPaymentGateway('MOLLIE')
    webhookResult = await gateway.verifyWebhook({}, rawBody)
  } catch (err: any) {
    // Per Mollie security guidelines, always respond 200 OK to avoid leaking unknown payment IDs
    // or triggering infinite retry loops on malformed requests.
    console.error('[Mollie Webhook] Authoritative verification failed:', err?.message || err)
    setResponseStatus(event, 200)
    return { received: true, ignored: true, reason: 'Verification failed' }
  }

  // 3. Compound Idempotency Check (AC-3): `${paymentId}_${eventType}`
  // Allows legitimate status transitions while blocking duplicate retries for the same state.
  const eventId = `${webhookResult.paymentId}_${webhookResult.eventType}`
  const alreadyProcessed = await ProcessedWebhookEvent.findOne({ eventId })

  if (alreadyProcessed) {
    setResponseStatus(event, 200)
    return { received: true, duplicate: true, eventId }
  }

  // 4. Handle canonical payment lifecycle transitions (AC-2)
  if (webhookResult.eventType === 'AUTHORIZED' || webhookResult.eventType === 'PAID') {
    // Atomically transition Order to AUTHORIZED (Card) or PAID (Swish),
    // decrement Product.stockQuantity via $inc (guarded by inventoryDecremented),
    // and dispatch Stage 1 confirmation email in order.customerLocale (guarded by confirmationEmailSent).
    await authorizeOrder(
      webhookResult.paymentId,
      webhookResult.orderReference,
      webhookResult.eventType
    )
  } else if (webhookResult.eventType === 'FAILED' || webhookResult.eventType === 'CANCELLED') {
    const matchOr: Record<string, any>[] = [{ paymentId: webhookResult.paymentId }]
    if (webhookResult.orderReference) {
      matchOr.push({ orderReference: webhookResult.orderReference })
    }

    const updateFields: Record<string, any> = {
      paymentStatus: webhookResult.eventType,
    }
    if (webhookResult.eventType === 'CANCELLED') {
      updateFields.cancelledAt = new Date()
    }

    await Order.updateOne(
      {
        $or: matchOr,
        paymentStatus: { $in: ['PENDING', 'FAILED'] },
      },
      {
        $set: updateFields,
      }
    )
  }

  // 5. Record processed event in audit collection for idempotency tracking
  try {
    await ProcessedWebhookEvent.create({
      eventId,
      provider: 'MOLLIE',
      eventType: webhookResult.eventType,
      orderReference: webhookResult.orderReference,
      rawPayload: webhookResult.rawPayload,
    })
  } catch (err: any) {
    // Ignore duplicate key errors (E11000) under concurrent webhook deliveries
    if (err?.code !== 11000) {
      console.error('[Mollie Webhook] Failed to persist ProcessedWebhookEvent:', err)
    }
  }

  // 6. Always acknowledge receipt to Mollie with HTTP 200 OK
  setResponseStatus(event, 200)
  return {
    received: true,
    eventId,
    eventType: webhookResult.eventType,
  }
})

