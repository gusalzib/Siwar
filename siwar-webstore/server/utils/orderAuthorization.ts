// server/utils/orderAuthorization.ts
import Stripe from 'stripe'
import { Order, type IOrder } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { mailService, type EmailLocale } from '~/server/services/mail.service'
import { getPaymentGateway } from '~/server/services/payments'

/**
 * Atomically transitions a PENDING/FAILED order to AUTHORIZED (for manual-capture card holds)
 * or PAID (for instant settlement methods like Mollie Swish), decrements product stock atomically
 * (guarded by `inventoryDecremented`), and dispatches the Stage 1 order confirmation email in the
 * customer's locale (guarded by `confirmationEmailSent`).
 *
 * Idempotent: safe to call multiple times (e.g., concurrent webhook + confirmation page sync).
 *
 * @param paymentId - Gateway transaction identifier (e.g. Stripe pi_... or Mollie tr_...).
 * @param orderReference - Optional merchant order reference fallback for lookup.
 * @param targetStatus - Target canonical payment status ('AUTHORIZED' default, or 'PAID').
 */
export async function authorizeOrder(
  paymentId: string,
  orderReference?: string,
  targetStatus: 'AUTHORIZED' | 'PAID' = 'AUTHORIZED'
): Promise<IOrder | null> {
  const query: any = {
    $or: [{ paymentId }],
    paymentStatus: { $in: ['PENDING', 'FAILED'] },
  }
  if (orderReference) {
    query.$or.push({ orderReference })
  }

  const now = new Date()
  const statusFields: Record<string, any> = {
    paymentId,
    paymentStatus: targetStatus,
  }
  if (targetStatus === 'PAID') {
    statusFields.paidAt = now
  } else {
    statusFields.authorizedAt = now
  }

  const order = await Order.findOneAndUpdate(
    query,
    {
      $set: statusFields,
    },
    { returnDocument: 'after' }
  )

  if (!order) {
    // If order was already authorized, fetch and return it
    const existing = await Order.findOne({
      $or: orderReference ? [{ paymentId }, { orderReference }] : [{ paymentId }],
    })
    return existing
  }

  // Atomically decrement inventory if not yet decremented
  if (!order.inventoryDecremented && order.items && order.items.length > 0) {
    for (const item of order.items) {
      await Product.updateOne(
        {
          _id: item.productId,
          stockQuantity: { $gte: item.quantity },
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
    order.inventoryDecremented = true
  }

  // Trigger Order Confirmation email immediately upon authorization
  if (!order.confirmationEmailSent) {
    const customerLocale = (order.customerLocale || 'sv') as EmailLocale
    try {
      await mailService.sendOrderConfirmation(order, customerLocale)
      await Order.updateOne(
        { _id: order._id },
        { $set: { confirmationEmailSent: true } }
      )
      order.confirmationEmailSent = true
    } catch (mailErr) {
      console.error('[MailService] Failed to send order confirmation notice:', mailErr)
    }
  }

  return order
}

/**
 * Checks Stripe directly to verify if the PaymentIntent is in 'requires_capture' or 'succeeded' state.
 * If authorized on Stripe but still PENDING in our MongoDB database, synchronizes it immediately.
 */
export async function syncOrderPaymentWithStripe(order: any): Promise<any> {
  if (!order || order.paymentProvider !== 'STRIPE' || !order.paymentId) {
    return order
  }

  if (order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'FAILED') {
    return order
  }

  try {
    const config = useRuntimeConfig()
    const stripeSecretKey = (
      config.stripeSecretKey ||
      process.env.STRIPE_SECRET_KEY ||
      process.env.NUXT_STRIPE_SECRET_KEY ||
      process.env.STRIPE_SK ||
      process.env.STRIPE_API_KEY ||
      ''
    ).trim()

    if (!stripeSecretKey) return order

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-08-26.dahlia' })
    const pi = await stripe.paymentIntents.retrieve(order.paymentId)

    if (pi.status === 'requires_capture' || pi.status === 'succeeded') {
      console.log(`[Stripe Sync] Order ${order.orderReference} paymentIntent ${pi.id} is ${pi.status}. Transitioning to AUTHORIZED...`)
      const updated = await authorizeOrder(pi.id, order.orderReference)
      return updated || order
    }
  } catch (err: any) {
    console.error(`[Stripe Sync] Failed to verify PaymentIntent for order ${order.orderReference}:`, err?.message || err)
  }

  return order
}

/**
 * On-demand fallback sync with Mollie's Payments API for orders still in PENDING/FAILED state.
 *
 * Critical for two real-world scenarios:
 * 1. Race condition where the customer returns from Mollie's hosted checkout to
 *    `/order/confirmation/[id]` slightly before Mollie's asynchronous webhook arrives.
 * 2. Local development without a public HTTPS tunnel (where `webhookUrl` is omitted to avoid
 *    Mollie HTTP 422 validation errors).
 *
 * Performs an authoritative server-to-server lookup via `MollieGatewayAdapter.verifyWebhook`,
 * then transitions the order to AUTHORIZED (Card), PAID (Swish), CANCELLED, or FAILED.
 *
 * @param order - The current Order document or lean object fetched from MongoDB.
 * @returns The updated order document if transitioned, or the original order otherwise.
 */
export async function syncOrderPaymentWithMollie(order: any): Promise<any> {
  if (!order || order.paymentProvider !== 'MOLLIE' || !order.paymentId) {
    return order
  }

  if (order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'FAILED') {
    return order
  }

  try {
    const gateway = getPaymentGateway('MOLLIE')
    const verification = await gateway.verifyWebhook(
      {},
      JSON.stringify({ id: order.paymentId })
    )

    if (verification.eventType === 'AUTHORIZED' || verification.eventType === 'PAID') {
      console.log(
        `[Mollie Sync] Order ${order.orderReference} payment ${order.paymentId} is ${verification.eventType}. Synchronizing immediately...`
      )
      const updated = await authorizeOrder(
        order.paymentId,
        order.orderReference,
        verification.eventType
      )
      return updated || order
    }

    if (verification.eventType === 'CANCELLED' || verification.eventType === 'FAILED') {
      const updateFields: Record<string, any> = {
        paymentStatus: verification.eventType,
      }
      if (verification.eventType === 'CANCELLED') {
        updateFields.cancelledAt = new Date()
      }

      await Order.updateOne(
        {
          _id: order._id,
          paymentStatus: { $in: ['PENDING', 'FAILED'] },
        },
        { $set: updateFields }
      )

      return {
        ...(typeof order.toObject === 'function' ? order.toObject() : order),
        ...updateFields,
      }
    }
  } catch (err: any) {
    console.error(
      `[Mollie Sync] Failed to verify payment ${order.paymentId} for order ${order.orderReference}:`,
      err?.message || err
    )
  }

  return order
}

