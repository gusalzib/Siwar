// server/api/admin/orders/[id]/cancel.post.ts
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { getPaymentGateway } from '~/server/services/payments'
import { sanitizeSwishMessage } from '~/server/utils/swish'
import { mailService, type EmailLocale } from '~/server/services/mail.service'

interface CancelOrderBody {
  reason?: string
}

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const body = await readBody<CancelOrderBody>(event)

  const order = await Order.findById(orderId)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Ordern hittades inte' })
  }

  if (order.fulfillmentStatus === 'DISPATCHED') {
    throw createError({ statusCode: 400, statusMessage: 'Kan inte avbryta en redan skickad order' })
  }

  if (order.fulfillmentStatus === 'CANCELLED') {
    throw createError({ statusCode: 400, statusMessage: 'Ordern är redan avbruten' })
  }

  // 1. Release hold or refund through Payment Gateway
  if (order.paymentId) {
    const gateway = getPaymentGateway(order.paymentProvider)
    if (order.paymentProvider === 'STRIPE' && order.paymentStatus === 'AUTHORIZED') {
      try {
        await gateway.cancelAuthorization(order.paymentId)
      } catch (err: any) {
        console.warn(`[Stripe Void Warning] ${err.message}`)
      }
    } else if (order.paymentProvider === 'SWISH' && gateway.refundPayment) {
      await gateway.refundPayment({
        paymentId: order.paymentId,
        orderReference: order.orderReference,
        amountMinor: order.pricing.authorizedTotalMinor,
        reason: sanitizeSwishMessage(body.reason, `Order avbruten av admin (${order.orderReference})`),
      })
    }
  }

  // 2. Return physical items to inventory (if stock was decremented during authorization)
  if (order.inventoryDecremented) {
    for (const item of order.items) {
      // Re-increment based on the quantity originally held
      const qtyToRestore = item.quantity
      const restoreProductId = (item as any).originalProductId || item.productId
      if (qtyToRestore > 0 && restoreProductId) {
        await Product.updateOne(
          { _id: restoreProductId },
          { $inc: { stockQuantity: qtyToRestore } }
        )
      }
    }
    order.inventoryDecremented = false
  }

  // 3. Mutate Order status & final zero-sum pricing
  const authorizedHold = order.pricing?.authorizedTotalMinor ?? order.pricing?.grandTotalMinor ?? 0
  order.fulfillmentStatus = 'CANCELLED'
  order.paymentStatus = 'CANCELLED'
  order.cancelledAt = new Date()
  if (order.pricing) {
    order.pricing.capturedTotalMinor = 0
    order.pricing.releasedOrRefundedMinor = authorizedHold
    order.markModified('pricing')
  }

  // Record audit adjustments
  for (const item of order.items) {
    order.shortageAdjustments.push({
      productId: item.productId,
      action: 'REMOVE_LINE',
      originalQuantity: item.quantity,
      adjustedQuantity: 0,
      originalUnitPriceMinor: item.unitPriceMinor,
      originalSku: item.sku,
      originalName: item.name ? { ...item.name } : undefined,
      originalMomsRate: item.momsRate,
      performedBy: 'Admin',
      timestamp: new Date(),
      note: body?.reason || 'Manuell orderavbrytning av admin',
    })
  }
  order.markModified('shortageAdjustments')

  await order.save()

  // 4. Send exactly one cancellation confirmation email
  if (!order.cancellationEmailSent) {
    const preferredLocale = (order.customerLocale || 'sv') as EmailLocale
    try {
      await mailService.sendOrderCancelled(order, preferredLocale, body?.reason)
      order.cancellationEmailSent = true
      await Order.updateOne({ _id: order._id }, { $set: { cancellationEmailSent: true } })
    } catch (mailErr) {
      console.error('[MailService] Failed to send order cancellation email:', mailErr)
    }
  }

  return {
    success: true,
    orderReference: order.orderReference,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
  }
})