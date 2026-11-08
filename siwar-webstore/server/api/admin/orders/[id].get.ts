// server/api/admin/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { syncOrderPaymentWithStripe } from '~/server/utils/orderAuthorization'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid order ID format',
    })
  }

  let order = await Order.findById(id).lean()

  if (!order) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    })
  }

  // If order is still PENDING with Stripe, verify on-demand with Stripe API
  if (order.paymentStatus === 'PENDING' && order.paymentProvider === 'STRIPE' && order.paymentId) {
    const synced = await syncOrderPaymentWithStripe(order)
    if (synced) {
      order = typeof (synced as any).toObject === 'function' ? (synced as any).toObject() : synced
    }
  }

  // Populate product image and freeShipping for items if missing (for legacy or substituted items)
  if (order.items && order.items.length > 0) {
    const productIdsToFetch = order.items
      .filter((it: any) => (!it.imageUrl || typeof it.freeShipping !== 'boolean') && it.productId)
      .map((it: any) => it.productId)

    if (productIdsToFetch.length > 0) {
      const products = await Product.find({ _id: { $in: productIdsToFetch } })
        .select('images freeShipping')
        .lean()
      const pMap = new Map(products.map((p) => [String(p._id), p]))
      for (const it of order.items as any[]) {
        const prod = pMap.get(String(it.productId))
        if (prod) {
          if (typeof it.freeShipping !== 'boolean') {
            it.freeShipping = Boolean(prod.freeShipping)
          }
          if (!it.imageUrl && prod.images && prod.images.length > 0) {
            it.imageUrl = prod.images.find((img: any) => img.isPrimary)?.url || prod.images[0]?.url || ''
          }
        }
      }
    }
  }

  return order
})