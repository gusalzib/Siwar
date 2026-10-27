// server/api/checkout/create-session.post.ts
import { isValidObjectId } from 'mongoose'
// Added: Import randomUUID from node:crypto to generate cryptographically unique idempotency keys
import { randomUUID } from 'node:crypto'
import { Product } from '../../models/Product'
// Added: Import Order model to pre-register draft orders in MongoDB
import { Order } from '../../models/Order'
import { calculateMomsSplit, isDiscountActive } from '../../services/pricing.service'
// Added: Import evaluateCheckoutStock to validate cart availability against safety buffers before payment
import { evaluateCheckoutStock } from '../../services/inventory.service'
import { getPaymentGateway } from '../../services/payments'
import type { PaymentProviderType } from '../../../types/payment'

interface CreateSessionRequestBody {
  provider: PaymentProviderType
  currency: 'SEK' | 'EUR' | 'USD'
  items: Array<{ productId: string; quantity: number }>
  shippingFeeMinor: number
  locale?: 'ar' | 'sv' | 'en'
  customer: {
    fullName: string
    email: string
    phone: string
    fulfillmentMethod: 'DELIVERY' | 'PICKUP'
    address?: { street: string; postalCode: string; city: string } | null
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateSessionRequestBody>(event)

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cart items cannot be empty' })
  }

  // AC-1 Server Guard: Swish is strictly restricted to SEK
  if (body.provider === 'SWISH' && body.currency !== 'SEK') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Swish payments can only be processed in SEK.',
    })
  }

  // 1. Fetch live product records from MongoDB Atlas
  const productIds = body.items.map((i) => i.productId).filter(isValidObjectId)
  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean()
  const productMap = new Map(dbProducts.map((p) => [String(p._id), p]))

  // Added: 2. Pre-checkout stock gate: Re-evaluate cart against physical inventory & safety buffers (Issue #4 / AC-3)
  const stockValidation = evaluateCheckoutStock(
    body.items.map((i) => ({ productId: i.productId, requestedQuantity: i.quantity })),
    dbProducts
  )

  // Abort checkout if any requested item exceeds current online stock limits
  if (!stockValidation.isValid) {
    throw createError({
      statusCode: 409,
      statusMessage: 'One or more items in your cart are no longer available in the requested quantity.',
      data: stockValidation,
    })
  }

  // 3. Authoritative line calculations & Tax Splits (AC-1 & AC-3 Active Window Evaluation)
  const now = new Date()
  let grossProductsMinor = 0
  const calculationLines = []
  // Added: Snapshot order items array to persist directly in the Order document
  const orderItems = []

  for (const item of body.items) {
    const product = productMap.get(item.productId)
    if (!product) {
      throw createError({
        statusCode: 404,
        statusMessage: `Product ${item.productId} not found in catalog`,
      })
    }

    const baseUnitPrice = product.price[body.currency] ?? product.price.SEK
    const isPromoActive = isDiscountActive(
      product.discount,
      product.discountStartsAt,
      product.discountExpiresAt,
      now
    )
    const discount = isPromoActive ? (product.discount || 0) : 0
    const unitPrice = discount > 0 ? Math.round(baseUnitPrice * (1 - discount / 100)) : baseUnitPrice
    const lineTotal = unitPrice * item.quantity
    grossProductsMinor += lineTotal

    // unitPriceMinor receives the effective single-unit price (discounted if applicable)
    calculationLines.push({
      productId: item.productId,
      unitPriceMinor: unitPrice,
      quantity: item.quantity,
      momsRate: product.momsRate as 12 | 25,
    })

    const primaryImg = product.images?.find((img: any) => img.isPrimary)?.url || product.images?.[0]?.url || ''

    // Snapshot conforming to IOrderItem schema with locked discounted pricing and discount audit
    orderItems.push({
      productId: product._id,
      sku: product.barcode,
      imageUrl: primaryImg,
      name: product.name,
      quantity: item.quantity,
      fulfilledQuantity: item.quantity, // Default to ordered quantity
      unitPriceMinor: unitPrice,
      originalUnitPriceMinor: discount > 0 ? baseUnitPrice : undefined,
      discount: discount > 0 ? discount : undefined,
      momsRate: product.momsRate as 12 | 25,
    })
  }

  const effectiveShipping =
    body.customer.fulfillmentMethod === 'PICKUP' ? 0 : body.shippingFeeMinor || 0
  const grandTotalMinor = grossProductsMinor + effectiveShipping
  const taxSplit = calculateMomsSplit(calculationLines, effectiveShipping)

  // 4. Generate unique tracking identifiers & pre-register Order document in MongoDB (PENDING)
  const orderReference = `ORD-${Date.now().toString().slice(-6)}`
  const idempotencyKey = randomUUID()
  const customerLocale = (['ar', 'sv', 'en'].includes(body.locale || '') ? body.locale : 'sv') as 'ar' | 'sv' | 'en'

  // Create draft Order in database with PENDING status prior to contacting external gateway
  const draftOrder = await Order.create({
    orderReference,
    idempotencyKey,
    customerLocale,
    paymentProvider: body.provider,
    paymentStatus: 'PENDING',
    confirmationEmailSent: false,
    currency: body.currency,
    customer: body.customer,
    items: orderItems,
    pricing: {
      itemsTotalMinor: grossProductsMinor,
      shippingFeeMinor: effectiveShipping,
      grandTotalMinor,
      authorizedTotalMinor: grandTotalMinor,
      taxSplit,
    },
    inventoryDecremented: false,
  })

  // 5. Delegate to the Payment Gateway Adapter with the idempotency key and metadata
  const gateway = getPaymentGateway(body.provider)
  const session = await gateway.createSession({
    orderReference,
    amountMinor: grandTotalMinor,
    currency: body.currency,
    // Added: Pass idempotencyKey to the payment adapter
    idempotencyKey,
    customer: {
      fullName: body.customer.fullName,
      email: body.customer.email,
      phone: body.customer.phone,
    },
    metadata: {
      // Added: Store database Order _id in payment provider metadata for bi-directional webhook reconciliation
      orderId: String(draftOrder._id),
      fulfillmentMethod: body.customer.fulfillmentMethod,
      totalMomsMinor: taxSplit.totalMomsMinor.toString(),
      moms12Minor: taxSplit.moms12.momsAmountMinor.toString(),
      moms25Minor: taxSplit.moms25.momsAmountMinor.toString(),
    },
  })

  // Added: 6. Update Order record with provider-issued paymentId (e.g. PaymentIntent ID) before responding
  await Order.updateOne(
    { _id: draftOrder._id },
    { $set: { paymentId: session.paymentId } }
  )

  // 7. Return session parameters to frontend
  return {
    ...session,
    orderId: draftOrder._id.toString(),
    currency: body.currency,
    totalMinor: grandTotalMinor,
    orderReference,
    momsSplit: taxSplit,
  }
})