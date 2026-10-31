// server/api/admin/orders/index.get.ts
import type { QueryFilter } from 'mongoose'
import { Order, type IOrder, type OrderFulfillmentStatus, type OrderPaymentStatus } from '~/server/models/Order'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fulfillmentStatus = query.fulfillmentStatus ? String(query.fulfillmentStatus) : 'all'
  const paymentStatus = query.paymentStatus ? String(query.paymentStatus) : 'all'
  const search = query.search ? String(query.search).trim() : ''
  const page = Math.max(1, Number(query.page) || 1)
  const limitParam = query.limit !== undefined ? Number(query.limit) : 10
  const isAll = query.limit === 'all' || limitParam <= 0
  const limit = isAll ? 0 : Math.min(100, Math.max(1, limitParam || 10))
  const skip = isAll ? 0 : (page - 1) * limit

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

  // 4. Overall / Hybrid Metrics (across matching filter and store)
  let totalCount = 0
  let pendingPackingCount = 0
  let dispatchedCount = 0

  if (typeof (Order as any).countDocuments === 'function') {
    try {
      totalCount = await Order.countDocuments(filter)
      // Overall store summary metrics (hybrid: regardless of active search/status filter, across all orders)
      pendingPackingCount = await Order.countDocuments({ fulfillmentStatus: 'PENDING_PACKING' })
      dispatchedCount = await Order.countDocuments({ fulfillmentStatus: 'DISPATCHED' })
    } catch {
      // Mock / fallback
    }
  }

  let queryBuilder: any = Order.find(filter).sort({ createdAt: -1 })
  if (!isAll && limit > 0) {
    if (typeof queryBuilder.skip === 'function') {
      queryBuilder = queryBuilder.skip(skip)
    }
    if (typeof queryBuilder.limit === 'function') {
      queryBuilder = queryBuilder.limit(limit)
    }
  }

  const rawOrders = await queryBuilder.lean()
  if (totalCount === 0 && rawOrders) {
    totalCount = rawOrders.length
  }

  const orders = (rawOrders || []).map((o: any) => ({
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
    itemsCount: o.items.reduce((acc: number, item: any) => acc + item.quantity, 0),
    fulfilledItemsCount: o.items.reduce((acc: number, item: any) => acc + item.fulfilledQuantity, 0),
    grandTotalMinor: o.pricing.grandTotalMinor,
    authorizedTotalMinor: o.pricing.authorizedTotalMinor,
    capturedTotalMinor: o.pricing.capturedTotalMinor,
    shortagesCount: o.shortageAdjustments?.length || 0,
    createdAt: o.createdAt,
    packedAt: o.packedAt,
    dispatchedAt: o.dispatchedAt,
  }))

  const effectiveLimit = limit > 0 ? limit : (totalCount || 1)
  const totalPages = Math.ceil(totalCount / effectiveLimit) || 1

  return {
    orders,
    pagination: {
      total: totalCount,
      page,
      limit: effectiveLimit,
      totalPages,
    },
    metrics: {
      totalOrders: totalCount,
      pendingPackingCount,
      dispatchedCount,
    },
  }
})