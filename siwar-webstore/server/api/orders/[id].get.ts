// server/api/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'
import {
  syncOrderPaymentWithStripe,
  syncOrderPaymentWithMollie,
} from '~/server/utils/orderAuthorization'

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

  // If order is still PENDING with Stripe or Mollie, perform on-demand sync with the payment gateway API
  // Ensures confirmation page reflects settled status immediately even if async webhook is delayed
  if (order.paymentStatus === 'PENDING' && order.paymentId) {
    let synced: any = null
    if (order.paymentProvider === 'MOLLIE') {
      synced = await syncOrderPaymentWithMollie(order)
    } else if (order.paymentProvider === 'STRIPE') {
      synced = await syncOrderPaymentWithStripe(order)
    }
    if (synced) {
      order = typeof synced.toObject === 'function' ? synced.toObject() : synced
    }
  }

  return order
})
