// server/api/checkout/create-session.post.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '../../models/Product'
import { calculateMomsSplit } from '../../services/pricing.service'
import { getPaymentGateway } from '../../services/payments'
import type { PaymentProviderType } from '../../../types/payment'

interface CreateSessionRequestBody {
  provider: PaymentProviderType
  currency: 'SEK' | 'EUR' | 'USD'
  items: Array<{ productId: string; quantity: number }>
  shippingFeeMinor: number
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

  // 2. Authoritative line calculations
  let grossProductsMinor = 0
  const calculationLines = []

  for (const item of body.items) {
    const product = productMap.get(item.productId)
    if (!product) {
      throw createError({
        statusCode: 404,
        statusMessage: `Product ${item.productId} not found in catalog`,
      })
    }
    const unitPrice = product.price[body.currency] ?? product.price.SEK
    const lineTotal = unitPrice * item.quantity
    grossProductsMinor += lineTotal

    calculationLines.push({
      productId: item.productId,
      unitPriceMinor: lineTotal,
      quantity: item.quantity,
      momsRate: product.momsRate as 12 | 25,
    })
  }

  const effectiveShipping =
    body.customer.fulfillmentMethod === 'PICKUP' ? 0 : body.shippingFeeMinor || 0
  const grandTotalMinor = grossProductsMinor + effectiveShipping
  const taxSplit = calculateMomsSplit(calculationLines, effectiveShipping)

  const orderReference = `ORD-${Date.now().toString().slice(-6)}`

  // 3. Delegate to the Payment Gateway Adapter
  const gateway = getPaymentGateway(body.provider)
  const session = await gateway.createSession({
    orderReference,
    amountMinor: grandTotalMinor,
    currency: body.currency,
    customer: {
      fullName: body.customer.fullName,
      email: body.customer.email,
      phone: body.customer.phone,
    },
    metadata: {
      fulfillmentMethod: body.customer.fulfillmentMethod,
      totalMomsMinor: taxSplit.totalMomsMinor.toString(),
      moms12Minor: taxSplit.moms12.momsAmountMinor.toString(),
      moms25Minor: taxSplit.moms25.momsAmountMinor.toString(),
    },
  })

  return {
    ...session,
    currency: body.currency,
    totalMinor: grandTotalMinor,
    orderReference,
    momsSplit: taxSplit,
  }
})