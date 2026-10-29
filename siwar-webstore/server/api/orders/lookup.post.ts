// server/api/orders/lookup.post.ts
import { Order } from '~/server/models/Order'
import { phonesMatch } from '~/server/utils/phone'
import { orderLookupRateLimiter } from '~/server/utils/rateLimiter'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  // 1. IP Rate Limiting (AC-4: max 5 requests per 60 seconds per IP)
  const clientIp =
    getHeader(event, 'x-forwarded-for')?.split(',')?.[0]?.trim() ||
    getRequestIP(event, { xForwardedFor: true }) ||
    event.node.req.socket?.remoteAddress ||
    '127.0.0.1'

  const rateCheck = orderLookupRateLimiter.check(clientIp)
  setResponseHeader(event, 'X-RateLimit-Limit', 5)
  setResponseHeader(event, 'X-RateLimit-Remaining', rateCheck.remaining)
  setResponseHeader(event, 'X-RateLimit-Reset', rateCheck.resetSeconds)

  if (!rateCheck.allowed) {
    setResponseHeader(event, 'Retry-After', rateCheck.resetSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: `För många förfrågningar. Vänligen vänta ${rateCheck.resetSeconds} sekunder innan du försöker igen.`,
    })
  }

  // 2. Validate request payload
  const body = await readBody(event).catch(() => ({}))
  const orderReference = typeof body?.orderReference === 'string' ? body.orderReference.trim() : ''
  const emailOrPhone = typeof body?.emailOrPhone === 'string' ? body.emailOrPhone.trim() : ''

  if (!orderReference || !emailOrPhone) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vänligen ange både ordernummer och e-postadress eller telefonnummer.',
    })
  }

  // 3. Database lookup by order reference (case-insensitive)
  const order = await Order.findOne({
    orderReference: { $regex: new RegExp(`^${escapeRegex(orderReference)}$`, 'i') },
  })
    .select('-idempotencyKey')
    .lean()

  // 4. Anti-Enumeration & validation (AC-3: generic 404 for missing or mismatched orders)
  const genericNotFound = () =>
    createError({
      statusCode: 404,
      statusMessage: 'Ordern kunde inte hittas med angivna uppgifter',
    })

  if (!order || !order.customer) {
    throw genericNotFound()
  }

  let isMatch = false

  // Email verification (case-insensitive)
  if (order.customer.email && emailOrPhone.toLowerCase() === order.customer.email.trim().toLowerCase()) {
    isMatch = true
  }

  // Mobile phone verification (normalized Swedish and international comparison)
  if (!isMatch && order.customer.phone && phonesMatch(order.customer.phone, emailOrPhone)) {
    isMatch = true
  }

  if (!isMatch) {
    throw genericNotFound()
  }

  // 5. Successful match (AC-1 & AC-2)
  return {
    success: true,
    id: String(order._id),
    orderId: String(order._id),
    orderReference: order.orderReference,
  }
})
