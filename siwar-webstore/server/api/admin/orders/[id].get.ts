// server/api/admin/orders/[id].get.ts
import { isValidObjectId } from 'mongoose'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import {
  syncOrderPaymentWithStripe,
  syncOrderPaymentWithMollie,
} from '~/server/utils/orderAuthorization'
import { resolveProductGrossWeightGrams } from '~/utils/shipping'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || !isValidObjectId(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid order ID format',
    })
  }

  const initialOrder = await Order.findById(id).lean()

  if (!initialOrder) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Order not found',
    })
  }

  let order = initialOrder

  // If order is still PENDING with Stripe or Mollie, verify on-demand with the gateway API
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

  // Populate product image, freeShipping, and grossWeight for items if missing or defaulted to 0 (legacy/substituted items)
  if (order.items && order.items.length > 0) {
    const productIdsToFetch = order.items
      .filter((it: any) => (!it.imageUrl || typeof it.freeShipping !== 'boolean' || typeof it.grossWeight !== 'number' || it.grossWeight <= 0) && it.productId)
      .map((it: any) => it.productId)

    if (productIdsToFetch.length > 0) {
      const products = await Product.find({ _id: { $in: productIdsToFetch } })
        .select('images freeShipping grossWeight netQuantity')
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
          if (typeof it.grossWeight !== 'number' || it.grossWeight <= 0) {
            it.grossWeight = resolveProductGrossWeightGrams(prod as any)
          }
        }
      }
    }
  }

  return order
})