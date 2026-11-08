// server/utils/orderAuthorization.ts
import Stripe from 'stripe'
import { Order, type IOrder } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { mailService, type EmailLocale } from '~/server/services/mail.service'

/**
 * Transitions an order to AUTHORIZED, decrements stock atomically (if not decremented),
 * and dispatches order confirmation email (if not sent).
 * Idempotent: safe to call multiple times.
 */
export async function authorizeOrder(
  paymentId: string,
  orderReference?: string
): Promise<IOrder | null> {
  const query: any = {
    $or: [{ paymentId }],
    paymentStatus: { $in: ['PENDING', 'FAILED'] },
  }
  if (orderReference) {
    query.$or.push({ orderReference })
  }

  const order = await Order.findOneAndUpdate(
    query,
    {
      $set: {
        paymentId,
        paymentStatus: 'AUTHORIZED',
        authorizedAt: new Date(),
      },
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

