// server/api/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'
import { syncOrderPaymentWithStripe } from '~/server/utils/orderAuthorization'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid order identifier',
    })
  }

  let order = null
  if (isValidObjectId(id)) {
    order = await Order.findById(id).select('-idempotencyKey').lean()
  }

  if (!order) {
    order = await Order.findOne({
      $or: [
        { orderReference: id },
        { paymentId: id },
      ],
    }).select('-idempotencyKey').lean()
  }

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    })
  }

  // If order is still PENDING with Stripe, perform on-demand sync with Stripe API
  if (order.paymentStatus === 'PENDING' && order.paymentProvider === 'STRIPE' && order.paymentId) {
    const synced = await syncOrderPaymentWithStripe(order)
    if (synced) {
      order = typeof (synced as any).toObject === 'function' ? (synced as any).toObject() : synced
    }
  }

  return order
})
