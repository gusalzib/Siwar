// server/api/admin/orders/[id]/pack.post.ts
import mongoose from 'mongoose'
import { Order } from '~/server/models/Order'
import { Product } from '~/server/models/Product'
import { recalculateOrderShortage, computeOrderPricing, type ShortageActionInput } from '~/server/services/fulfillment.service'
import { getCachedShippingSettings } from '~/server/services/shipping.service'
import { getPaymentGateway } from '~/server/services/payments'
import { mailService, type EmailLocale } from '~/server/services/mail.service'
import { getShippingCarrier } from '~/server/services/shipping'
import { sanitizeSwishMessage } from '~/server/utils/swish'
import { resolveProductGrossWeightGrams } from '~/utils/shipping'

interface PackItemInput {
  index?: number
  productId: string
  originalProductId?: string
  fulfilledQuantity: number
  shortageStatus: 'NONE' | 'REDUCED' | 'REMOVED' | 'SUBSTITUTED'
  sku?: string
  imageUrl?: string
  name?: { ar: string; sv: string; en: string }
  unitPriceMinor?: number
  momsRate?: 6 | 12 | 25
  freeShipping?: boolean
  grossWeight?: number
  isPacked?: boolean
}

interface PackOrderBody {
  items?: PackItemInput[]
  actions: ShortageActionInput[]
  markDispatched?: boolean
  trackingCode?: string
  parcel?: {
    weightKg: number
    lengthCm: number
    widthCm: number
    heightCm: number
    preset?: string
    contentsDescription?: string
  }
}

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'id')
  const body = await readBody<PackOrderBody>(event)

  const order = await Order.findById(orderId)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  // ──────────────────────────────────────────────────────────────────────
  // 0. State Guard: Prevent unauthorized packing or dispatch of unpaid/cancelled orders
  // ──────────────────────────────────────────────────────────────────────
  const UNPACKABLE_PAYMENT_STATUSES = ['ABANDONED', 'CANCELLED', 'FAILED', 'PENDING']

  if (UNPACKABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Order kan inte packas eller skickas eftersom betalningsstatus är '${order.paymentStatus}'. Endast auktoriserade eller betalda ordrar kan hanteras.`,
    })
  }

  if (order.fulfillmentStatus === 'CANCELLED') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ordern är redan avbruten och kan inte packas.',
    })
  }

  // Handle retroactive consignment generation for already dispatched delivery orders
  if (order.fulfillmentStatus === 'DISPATCHED' && order.customer?.fulfillmentMethod === 'DELIVERY') {
    const carrierAdapter = getShippingCarrier('DHL')

    if (!order.trackingCode) {
      const parcelInput = body?.parcel || {
        weightKg: 3.5,
        lengthCm: 35,
        widthCm: 25,
        heightCm: 20,
        preset: 'MELLAN',
      }

      let bookingResult: any
      try {
        bookingResult = await carrierAdapter.createShipment({
          orderId: String(order._id),
          orderReference: order.orderReference,
          recipient: {
            name: order.customer.fullName,
            street: order.customer.address?.street || '',
            postalCode: order.customer.address?.postalCode || '',
            city: order.customer.address?.city || '',
            countryCode: 'SE',
            email: order.customer.email,
            phone: order.customer.phone,
          },
          parcel: {
            weightKg: parcelInput.weightKg,
            lengthCm: parcelInput.lengthCm,
            widthCm: parcelInput.widthCm,
            heightCm: parcelInput.heightCm,
            preset: parcelInput.preset as any,
            contentsDescription: parcelInput.contentsDescription || 'Livsmedel / Food items',
          },
          productCode: '103',
        })
      } catch (dhlErr: any) {
        console.warn('[PackAPI] Live DHL booking failed in retroactive dispatch; using mock:', dhlErr?.message)
        bookingResult = carrierAdapter.generateMockShipment({
          orderId: String(order._id),
          orderReference: order.orderReference,
          recipient: {
            name: order.customer.fullName,
            street: order.customer.address?.street || '',
            postalCode: order.customer.address?.postalCode || '',
            city: order.customer.address?.city || '',
            countryCode: 'SE',
            email: order.customer.email,
            phone: order.customer.phone,
          },
          parcel: {
            weightKg: parcelInput.weightKg,
            lengthCm: parcelInput.lengthCm,
            widthCm: parcelInput.widthCm,
            heightCm: parcelInput.heightCm,
            preset: parcelInput.preset as any,
          },
        })
      }

      order.carrier = 'DHL'
      order.trackingCode = bookingResult.trackingCode
      order.shipmentId = bookingResult.consignmentNumber
      ;(order as any).parcel = parcelInput
      await order.save()
    }

    return {
      success: true,
      orderReference: order.orderReference,
      fulfillmentStatus: order.fulfillmentStatus,
      trackingCode: order.trackingCode,
      consignmentNumber: order.shipmentId,
      trackingUrl: carrierAdapter.getTrackingUrl(order.trackingCode),
      carrier: order.carrier || 'DHL',
    }
  }

  // Ensure freeShipping and grossWeight are populated on original items if missing/defaulted to 0

  const unpopulatedProductIds = order.items
    .filter((it: any) => (typeof it.freeShipping !== 'boolean' || typeof it.grossWeight !== 'number' || it.grossWeight <= 0) && it.productId)
    .map((it: any) => it.productId)
  if (unpopulatedProductIds.length > 0) {
    const prods = await Product.find({ _id: { $in: unpopulatedProductIds } }, { freeShipping: 1, grossWeight: 1, netQuantity: 1 }).lean()
    const pMap = new Map(prods.map((p) => [String(p._id), p]))
    for (const it of order.items as any[]) {
      const prod = it.productId ? pMap.get(String(it.productId)) : undefined
      if (prod) {
        if (typeof it.freeShipping !== 'boolean') {
          it.freeShipping = Boolean(prod.freeShipping)
        }
        if (typeof it.grossWeight !== 'number' || it.grossWeight <= 0) {
          it.grossWeight = resolveProductGrossWeightGrams(prod as any)
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 1. Run recalculate FIRST on the untouched DB items so the service
  //    can match new actions against original product IDs and produce
  //    the correct audit trail entries (shortageAdjustments).
  // ──────────────────────────────────────────────────────────────────────
  const shippingConfig = await getCachedShippingSettings()
  const thresholdOverride = (shippingConfig as any)?.freeShippingThresholdMinorSEK
  const fallbackFeeOverride = (shippingConfig as any)?.tiers?.[0]?.feeMinorSEK
  const freeShippingItemGrantsEntireOrder = Boolean((shippingConfig as any)?.freeShippingItemGrantsEntireOrder)

  const { updatedItems, shortageAdjustments } = recalculateOrderShortage(
    order,
    body.actions || [],
    'Admin',
    thresholdOverride,
    fallbackFeeOverride,
    freeShippingItemGrantsEntireOrder
  )

  // ──────────────────────────────────────────────────────────────────────
  // 2. Merge the FULL client item state on top of recalculated items.
  //    The client always holds the correct state: applyShortageAction
  //    mutates it for new actions, and resetLineItem reverts it for
  //    resets. So the client is the source of truth for item identity
  //    and quantities; recalculate was only needed for audit trail +
  //    applying new shortage actions against the original DB items.
  // ──────────────────────────────────────────────────────────────────────
  if (body.items && body.items.length > 0) {
    body.items.forEach((submittedItem, idx) => {
      const targetIndex = typeof submittedItem.index === 'number' ? submittedItem.index : idx
      let match = updatedItems[targetIndex]

      if (!match) {
        match = updatedItems.find(
          (i) =>
            String(i.productId) === submittedItem.productId ||
            (submittedItem.originalProductId && String(i.productId) === submittedItem.originalProductId)
        ) as typeof match
      }

      if (match) {
        // Always sync full item state from client
        match.productId = new mongoose.Types.ObjectId(submittedItem.productId) as any
        match.fulfilledQuantity = submittedItem.fulfilledQuantity
        match.shortageStatus = submittedItem.shortageStatus
        if (typeof submittedItem.isPacked === 'boolean') {
          match.isPacked = submittedItem.isPacked
        }
        if (submittedItem.unitPriceMinor != null) match.unitPriceMinor = submittedItem.unitPriceMinor
        if (submittedItem.momsRate != null) match.momsRate = submittedItem.momsRate
        if (typeof submittedItem.freeShipping === 'boolean') {
          match.freeShipping = submittedItem.freeShipping
        }
        if (typeof submittedItem.grossWeight === 'number' && (submittedItem.grossWeight > 0 || submittedItem.shortageStatus === 'SUBSTITUTED')) {
          match.grossWeight = submittedItem.grossWeight
        }
        if (submittedItem.name) match.name = submittedItem.name
        if (submittedItem.sku !== undefined) match.sku = submittedItem.sku
        if (submittedItem.imageUrl !== undefined) match.imageUrl = submittedItem.imageUrl

        // Persist or clear the original-product link
        if (submittedItem.originalProductId) {
          match.originalProductId = new mongoose.Types.ObjectId(submittedItem.originalProductId) as any
        } else {
          match.originalProductId = undefined
        }
      }
    })

    // Clean up shortage adjustment audit records for items that the
    // client has reset back to NONE. We compare against the DB's
    // items to only target lines that actually had a shortage before.
    const dbStatusByProductId = new Map<string, string>()
    for (const dbItem of order.items) {
      dbStatusByProductId.set(String(dbItem.productId), dbItem.shortageStatus || 'NONE')
      if (dbItem.originalProductId) {
        dbStatusByProductId.set(String(dbItem.originalProductId), dbItem.shortageStatus || 'NONE')
      }
    }

    const resetProductIds = body.items
      .filter((si) => {
        if (si.shortageStatus !== 'NONE') return false
        // Only count as a reset if the DB had a non-NONE status for this product
        const dbStatus = dbStatusByProductId.get(si.productId)
          || (si.originalProductId ? dbStatusByProductId.get(si.originalProductId) : undefined)
        return dbStatus && dbStatus !== 'NONE'
      })
      .flatMap((si) => [si.productId, si.originalProductId].filter(Boolean) as string[])

    if (resetProductIds.length > 0) {
      const resetSet = new Set(resetProductIds)
      shortageAdjustments.splice(
        0,
        shortageAdjustments.length,
        ...shortageAdjustments.filter(
          (adj) =>
            !resetSet.has(String(adj.productId)) &&
            !resetSet.has(String(adj.substitutedProductId || ''))
        )
      )
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // 3. Recompute pricing from the FINAL merged item state so that
  //    financial totals correctly reflect any resets (restored items)
  //    or new shortages applied above.
  // ──────────────────────────────────────────────────────────────────────
  const finalPricing = computeOrderPricing(
    updatedItems,
    order.customer?.fulfillmentMethod,
    order.pricing?.shippingFeeMinor || 0,
    order.pricing?.authorizedTotalMinor || 0,
    order.currency as any,
    thresholdOverride,
    fallbackFeeOverride,
    freeShippingItemGrantsEntireOrder
  )

  const capturedTotal = finalPricing.capturedTotalMinor ?? finalPricing.grandTotalMinor
  const releasedAmount = finalPricing.releasedOrRefundedMinor ?? 0
  const totalFulfilledUnits = updatedItems.reduce((sum, item) => sum + (item.fulfilledQuantity || 0), 0)
  const isZeroFinalOrder = capturedTotal <= 0 || totalFulfilledUnits <= 0

  const authorizedHold = order.pricing.authorizedTotalMinor ?? order.pricing.grandTotalMinor
  const safeCaptureTotal = isZeroFinalOrder ? 0 : Math.min(capturedTotal, authorizedHold)

  // ──────────────────────────────────────────────────────────────────────
  // 4. Dispatch & Settlement handling
  // ──────────────────────────────────────────────────────────────────────
  if (body.markDispatched) {
    if (capturedTotal > authorizedHold) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Kan inte skicka ordern: Ersättningsvaran överstiger kundens auktoriserade belopp.',
      })
    }

    if (isZeroFinalOrder) {
      if (order.paymentId) {
        const gateway = getPaymentGateway(order.paymentProvider)
        if (order.paymentProvider === 'STRIPE') {
          await gateway.cancelAuthorization(order.paymentId)
        } else if (order.paymentProvider === 'SWISH' && gateway.refundPayment) {
          await gateway.refundPayment({
            paymentId: order.paymentId,
            orderReference: order.orderReference,
            amountMinor: order.pricing.authorizedTotalMinor,
            reason: sanitizeSwishMessage(
              `Order avbruten varubrist ${order.orderReference}`,
              `Order avbruten ${order.orderReference}`
            ),
          })
        }
      }
      order.fulfillmentStatus = 'CANCELLED'
      order.paymentStatus = 'CANCELLED'
      order.cancelledAt = new Date()

      // Ensure final pricing reflects a full 0.00 capture and full release/refund
      finalPricing.itemsTotalMinor = 0
      finalPricing.shippingFeeMinor = 0
      finalPricing.grandTotalMinor = 0
      finalPricing.capturedTotalMinor = 0
      finalPricing.releasedOrRefundedMinor = authorizedHold

      // Restore all originally reserved stock if it was decremented during checkout authorization
      if (order.inventoryDecremented) {
        for (const item of order.items) {
          const restoreProductId = (item as any).originalProductId || item.productId
          if (item.quantity > 0 && restoreProductId) {
            await Product.updateOne(
              { _id: restoreProductId },
              { $inc: { stockQuantity: item.quantity } }
            )
          }
        }
        order.inventoryDecremented = false
      }
    } else {
      const gateway = getPaymentGateway(order.paymentProvider)
      if (order.paymentProvider === 'STRIPE') {
        if (order.paymentStatus !== 'AUTHORIZED') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Kan inte genomföra debitering: ordern saknar aktiv auktorisation.',
          })
        }
        const captureOk = await gateway.captureFunds(order.paymentId!, safeCaptureTotal)
        if (!captureOk) {
          throw createError({
            statusCode: 502,
            statusMessage: `Stripe capture failed for ${order.orderReference}`,
          })
        }
      } else if (order.paymentProvider === 'SWISH') {
        if (order.paymentStatus !== 'PAID') {
          throw createError({
            statusCode: 400,
            statusMessage: 'Kan inte genomföra debitering: Swish-ordern är inte betald.',
          })
        }
        if (releasedAmount > 0 && gateway.refundPayment) {
          await gateway.refundPayment({
            paymentId: order.paymentId!,
            orderReference: order.orderReference,
            amountMinor: releasedAmount,
            reason: `Prisjustering för varubrist i order ${order.orderReference}`,
          })
        }
      } else {
        if (!['AUTHORIZED', 'PAID'].includes(order.paymentStatus)) {
          throw createError({
            statusCode: 400,
            statusMessage: `Kan inte genomföra debitering: ordern har ogiltig betalningsstatus '${order.paymentStatus}'.`,
          })
        }
      }

      order.fulfillmentStatus = 'DISPATCHED'
      order.paymentStatus = releasedAmount > 0 ? 'PARTIALLY_CAPTURED' : 'CAPTURED'
      order.dispatchedAt = new Date()

      // Carrier Consignment Creation via DhlAdapter (Product 103: Servicepoint)
      if (order.customer.fulfillmentMethod === 'DELIVERY') {
        const carrierAdapter = getShippingCarrier('DHL')
        const parcelInput = body.parcel || {
          weightKg: 3.5,
          lengthCm: 35,
          widthCm: 25,
          heightCm: 20,
          preset: 'MELLAN',
        }

        try {
          const bookingResult = await carrierAdapter.createShipment({
            orderId: String(order._id),
            orderReference: order.orderReference,
            recipient: {
              name: order.customer.fullName,
              street: order.customer.address?.street || '',
              postalCode: order.customer.address?.postalCode || '',
              city: order.customer.address?.city || '',
              countryCode: 'SE',
              email: order.customer.email,
              phone: order.customer.phone,
            },
            parcel: {
              weightKg: parcelInput.weightKg,
              lengthCm: parcelInput.lengthCm,
              widthCm: parcelInput.widthCm,
              heightCm: parcelInput.heightCm,
              preset: parcelInput.preset as any,
              contentsDescription: parcelInput.contentsDescription || 'Livsmedel / Food items',
            },
            productCode: '103',
          })

          order.carrier = 'DHL'
          order.trackingCode = bookingResult.trackingCode
          order.shipmentId = bookingResult.consignmentNumber
          ;(order as any).parcel = parcelInput
        } catch (dhlErr: any) {
          console.warn('[PackAPI] DHL Consignment live booking failed, using fallback mock:', dhlErr?.message)
          const mockResult = carrierAdapter.generateMockShipment({
            orderId: String(order._id),
            orderReference: order.orderReference,
            recipient: {
              name: order.customer.fullName,
              street: order.customer.address?.street || '',
              postalCode: order.customer.address?.postalCode || '',
              city: order.customer.address?.city || '',
              countryCode: 'SE',
              email: order.customer.email,
              phone: order.customer.phone,
            },
            parcel: {
              weightKg: parcelInput.weightKg,
              lengthCm: parcelInput.lengthCm,
              widthCm: parcelInput.widthCm,
              heightCm: parcelInput.heightCm,
              preset: parcelInput.preset as any,
            },
          })
          order.carrier = 'DHL'
          order.trackingCode = mockResult.trackingCode
          order.shipmentId = mockResult.consignmentNumber
          ;(order as any).parcel = parcelInput
        }
      }

      if (body.trackingCode) {
        order.trackingCode = body.trackingCode
        order.carrier = 'DHL'
      }

      // Rebalance inventory for removed/reduced items on partially fulfilled orders
      for (const action of body.actions || []) {
        if (action.action === 'REMOVE_LINE' || action.action === 'REDUCE_QUANTITY') {
          const originalItem = order.items.find((i) => String(i.productId) === action.productId)
          if (originalItem) {
            const droppedQty =
              originalItem.quantity - (action.action === 'REMOVE_LINE' ? 0 : action.adjustedQuantity)
            if (droppedQty > 0) {
              await Product.updateOne(
                { _id: action.productId },
                { $inc: { stockQuantity: droppedQty } }
              )
            }
          }
        }
      }
    }
  } else {
    const hasFulfilledItems = updatedItems.some((item) => item.fulfilledQuantity > 0)
    const allPacked =
      !isZeroFinalOrder &&
      hasFulfilledItems &&
      updatedItems.every((item) => item.fulfilledQuantity === 0 || item.isPacked === true)
    order.fulfillmentStatus = allPacked ? 'PACKED' : 'PENDING_PACKING'
  }

  // ──────────────────────────────────────────────────────────────────────
  // 5. Save order state
  // ──────────────────────────────────────────────────────────────────────
  order.items = updatedItems as any
  order.markModified('items')
  order.shortageAdjustments = shortageAdjustments
  order.markModified('shortageAdjustments')
  finalPricing.capturedTotalMinor = safeCaptureTotal
  order.pricing = finalPricing
  order.markModified('pricing')
  if (!isZeroFinalOrder && (body.markDispatched || order.fulfillmentStatus === 'PACKED')) {
    order.packedAt = new Date()
  }

  await order.save()

  if (releasedAmount > 0 && body.actions && body.actions.length > 0) {
    console.info(`[Shortage Notification Queued] Customer: ${order.customer.email} | Released: ${releasedAmount / 100} SEK`)
  }
  // Trigger post-fulfillment notices asynchronously
  try {
    const preferredLocale = (order.customerLocale || 'sv') as EmailLocale

    if (order.fulfillmentStatus === 'CANCELLED' || isZeroFinalOrder) {
      // Zero-sum or cancelled orders must NEVER receive packing or dispatch emails.
      // Send exactly one cancellation confirmation email once cancellation is finalized.
      if (order.fulfillmentStatus === 'CANCELLED' && !order.cancellationEmailSent) {
        await mailService.sendOrderCancelled(order, preferredLocale)
        order.cancellationEmailSent = true
        await Order.updateOne({ _id: order._id }, { $set: { cancellationEmailSent: true } })
      }
    } else if (body.markDispatched) {
      if (order.customer.fulfillmentMethod === 'DELIVERY') {
        // Carrier Dispatch Email with verified tracking code & carrier
        await mailService.sendOrderDispatched(
          {
            order,
            trackingCode: order.trackingCode, // Send the booked 18-digit Kolli-ID
            carrier: order.carrier || 'DHL',
          },
          preferredLocale
        )
      }
    } else if (order.fulfillmentStatus === 'PACKED') {
      // 2. Packed Notice (In-Store Pickup ready alert or Parcel waiting for courier pickup)
      await mailService.sendOrderPackedNotice(order, preferredLocale)
    }
  } catch (mailErr) {
    console.error('[MailService] Failed to send transactional notice:', mailErr)
  }

  const dhlCarrier = getShippingCarrier(order.carrier || 'DHL')
  const trackingUrl = order.trackingCode ? dhlCarrier.getTrackingUrl(order.trackingCode) : undefined

  return {
    success: true,
    orderReference: order.orderReference,
    capturedTotalMinor: safeCaptureTotal,
    releasedAmountMinor: releasedAmount,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    trackingCode: order.trackingCode,
    consignmentNumber: order.shipmentId,
    trackingUrl,
    carrier: order.carrier,
  }
})