// server/api/admin/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid order ID format',
    })
  }

  const order = await Order.findById(id).lean()

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    })
  }

  return order
})