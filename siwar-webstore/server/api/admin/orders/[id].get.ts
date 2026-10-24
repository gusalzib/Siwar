// server/api/admin/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'

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

  // Populate product image for items if missing (for legacy or substituted items)
  if (order.items && order.items.length > 0) {
    const missingImageProductIds = order.items
      .filter((it: any) => !it.imageUrl && it.productId)
      .map((it: any) => it.productId)

    if (missingImageProductIds.length > 0) {
      const products = await Product.find({ _id: { $in: missingImageProductIds } })
        .select('images')
        .lean()
      const pMap = new Map(products.map((p) => [String(p._id), p]))
      for (const it of order.items as any[]) {
        if (!it.imageUrl && it.productId) {
          const prod = pMap.get(String(it.productId))
          if (prod && prod.images && prod.images.length > 0) {
            it.imageUrl = prod.images.find((img: any) => img.isPrimary)?.url || prod.images[0]?.url || ''
          }
        }
      }
    }
  }

  return order
})