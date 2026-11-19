// tests/unit/mollie.section3.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// 1. Hoisted Mocks & Nitro/H3 Globals
// ---------------------------------------------------------------------------
const {
  mockState,
  mockOrderModel,
  mockProductModel,
  mockProcessedEventModel,
  mockGateway,
  mockMailService,
  mockShippingCarrier,
} = vi.hoisted(() => {
  const mockState = {
    params: {} as Record<string, string>,
    headers: {} as Record<string, string>,
    rawBody: '' as string,
    body: {} as any,
  }

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('getRouterParam', vi.fn((_event: any, key: string) => mockState.params[key]))
  vi.stubGlobal('getHeader', vi.fn((_event: any, name: string) => mockState.headers[name.toLowerCase()]))
  vi.stubGlobal('readRawBody', vi.fn(async () => mockState.rawBody))
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('setResponseStatus', vi.fn())
  vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({
    mollieApiKey: 'test_mock_key',
    mollieWebhookUrl: 'https://siwar.se/api/webhooks/mollie',
    mollieRedirectBaseUrl: 'https://siwar.se',
    public: { stripePublishableKey: '' },
  })))
  vi.stubGlobal('createError', (err: { statusCode: number; statusMessage: string; data?: any }) => {
    const error: any = new Error(err.statusMessage)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    error.data = err.data
    return error
  })

  const mockOrderModel: any = {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  }

  const mockProductModel: any = {
    find: vi.fn(),
    updateOne: vi.fn(),
  }

  const mockProcessedEventModel: any = {
    findOne: vi.fn(),
    create: vi.fn(),
  }

  const mockGateway = {
    provider: 'MOLLIE',
    supportedCurrencies: ['SEK', 'EUR', 'USD'],
    createSession: vi.fn(),
    verifyWebhook: vi.fn(),
    captureFunds: vi.fn(),
    cancelAuthorization: vi.fn(),
    refundPayment: vi.fn(),
  }

  const mockMailService = {
    sendOrderConfirmation: vi.fn(),
    sendOrderDispatched: vi.fn(),
    sendOrderPackedNotice: vi.fn(),
    sendOrderCancelled: vi.fn(),
  }

  const mockShippingCarrier = {
    createShipment: vi.fn(async () => ({
      trackingCode: '003733253812345678',
      consignmentNumber: 'DHL-CONS-103',
    })),
    generateMockShipment: vi.fn(() => ({
      trackingCode: '003733253800000001',
      consignmentNumber: 'DHL-MOCK-103',
    })),
    getTrackingUrl: vi.fn((code: string) => `https://www.dhl.com/se-en/home/tracking.html?tracking-id=${code}`),
  }

  return {
    mockState,
    mockOrderModel,
    mockProductModel,
    mockProcessedEventModel,
    mockGateway,
    mockMailService,
    mockShippingCarrier,
  }
})

// Mock Modules
vi.mock('~/server/models/Order', () => ({ Order: mockOrderModel }))
vi.mock('~/server/models/Product', () => ({ Product: mockProductModel }))
vi.mock('~/server/models/ProcessedWebhookEvent', () => ({
  ProcessedWebhookEvent: mockProcessedEventModel,
}))
vi.mock('~/server/services/payments', () => ({
  getPaymentGateway: vi.fn(() => mockGateway),
}))
vi.mock('~/server/services/mail.service', () => ({
  mailService: mockMailService,
}))
vi.mock('~/server/services/shipping', () => ({
  getShippingCarrier: vi.fn(() => mockShippingCarrier),
}))
vi.mock('~/server/services/shipping.service', () => ({
  getCachedShippingSettings: vi.fn(async () => ({
    freeShippingThresholdMinorSEK: 89900,
    tiers: [{ feeMinorSEK: 7700 }],
    freeShippingItemGrantsEntireOrder: false,
  })),
}))

import fs from 'node:fs'
import path from 'node:path'
import createSessionHandler from '~/server/api/checkout/create-session.post'
import cancelSessionHandler from '~/server/api/checkout/cancel-session'
import mollieWebhookHandler from '~/server/api/webhooks/mollie.post'
import getOrderHandler from '~/server/api/orders/[id].get'
import packOrderHandler from '~/server/api/admin/orders/[id]/pack.post'
import adminCancelOrderHandler from '~/server/api/admin/orders/[id]/cancel.post'

describe('Issue #53 - Section 3: Enums, Checkout Session, Fulfillment & Mollie Webhook', () => {
  const dummyEvent = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.params = {}
    mockState.headers = {}
    mockState.rawBody = ''
    mockState.body = {}
  })

  // -------------------------------------------------------------------------
  // 1. Database Model Enums Verification
  // -------------------------------------------------------------------------
  describe('1. Mongoose Model Enums (Order & ProcessedWebhookEvent)', () => {
    it('includes MOLLIE in both Order.ts and ProcessedWebhookEvent.ts provider enums', () => {
      const orderSource = fs.readFileSync(
        path.resolve(__dirname, '../../server/models/Order.ts'),
        'utf-8'
      )
      const webhookEventSource = fs.readFileSync(
        path.resolve(__dirname, '../../server/models/ProcessedWebhookEvent.ts'),
        'utf-8'
      )

      expect(orderSource).toMatch(/enum:\s*\['STRIPE',\s*'SWISH',\s*'KLARNA',\s*'MOLLIE'\]/)
      expect(webhookEventSource).toMatch(/enum:\s*\['STRIPE',\s*'SWISH',\s*'KLARNA',\s*'MOLLIE'\]/)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Checkout Create Session (MOLLIE Card & Swish)
  // -------------------------------------------------------------------------
  describe('2. POST /api/checkout/create-session (Mollie Support)', () => {
    const prodId = new Types.ObjectId()

    function setupCatalogMocks() {
      mockProductModel.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: prodId,
              barcode: 'SKU-1',
              name: { ar: 'زيت زيتون', sv: 'Olivolja', en: 'Olive Oil' },
              price: { SEK: 15000, EUR: 1500, USD: 1600 },
              momsRate: 12,
              stockQuantity: 20,
              safetyBuffer: 2,
              images: [{ url: 'https://cdn.siwar.se/oil.jpg', isPrimary: true }],
              grossWeight: 1000,
              freeShipping: false,
            },
          ]),
        }),
      })

      const draftOrderId = new Types.ObjectId()
      mockOrderModel.create.mockResolvedValue({
        _id: draftOrderId,
        orderReference: 'ORD-555111',
      })
      mockOrderModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
      return draftOrderId
    }

    it('creates a Mollie Card session, passes orderId + paymentMethod, and returns checkoutUrl', async () => {
      const draftOrderId = setupCatalogMocks()
      mockGateway.createSession.mockResolvedValueOnce({
        provider: 'MOLLIE',
        paymentId: 'tr_mollie_card_1',
        status: 'REQUIRES_ACTION',
        checkoutUrl: 'https://www.mollie.com/checkout/select-method/tr_mollie_card_1',
        redirectUrl: 'https://www.mollie.com/checkout/select-method/tr_mollie_card_1',
      })

      mockState.body = {
        provider: 'MOLLIE',
        paymentMethod: 'creditcard',
        currency: 'SEK',
        locale: 'sv',
        shippingFeeMinor: 7700,
        items: [{ productId: String(prodId), quantity: 1 }],
        customer: {
          fullName: 'Sara Svensson',
          email: 'sara@example.com',
          phone: '+46701112233',
          fulfillmentMethod: 'DELIVERY',
          address: { street: 'Storgatan 1', postalCode: '302 54', city: 'Halmstad' },
        },
      }

      const res: any = await createSessionHandler(dummyEvent)

      expect(mockGateway.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'SEK',
          paymentMethod: 'creditcard',
          metadata: expect.objectContaining({
            orderId: String(draftOrderId),
          }),
        })
      )
      expect(res.provider).toBe('MOLLIE')
      expect(res.paymentId).toBe('tr_mollie_card_1')
      expect(res.checkoutUrl).toBe('https://www.mollie.com/checkout/select-method/tr_mollie_card_1')
      expect(res.orderId).toBe(String(draftOrderId))
    })

    it('rejects Mollie Swish payments when currency is not SEK', async () => {
      mockState.body = {
        provider: 'MOLLIE',
        paymentMethod: 'swish',
        currency: 'EUR',
        shippingFeeMinor: 0,
        items: [{ productId: String(prodId), quantity: 1 }],
        customer: {
          fullName: 'Sara Svensson',
          email: 'sara@example.com',
          phone: '+46701112233',
          fulfillmentMethod: 'PICKUP',
        },
      }

      await expect(createSessionHandler(dummyEvent)).rejects.toThrow(
        'Swish payments can only be processed in SEK.'
      )
    })
  })

  // -------------------------------------------------------------------------
  // 3. Checkout Cancel Session (MOLLIE)
  // -------------------------------------------------------------------------
  describe('3. POST /api/checkout/cancel-session (Mollie Support)', () => {
    it('invokes Mollie cancelAuthorization safely inside try/catch before cancelling draft order', async () => {
      const mockOrderDoc: any = {
        _id: new Types.ObjectId(),
        orderReference: 'ORD-CANCEL-1',
        paymentProvider: 'MOLLIE',
        paymentId: 'tr_mollie_open_1',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'PENDING_PACKING',
        inventoryDecremented: false,
        items: [],
        save: vi.fn().mockResolvedValue(true),
      }

      mockOrderModel.findOne.mockResolvedValueOnce(mockOrderDoc)
      mockGateway.cancelAuthorization.mockRejectedValueOnce(new Error('Already expired'))

      mockState.body = { orderReference: 'ORD-CANCEL-1', status: 'ABANDONED' }

      const res: any = await cancelSessionHandler(dummyEvent)

      expect(mockGateway.cancelAuthorization).toHaveBeenCalledWith('tr_mollie_open_1')
      expect(mockOrderDoc.paymentStatus).toBe('ABANDONED')
      expect(mockOrderDoc.fulfillmentStatus).toBe('CANCELLED')
      expect(mockOrderDoc.save).toHaveBeenCalledTimes(1)
      expect(res.success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Mollie Inbound Webhook Handler (AC-2 & AC-3)
  // -------------------------------------------------------------------------
  describe('4. POST /api/webhooks/mollie (Verification, Fulfillment & Idempotency)', () => {
    it('AC-2: verifies AUTHORIZED Card payment, decrements stock, sends email, logs ProcessedWebhookEvent, returns 200', async () => {
      const orderId = new Types.ObjectId()
      const prodId = new Types.ObjectId()

      mockState.rawBody = 'id=tr_card_auth_100'
      mockGateway.verifyWebhook.mockResolvedValueOnce({
        isValid: true,
        eventType: 'AUTHORIZED',
        orderReference: 'ORD-M-100',
        paymentId: 'tr_card_auth_100',
        amountMinor: 25000,
        currency: 'SEK',
        rawPayload: { id: 'tr_card_auth_100', status: 'authorized' },
      })
      mockProcessedEventModel.findOne.mockResolvedValueOnce(null)
      mockOrderModel.findOneAndUpdate.mockResolvedValueOnce({
        _id: orderId,
        orderReference: 'ORD-M-100',
        paymentId: 'tr_card_auth_100',
        paymentStatus: 'AUTHORIZED',
        customerLocale: 'ar',
        inventoryDecremented: false,
        confirmationEmailSent: false,
        items: [{ productId: prodId, quantity: 2 }],
      })
      mockProductModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
      mockOrderModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
      mockMailService.sendOrderConfirmation.mockResolvedValueOnce(true)
      mockProcessedEventModel.create.mockResolvedValueOnce({})

      const res: any = await mollieWebhookHandler(dummyEvent)

      expect(mockGateway.verifyWebhook).toHaveBeenCalledWith({}, 'id=tr_card_auth_100')
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: { $in: ['PENDING', 'FAILED'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentId: 'tr_card_auth_100',
            paymentStatus: 'AUTHORIZED',
            authorizedAt: expect.any(Date),
          }),
        }),
        { returnDocument: 'after' }
      )
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: prodId, stockQuantity: { $gte: 2 } },
        { $inc: { stockQuantity: -2 } }
      )
      expect(mockMailService.sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ orderReference: 'ORD-M-100' }),
        'ar'
      )
      expect(mockProcessedEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'tr_card_auth_100_AUTHORIZED',
          provider: 'MOLLIE',
          eventType: 'AUTHORIZED',
          orderReference: 'ORD-M-100',
        })
      )
      expect(res.received).toBe(true)
      expect(setResponseStatus).toHaveBeenCalledWith(dummyEvent, 200)
    })

    it('AC-2: verifies PAID Swish payment and transitions order directly to PAID with paidAt', async () => {
      const orderId = new Types.ObjectId()
      const prodId = new Types.ObjectId()

      mockState.rawBody = 'id=tr_swish_paid_200'
      mockGateway.verifyWebhook.mockResolvedValueOnce({
        isValid: true,
        eventType: 'PAID',
        orderReference: 'ORD-M-200',
        paymentId: 'tr_swish_paid_200',
        amountMinor: 12000,
        currency: 'SEK',
        rawPayload: { id: 'tr_swish_paid_200', status: 'paid' },
      })
      mockProcessedEventModel.findOne.mockResolvedValueOnce(null)
      mockOrderModel.findOneAndUpdate.mockResolvedValueOnce({
        _id: orderId,
        orderReference: 'ORD-M-200',
        paymentId: 'tr_swish_paid_200',
        paymentStatus: 'PAID',
        customerLocale: 'sv',
        inventoryDecremented: false,
        confirmationEmailSent: false,
        items: [{ productId: prodId, quantity: 1 }],
      })

      const res: any = await mollieWebhookHandler(dummyEvent)

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: 'PAID',
            paidAt: expect.any(Date),
          }),
        }),
        { returnDocument: 'after' }
      )
      expect(mockProcessedEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'tr_swish_paid_200_PAID',
          provider: 'MOLLIE',
        })
      )
      expect(res.received).toBe(true)
    })

    it('AC-3: responds 200 OK on duplicate webhook without double-decrementing stock or re-sending email', async () => {
      mockState.rawBody = 'id=tr_dup_300'
      mockGateway.verifyWebhook.mockResolvedValueOnce({
        isValid: true,
        eventType: 'AUTHORIZED',
        orderReference: 'ORD-M-300',
        paymentId: 'tr_dup_300',
        rawPayload: { id: 'tr_dup_300', status: 'authorized' },
      })
      mockProcessedEventModel.findOne.mockResolvedValueOnce({
        eventId: 'tr_dup_300_AUTHORIZED',
      })

      const res: any = await mollieWebhookHandler(dummyEvent)

      expect(res).toEqual({
        received: true,
        duplicate: true,
        eventId: 'tr_dup_300_AUTHORIZED',
      })
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled()
      expect(mockProductModel.updateOne).not.toHaveBeenCalled()
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled()
      expect(setResponseStatus).toHaveBeenCalledWith(dummyEvent, 200)
    })

    it('transitions PENDING/FAILED order to CANCELLED on Mollie canceled webhook and returns 200', async () => {
      mockState.rawBody = 'id=tr_cancel_400'
      mockGateway.verifyWebhook.mockResolvedValueOnce({
        isValid: true,
        eventType: 'CANCELLED',
        orderReference: 'ORD-M-400',
        paymentId: 'tr_cancel_400',
        rawPayload: { id: 'tr_cancel_400', status: 'canceled' },
      })
      mockProcessedEventModel.findOne.mockResolvedValueOnce(null)
      mockOrderModel.updateOne.mockResolvedValueOnce({ modifiedCount: 1 })

      const res: any = await mollieWebhookHandler(dummyEvent)

      expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: { $in: ['PENDING', 'FAILED'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: 'CANCELLED',
            cancelledAt: expect.any(Date),
          }),
        })
      )
      expect(res.received).toBe(true)
      expect(setResponseStatus).toHaveBeenCalledWith(dummyEvent, 200)
    })

    it('always returns 200 OK even when webhook verification fails', async () => {
      mockState.rawBody = 'id=tr_unknown_999'
      mockGateway.verifyWebhook.mockRejectedValueOnce(new Error('Payment not found'))

      const res: any = await mollieWebhookHandler(dummyEvent)

      expect(res.received).toBe(true)
      expect(res.ignored).toBe(true)
      expect(setResponseStatus).toHaveBeenCalledWith(dummyEvent, 200)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Confirmation Page On-Demand Mollie Sync Fallback (GET /api/orders/[id])
  // -------------------------------------------------------------------------
  describe('5. GET /api/orders/[id] (On-Demand Mollie Status Sync Fallback)', () => {
    it('syncs PENDING Mollie order directly via Mollie API when returning to confirmation page', async () => {
      const orderId = new Types.ObjectId()
      const prodId = new Types.ObjectId()
      mockState.params = { id: String(orderId) }

      mockOrderModel.findById.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: orderId,
            orderReference: 'ORD-SYNC-1',
            paymentProvider: 'MOLLIE',
            paymentId: 'tr_sync_1',
            paymentStatus: 'PENDING',
            customerLocale: 'en',
            items: [{ productId: prodId, quantity: 1 }],
          }),
        }),
      })

      mockGateway.verifyWebhook.mockResolvedValueOnce({
        isValid: true,
        eventType: 'PAID',
        orderReference: 'ORD-SYNC-1',
        paymentId: 'tr_sync_1',
        rawPayload: { id: 'tr_sync_1', status: 'paid' },
      })

      mockOrderModel.findOneAndUpdate.mockResolvedValueOnce({
        _id: orderId,
        orderReference: 'ORD-SYNC-1',
        paymentProvider: 'MOLLIE',
        paymentId: 'tr_sync_1',
        paymentStatus: 'PAID',
        customerLocale: 'en',
        inventoryDecremented: false,
        confirmationEmailSent: false,
        items: [{ productId: prodId, quantity: 1 }],
      })

      const order: any = await getOrderHandler(dummyEvent)

      expect(mockGateway.verifyWebhook).toHaveBeenCalledWith(
        {},
        JSON.stringify({ id: 'tr_sync_1' })
      )
      expect(order.paymentStatus).toBe('PAID')
    })
  })

  // -------------------------------------------------------------------------
  // 6. Admin Fulfillment (pack.post.ts & cancel.post.ts) for MOLLIE
  // -------------------------------------------------------------------------
  describe('6. Admin Fulfillment Endpoints for MOLLIE (Card Capture vs Swish Refund)', () => {
    function buildMockOrder(overrides: Record<string, any> = {}) {
      const prodId = new Types.ObjectId()
      return {
        _id: new Types.ObjectId(),
        orderReference: 'ORD-ADM-1',
        paymentProvider: 'MOLLIE',
        paymentId: 'tr_adm_1',
        paymentStatus: 'AUTHORIZED',
        fulfillmentStatus: 'PENDING_PACKING',
        currency: 'SEK',
        customerLocale: 'sv',
        inventoryDecremented: true,
        cancellationEmailSent: false,
        customer: {
          fullName: 'Test Customer',
          email: 'cust@example.com',
          phone: '+46701234567',
          fulfillmentMethod: 'PICKUP',
        },
        items: [
          {
            productId: prodId,
            sku: 'SKU-1',
            name: { ar: 'تمر', sv: 'Dadlar', en: 'Dates' },
            quantity: 2,
            fulfilledQuantity: 2,
            unitPriceMinor: 10000,
            momsRate: 12,
            freeShipping: false,
            shortageStatus: 'NONE',
            grossWeight: 500,
            isPacked: true,
          },
        ],
        shortageAdjustments: [],
        pricing: {
          itemsTotalMinor: 20000,
          shippingFeeMinor: 0,
          grandTotalMinor: 20000,
          authorizedTotalMinor: 20000,
          taxSplit: {},
        },
        markModified: vi.fn(),
        save: vi.fn().mockResolvedValue(true),
        ...overrides,
      }
    }

    it('pack.post.ts dispatches AUTHORIZED Mollie Card order via captureFunds', async () => {
      const orderDoc = buildMockOrder({ paymentStatus: 'AUTHORIZED', paymentId: 'tr_card_pack' })
      mockState.params = { id: String(orderDoc._id) }
      mockState.body = { markDispatched: true, actions: [] }
      mockOrderModel.findById.mockResolvedValueOnce(orderDoc)
      mockGateway.captureFunds.mockResolvedValueOnce(true)

      const res: any = await packOrderHandler(dummyEvent)

      expect(mockGateway.captureFunds).toHaveBeenCalledWith('tr_card_pack', 20000)
      expect(mockGateway.refundPayment).not.toHaveBeenCalled()
      expect(res.paymentStatus).toBe('CAPTURED')
      expect(res.fulfillmentStatus).toBe('DISPATCHED')
    })

    it('pack.post.ts dispatches PAID Mollie Swish order with packing shortage via refundPayment', async () => {
      const orderDoc = buildMockOrder({ paymentStatus: 'PAID', paymentId: 'tr_swish_pack' })
      const prodIdStr = String(orderDoc.items[0].productId)
      mockState.params = { id: String(orderDoc._id) }
      mockState.body = {
        markDispatched: true,
        actions: [
          { productId: prodIdStr, action: 'REDUCE_QUANTITY', adjustedQuantity: 1 },
        ],
        items: [
          {
            index: 0,
            productId: prodIdStr,
            fulfilledQuantity: 1,
            shortageStatus: 'REDUCED',
            unitPriceMinor: 10000,
            momsRate: 12,
            freeShipping: false,
            grossWeight: 500,
            isPacked: true,
          },
        ],
      }
      mockOrderModel.findById.mockResolvedValueOnce(orderDoc)
      mockGateway.refundPayment.mockResolvedValueOnce(true)

      const res: any = await packOrderHandler(dummyEvent)

      expect(mockGateway.captureFunds).not.toHaveBeenCalled()
      expect(mockGateway.refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'tr_swish_pack',
          orderReference: 'ORD-ADM-1',
          amountMinor: 10000,
        })
      )
      expect(res.paymentStatus).toBe('PARTIALLY_CAPTURED')
      expect(res.fulfillmentStatus).toBe('DISPATCHED')
    })

    it('cancel.post.ts cancels AUTHORIZED Mollie Card order via cancelAuthorization', async () => {
      const orderDoc = buildMockOrder({ paymentStatus: 'AUTHORIZED', paymentId: 'tr_card_adm_cancel' })
      mockState.params = { id: String(orderDoc._id) }
      mockState.body = { reason: 'Customer requested cancellation' }
      mockOrderModel.findById.mockResolvedValueOnce(orderDoc)
      mockGateway.cancelAuthorization.mockResolvedValueOnce(true)

      const res: any = await adminCancelOrderHandler(dummyEvent)

      expect(mockGateway.cancelAuthorization).toHaveBeenCalledWith('tr_card_adm_cancel')
      expect(mockGateway.refundPayment).not.toHaveBeenCalled()
      expect(res.paymentStatus).toBe('CANCELLED')
      expect(res.fulfillmentStatus).toBe('CANCELLED')
    })

    it('cancel.post.ts cancels PAID Mollie Swish order via refundPayment', async () => {
      const orderDoc = buildMockOrder({ paymentStatus: 'PAID', paymentId: 'tr_swish_adm_cancel' })
      mockState.params = { id: String(orderDoc._id) }
      mockState.body = { reason: 'Out of stock' }
      mockOrderModel.findById.mockResolvedValueOnce(orderDoc)
      mockGateway.refundPayment.mockResolvedValueOnce(true)

      const res: any = await adminCancelOrderHandler(dummyEvent)

      expect(mockGateway.cancelAuthorization).not.toHaveBeenCalled()
      expect(mockGateway.refundPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'tr_swish_adm_cancel',
          orderReference: 'ORD-ADM-1',
          amountMinor: 20000,
          reason: 'Out of stock',
        })
      )
      expect(res.paymentStatus).toBe('CANCELLED')
      expect(res.fulfillmentStatus).toBe('CANCELLED')
    })
  })
})

