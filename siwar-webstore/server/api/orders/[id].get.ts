// server/api/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'

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

  return order
})
