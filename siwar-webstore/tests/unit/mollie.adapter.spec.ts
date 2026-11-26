// tests/unit/mollie.adapter.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MollieGatewayAdapter } from '~/server/services/payments/mollie.adapter'
import { getPaymentGateway } from '~/server/services/payments'
import type { CreatePaymentSessionParams, RefundPaymentParams } from '~/types/payment'

// Mock createMollieClient
const mockPayments = {
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  releaseAuthorization: vi.fn(),
}
const mockPaymentCaptures = {
  create: vi.fn(),
  get: vi.fn(),
}
const mockPaymentRefunds = {
  create: vi.fn(),
  get: vi.fn(),
}

const mockMollieClient = {
  payments: mockPayments,
  paymentCaptures: mockPaymentCaptures,
  paymentRefunds: mockPaymentRefunds,
}

vi.mock('@mollie/api-client', () => ({
  createMollieClient: vi.fn(() => mockMollieClient),
  PaymentStatus: {
    open: 'open',
    canceled: 'canceled',
    pending: 'pending',
    authorized: 'authorized',
    expired: 'expired',
    failed: 'failed',
    paid: 'paid',
  },
}))

describe('Issue #53 - Section 2: Mollie Gateway Adapter & Provider Registry', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.MOLLIE_API_KEY = 'test_mock_api_key_12345'
    process.env.BASE_URL = 'https://siwar.se'

    // Stub useRuntimeConfig
    vi.stubGlobal('useRuntimeConfig', () => ({
      mollieApiKey: process.env.MOLLIE_API_KEY,
      mollieWebhookUrl: process.env.MOLLIE_WEBHOOK_URL || '',
      mollieRedirectBaseUrl: process.env.MOLLIE_REDIRECT_BASE_URL || '',
    }))
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. Gateway Factory & Initialization', () => {
    it('successfully registers and resolves MOLLIE provider via getPaymentGateway', () => {
      const gateway = getPaymentGateway('MOLLIE')
      expect(gateway).toBeDefined()
      expect(gateway.provider).toBe('MOLLIE')
      expect(gateway.supportedCurrencies).toEqual(['SEK', 'EUR', 'USD'])
    })
  })

  describe('2. createSession Routing & Edge Cases', () => {
    const baseParams: CreatePaymentSessionParams = {
      orderReference: 'ORD-123456',
      amountMinor: 25000, // 250.00 SEK
      currency: 'SEK',
      customer: {
        fullName: 'Fatima Al-Zahra',
        email: 'fatima@example.com',
        phone: '+46701234567',
      },
      metadata: {
        orderId: '654321abcdef0123456789aa',
      },
      idempotencyKey: 'idemp-uuid-999',
    }

    it('routes Card payment with method: creditcard and captureMode: manual', async () => {
      mockPayments.create.mockResolvedValueOnce({
        id: 'tr_test_card_1',
        status: 'open',
        getCheckoutUrl: () => 'https://www.mollie.com/payscreen/select-method/tr_test_card_1',
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.createSession({
        ...baseParams,
        paymentMethod: 'creditcard',
      })

      expect(mockPayments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'creditcard',
          captureMode: 'manual',
          amount: { currency: 'SEK', value: '250.00' },
          description: 'Order ORD-123456',
          redirectUrl: 'https://siwar.se/order/confirmation/654321abcdef0123456789aa',
          metadata: expect.objectContaining({
            orderReference: 'ORD-123456',
            orderId: '654321abcdef0123456789aa',
            idempotencyKey: 'idemp-uuid-999',
          }),
        })
      )

      expect(result.provider).toBe('MOLLIE')
      expect(result.paymentId).toBe('tr_test_card_1')
      expect(result.status).toBe('REQUIRES_ACTION')
      expect(result.checkoutUrl).toBe('https://www.mollie.com/payscreen/select-method/tr_test_card_1')
      expect(result.redirectUrl).toBe('https://www.mollie.com/payscreen/select-method/tr_test_card_1')
    })

    it('routes Swish payment with method: swish and omits captureMode', async () => {
      mockPayments.create.mockResolvedValueOnce({
        id: 'tr_test_swish_1',
        status: 'open',
        getCheckoutUrl: () => 'https://www.mollie.com/payscreen/select-method/tr_test_swish_1',
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.createSession({
        ...baseParams,
        paymentMethod: 'swish',
      })

      expect(mockPayments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'swish',
          amount: { currency: 'SEK', value: '250.00' },
          description: 'Order ORD-123456',
        })
      )

      // Ensure captureMode is NOT set on Swish to avoid Mollie hiding Swish
      const createCall = mockPayments.create.mock.calls[0]![0]
      expect(createCall.captureMode).toBeUndefined()

      expect(result.paymentId).toBe('tr_test_swish_1')
    })

    it('Localhost Guard: omits webhookUrl if config points to localhost to avoid HTTP 422', async () => {
      process.env.MOLLIE_WEBHOOK_URL = 'http://localhost:3000/api/webhooks/mollie'
      mockPayments.create.mockResolvedValueOnce({
        id: 'tr_local_1',
        status: 'open',
        getCheckoutUrl: () => 'https://checkout.mollie.com/test',
      })

      const adapter = new MollieGatewayAdapter()
      await adapter.createSession(baseParams)

      const createCall = mockPayments.create.mock.calls[0]![0]
      expect(createCall.webhookUrl).toBeUndefined()
    })

    it('Localhost Guard: attaches webhookUrl if it is a public non-localhost endpoint', async () => {
      process.env.MOLLIE_WEBHOOK_URL = 'https://siwar.se/api/webhooks/mollie'
      mockPayments.create.mockResolvedValueOnce({
        id: 'tr_prod_1',
        status: 'open',
        getCheckoutUrl: () => 'https://checkout.mollie.com/prod',
      })

      const adapter = new MollieGatewayAdapter()
      await adapter.createSession(baseParams)

      const createCall = mockPayments.create.mock.calls[0]![0]
      expect(createCall.webhookUrl).toBe('https://siwar.se/api/webhooks/mollie')
    })
  })

  describe('3. verifyWebhook authoritative verification & status mapping', () => {
    it('authoritatively retrieves payment from Mollie and maps authorized state', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_123',
        status: 'authorized',
        amount: { currency: 'SEK', value: '199.00' },
        metadata: { orderReference: 'ORD-987' },
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.verifyWebhook({}, 'id=tr_123')

      expect(mockPayments.get).toHaveBeenCalledWith('tr_123')
      expect(result.isValid).toBe(true)
      expect(result.eventType).toBe('AUTHORIZED')
      expect(result.orderReference).toBe('ORD-987')
      expect(result.amountMinor).toBe(19900)
      expect(result.currency).toBe('SEK')
    })

    it('authoritatively retrieves payment from Mollie and maps paid state', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_456',
        status: 'paid',
        amount: { currency: 'SEK', value: '350.50' },
        metadata: { orderReference: 'ORD-988' },
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.verifyWebhook({}, JSON.stringify({ id: 'tr_456' }))

      expect(mockPayments.get).toHaveBeenCalledWith('tr_456')
      expect(result.isValid).toBe(true)
      expect(result.eventType).toBe('PAID')
      expect(result.amountMinor).toBe(35050)
    })

    it('maps canceled, failed, and expired statuses correctly', async () => {
      const adapter = new MollieGatewayAdapter()

      mockPayments.get.mockResolvedValueOnce({ id: 'tr_c', status: 'canceled', metadata: {} })
      const resCanceled = await adapter.verifyWebhook({}, 'id=tr_c')
      expect(resCanceled.eventType).toBe('CANCELLED')

      mockPayments.get.mockResolvedValueOnce({ id: 'tr_f', status: 'failed', metadata: {} })
      const resFailed = await adapter.verifyWebhook({}, 'id=tr_f')
      expect(resFailed.eventType).toBe('FAILED')

      mockPayments.get.mockResolvedValueOnce({ id: 'tr_e', status: 'expired', metadata: {} })
      const resExpired = await adapter.verifyWebhook({}, 'id=tr_e')
      expect(resExpired.eventType).toBe('FAILED')
    })

    it('throws error when transaction id is missing from webhook payload', async () => {
      const adapter = new MollieGatewayAdapter()
      await expect(adapter.verifyWebhook({}, '')).rejects.toThrow('Missing or invalid transaction ID')
    })
  })

  describe('4. captureFunds lifecycle handling', () => {
    it('returns true immediately for paid Swish transactions without calling paymentCaptures', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_swish_paid',
        status: 'paid',
        amount: { currency: 'SEK', value: '150.00' },
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.captureFunds('tr_swish_paid', 15000)

      expect(result).toBe(true)
      expect(mockPaymentCaptures.create).not.toHaveBeenCalled()
    })

    it('calls paymentCaptures.create for authorized Card transactions', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_card_auth',
        status: 'authorized',
        amount: { currency: 'SEK', value: '200.00' },
      })
      mockPaymentCaptures.create.mockResolvedValueOnce({
        id: 'cpt_123',
        status: 'succeeded',
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.captureFunds('tr_card_auth', 20000)

      expect(mockPaymentCaptures.create).toHaveBeenCalledWith({
        paymentId: 'tr_card_auth',
        amount: { currency: 'SEK', value: '200.00' },
        description: expect.any(String),
      })
      expect(result).toBe(true)
      expect(mockPayments.releaseAuthorization).not.toHaveBeenCalled()
    })

    it('releases remaining hold when fulfilledTotal is less than authorized amount (shortage)', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_card_short',
        status: 'authorized',
        amount: { currency: 'SEK', value: '300.00' },
      })
      mockPaymentCaptures.create.mockResolvedValueOnce({
        id: 'cpt_short',
        status: 'succeeded',
      })
      mockPayments.releaseAuthorization.mockResolvedValueOnce(true)

      const adapter = new MollieGatewayAdapter()
      // Only capture 200.00 SEK instead of 300.00 SEK
      const result = await adapter.captureFunds('tr_card_short', 20000)

      expect(mockPaymentCaptures.create).toHaveBeenCalledWith({
        paymentId: 'tr_card_short',
        amount: { currency: 'SEK', value: '200.00' },
        description: expect.any(String),
      })
      expect(mockPayments.releaseAuthorization).toHaveBeenCalledWith('tr_card_short')
      expect(result).toBe(true)
    })
  })

  describe('5. cancelAuthorization & refundPayment', () => {
    it('cancels an authorized/cancelable payment via payments.cancel', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_cancel_me',
        status: 'open',
        isCancelable: true,
      })
      mockPayments.cancel.mockResolvedValueOnce({
        id: 'tr_cancel_me',
        status: 'canceled',
      })

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.cancelAuthorization('tr_cancel_me')

      expect(mockPayments.cancel).toHaveBeenCalledWith('tr_cancel_me')
      expect(result).toBe(true)
    })

    it('calls releaseAuthorization when authorized but isCancelable is false', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_release_me',
        status: 'authorized',
        isCancelable: false,
      })
      mockPayments.releaseAuthorization.mockResolvedValueOnce(true)

      const adapter = new MollieGatewayAdapter()
      const result = await adapter.cancelAuthorization('tr_release_me')

      expect(mockPayments.releaseAuthorization).toHaveBeenCalledWith('tr_release_me')
      expect(result).toBe(true)
    })

    it('refunds a settled payment via paymentRefunds.create', async () => {
      mockPayments.get.mockResolvedValueOnce({
        id: 'tr_refund_me',
        amount: { currency: 'SEK', value: '100.00' },
      })
      mockPaymentRefunds.create.mockResolvedValueOnce({
        id: 're_123',
        status: 'pending',
      })

      const adapter = new MollieGatewayAdapter()
      const params: RefundPaymentParams = {
        paymentId: 'tr_refund_me',
        orderReference: 'ORD-777',
        amountMinor: 5000, // 50.00 SEK refund
        reason: 'Item out of stock',
      }

      const result = await adapter.refundPayment(params)

      expect(mockPaymentRefunds.create).toHaveBeenCalledWith({
        paymentId: 'tr_refund_me',
        amount: { currency: 'SEK', value: '50.00' },
        description: 'Item out of stock',
        metadata: { orderReference: 'ORD-777' },
      })
      expect(result).toBe(true)
    })
  })
})

