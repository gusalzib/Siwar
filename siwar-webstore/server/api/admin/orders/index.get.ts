// server/api/admin/orders/index.get.ts
import type { QueryFilter } from 'mongoose'
import { Order, type IOrder, type OrderFulfillmentStatus, type OrderPaymentStatus } from '~/server/models/Order'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fulfillmentStatus = query.fulfillmentStatus ? String(query.fulfillmentStatus) : 'all'
  const paymentStatus = query.paymentStatus ? String(query.paymentStatus) : 'all'
  const search = query.search ? String(query.search).trim() : ''

  const filter: QueryFilter<IOrder> = {}

  // 1. Filter by Fulfillment Status
  if (fulfillmentStatus !== 'all') {
    filter.fulfillmentStatus = fulfillmentStatus as OrderFulfillmentStatus
  }

  // 2. Filter by Payment Status
  if (paymentStatus !== 'all') {
    filter.paymentStatus = paymentStatus as OrderPaymentStatus
  }

  // 3. Search by Order Reference, Customer Name, Email, or Phone
  if (search) {
    const searchRegex = new RegExp(search, 'i')
    filter.$or = [
      { orderReference: searchRegex },
      { 'customer.fullName': searchRegex },
      { 'customer.email': searchRegex },
      { 'customer.phone': searchRegex },
    ]
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .lean()

  return orders.map((o) => ({
    id: String(o._id),
    orderReference: o.orderReference,
    customer: {
      fullName: o.customer.fullName,
      phone: o.customer.phone,
      fulfillmentMethod: o.customer.fulfillmentMethod,
    },
    paymentProvider: o.paymentProvider,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    currency: o.currency,
    itemsCount: o.items.reduce((acc, item) => acc + item.quantity, 0),
    fulfilledItemsCount: o.items.reduce((acc, item) => acc + item.fulfilledQuantity, 0),
    grandTotalMinor: o.pricing.grandTotalMinor,
    authorizedTotalMinor: o.pricing.authorizedTotalMinor,
    capturedTotalMinor: o.pricing.capturedTotalMinor,
    shortagesCount: o.shortageAdjustments?.length || 0,
    createdAt: o.createdAt,
    packedAt: o.packedAt,
    dispatchedAt: o.dispatchedAt,
  }))
})