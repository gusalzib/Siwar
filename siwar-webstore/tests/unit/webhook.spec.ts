// tests/unit/webhooks.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// 1. Hoist Globals & Database Mocks
// ---------------------------------------------------------------------------
const {
  mockState,
  mockOrderModel,
  mockProductModel,
  mockProcessedEventModel,
  mockGateway,
} = vi.hoisted(() => {
  const mockState = {
    headers: {} as Record<string, string>,
    rawBody: '' as string,
    body: {} as any,
  }

  // Stub Nitro / H3 auto-imports
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('getHeader', vi.fn((_event: any, name: string) => mockState.headers[name.toLowerCase()]))
  vi.stubGlobal('readRawBody', vi.fn(async () => mockState.rawBody))
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('setResponseStatus', vi.fn())
  vi.stubGlobal('createError', (err: { statusCode: number; statusMessage: string }) => {
    const error: any = new Error(err.statusMessage)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    return error
  })

  // Mock Mongoose Models
  const mockOrderModel: any = {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  }

  const mockProductModel: any = {
    updateOne: vi.fn(),
  }

  const mockProcessedEventModel: any = {
    findOne: vi.fn(),
    create: vi.fn(),
  }

  // Mock Payment Gateway Strategy
  const mockGateway = {
    verifyWebhook: vi.fn(),
  }

  return {
    mockState,
    mockOrderModel,
    mockProductModel,
    mockProcessedEventModel,
    mockGateway,
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

// Import Route Handlers after hoisting
import stripeWebhookHandler from '~/server/api/webhooks/stripe.post'
import swishWebhookHandler from '~/server/api/webhooks/swish.post'

// ---------------------------------------------------------------------------
// 2. Test Execution
// ---------------------------------------------------------------------------
describe('Issue #11: Idempotent Webhook Listeners & Atomic Inventory', () => {
  const dummyEvent = {} as any
  const sampleOrderId = new Types.ObjectId()
  const sampleProductId = new Types.ObjectId()

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.headers = {}
    mockState.rawBody = ''
    mockState.body = {}
  })

  // -------------------------------------------------------------------------
  // AC-1: Cryptographic HMAC Signature Verification
  // -------------------------------------------------------------------------
  describe('AC-1: Webhook HMAC Cryptographic Verification', () => {
    it('aborts with 400 Bad Request if stripe-signature header is missing', async () => {
      mockState.headers = {} // No signature
      mockState.rawBody = JSON.stringify({ id: 'evt_123' })

      await expect(stripeWebhookHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Missing stripe-signature header',
      })
    })

    it('aborts with 400 Bad Request if payload is empty', async () => {
      mockState.headers = { 'stripe-signature': 't=123,v1=abcdef' }
      mockState.rawBody = '' // Empty body

      await expect(stripeWebhookHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Empty request payload',
      })
    })

    it('aborts with 400 when adapter signature verification fails', async () => {
      mockState.headers = { 'stripe-signature': 'invalid_sig' }
      mockState.rawBody = JSON.stringify({ id: 'evt_123' })

      mockGateway.verifyWebhook.mockRejectedValue(new Error('Invalid signature'))

      await expect(stripeWebhookHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Webhook verification failed: Invalid signature',
      })
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: Webhook Idempotency & Deduplication
  // -------------------------------------------------------------------------
  describe('AC-3: Webhook Idempotency Check', () => {
    it('returns { received: true, duplicate: true } without running stock mutations if event was already processed', async () => {
      mockState.headers = { 'stripe-signature': 'valid_sig' }
      mockState.rawBody = JSON.stringify({ id: 'evt_duplicate_999' })

      mockGateway.verifyWebhook.mockResolvedValue({
        eventId: 'evt_duplicate_999',
        eventType: 'payment_intent.amount_capturable_updated',
        orderReference: 'ORD-123456',
        paymentId: 'pi_test_123',
      })

      // Simulate that event is already recorded in DB
      mockProcessedEventModel.findOne.mockResolvedValue({
        eventId: 'evt_duplicate_999',
        provider: 'STRIPE',
      })

      const response = await stripeWebhookHandler(dummyEvent)

      expect(response).toEqual({ received: true, duplicate: true })
      // Verify no order state or stock updates were invoked
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled()
      expect(mockProductModel.updateOne).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // AC-2: Atomic Stock Decrement & State Transition (Success)
  // -------------------------------------------------------------------------
  describe('AC-2: Atomic Inventory Decrements on Payment Success', () => {
    it('atomically transitions order to AUTHORIZED and decrements stock with $inc and $gte guard', async () => {
      mockState.headers = { 'stripe-signature': 'valid_sig' }
      mockState.rawBody = JSON.stringify({ id: 'evt_valid_100' })

      mockGateway.verifyWebhook.mockResolvedValue({
        eventId: 'evt_valid_100',
        eventType: 'payment_intent.amount_capturable_updated',
        orderReference: 'ORD-987654',
        paymentId: 'pi_test_valid',
        rawPayload: {
          id: 'evt_valid_100',
          data: {
            object: {
              metadata: { orderReference: 'ORD-987654' }
            }
          }
        }
      })

      // Event is not in database yet
      mockProcessedEventModel.findOne.mockResolvedValue(null)

      // Mock order transitioning from PENDING/FAILED to AUTHORIZED
      mockOrderModel.findOneAndUpdate.mockResolvedValue({
        _id: sampleOrderId,
        orderReference: 'ORD-987654',
        paymentStatus: 'AUTHORIZED',
        inventoryDecremented: false,
        items: [
          { productId: sampleProductId, quantity: 2 },
        ],
      })

      mockProductModel.updateOne.mockResolvedValue({ modifiedCount: 1 })

      const response = await stripeWebhookHandler(dummyEvent)

      expect(response).toEqual({ received: true })

      // Verify Order transition query guard: allows PENDING or FAILED recovery
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: { $in: ['PENDING', 'FAILED'] },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: 'AUTHORIZED',
          }),
        }),
        expect.anything()
      )

      // AC-2: Verify atomic stock update with $gte condition
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        {
          _id: sampleProductId,
          stockQuantity: { $gte: 2 },
        },
        {
          $inc: { stockQuantity: -2 },
        }
      )

      // Verify flag flipped to true
      expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
        { _id: sampleOrderId },
        { $set: { inventoryDecremented: true } }
      )

      // Verify event was logged to processedwebhookevents
      expect(mockProcessedEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_valid_100',
          provider: 'STRIPE',
        })
      )
    })
  })

  // -------------------------------------------------------------------------
  // Failure Handling: Declined Payments
  // -------------------------------------------------------------------------
  describe('Decline Flow: Stock Preserved on Payment Failure', () => {
    it('sets order to FAILED and does NOT decrement stock on payment_intent.payment_failed', async () => {
      mockState.headers = { 'stripe-signature': 'valid_sig' }
      mockState.rawBody = JSON.stringify({ id: 'evt_failed_001' })

      mockGateway.verifyWebhook.mockResolvedValue({
        eventId: 'evt_failed_001',
        eventType: 'payment_intent.payment_failed',
        orderReference: 'ORD-987654',
        paymentId: 'pi_test_failed',
        rawPayload: {
          id: 'evt_failed_001',
          data: {
            object: {
              metadata: { orderReference: 'ORD-987654' }
            }
          }
        }
      })

      mockProcessedEventModel.findOne.mockResolvedValue(null)

      const response = await stripeWebhookHandler(dummyEvent)

      expect(response).toEqual({ received: true })

      // Order marked FAILED
      expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            paymentStatus: 'FAILED',
          }),
        })
      )

      // Stock must NOT be touched
      expect(mockProductModel.updateOne).not.toHaveBeenCalled()
    })
  })
})