// server/services/payments/mollie.adapter.ts
import { createMollieClient, PaymentStatus, type Payment } from '@mollie/api-client'
import type {
  PaymentGatewayAdapter,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  WebhookVerificationResult,
  RefundPaymentParams,
} from '../../../types/payment'

/**
 * Mollie payment gateway adapter implementing the universal PaymentGatewayAdapter interface.
 *
 * This adapter manages the end-to-end Mollie payment lifecycle (Issue #53):
 * - Initializes hosted checkout sessions for both Credit Cards (with manual capture hold)
 *   and Swish (instant settlement in SEK).
 * - Implements a strict Localhost Guard to avoid Mollie's HTTP 422 rejection when running without
 *   a public webhook tunnel in local development.
 * - Captures authorized funds upon order packaging/dispatch in the warehouse (DHL Freight).
 * - Voids authorization holds or releases excess holds when shortages or cancellations occur.
 * - Authoritatively verifies inbound webhook notifications via direct server-to-server lookup.
 */
export class MollieGatewayAdapter implements PaymentGatewayAdapter {
  /** Identifier matching the universal PaymentProviderType union */
  readonly provider = 'MOLLIE' as const

  /** Currencies accepted by the store for Mollie transactions */
  readonly supportedCurrencies = ['SEK', 'EUR', 'USD'] as const

  /** Internal Mollie API SDK client instance */
  private mollieClient: ReturnType<typeof createMollieClient>

  /**
   * Initializes the Mollie SDK client using server-only runtime configuration.
   * Supports both test keys (test_...) and production keys (live_...).
   */
  constructor() {
    const config = useRuntimeConfig()
    const apiKey = (
      config.mollieApiKey ||
      process.env.MOLLIE_API_KEY ||
      ''
    ).trim()

    if (!apiKey) {
      console.error(
        '❌ MOLLIE_API_KEY is missing! Checked config.mollieApiKey and process.env.MOLLIE_API_KEY. ' +
        'Please ensure MOLLIE_API_KEY is configured in your environment.'
      )
    }

    this.mollieClient = createMollieClient({ apiKey })
  }

  /**
   * Creates a hosted payment session with Mollie.
   *
   * Routing & Capture Strategy:
   * - Card Payments: pass method 'creditcard' and captureMode 'manual'. This places an authorization
   *   hold on the customer's card (authorized) so funds are reserved while warehouse packing (DHL)
   *   verifies stock before capture.
   * - Swish Payments: pass method 'swish' and omit captureMode. Swish settles immediately (paid).
   *
   * Localhost Webhook Guard:
   * - Mollie strictly validates webhookUrl and rejects requests with HTTP 422 if it points to
   *   localhost or 127.0.0.1. We only attach webhookUrl if it is a public non-localhost endpoint.
   *
   * @param params - Standard session creation parameters (order reference, amount in minor units, customer info).
   * @returns PaymentSessionResult containing the checkout redirect URL and initial status.
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult> {
    try {
      const config = useRuntimeConfig()

      // 1. Resolve return redirect URL
      // Priority: explicit MOLLIE_REDIRECT_BASE_URL -> incoming request origin (allows http://localhost:3000 in local dev)
      // -> BASE_URL -> production fallback
      const redirectBase = (
        config.mollieRedirectBaseUrl ||
        process.env.MOLLIE_REDIRECT_BASE_URL ||
        params.metadata?.redirectBaseUrl ||
        process.env.BASE_URL ||
        'https://siwar.se'
      ).trim().replace(/\/$/, '')

      const orderId = params.metadata?.orderId || params.orderReference
      const redirectUrl = `${redirectBase}/order/confirmation/${orderId}`

      // 2. Format monetary amount to string decimal required by Mollie API (e.g. "129.50")
      const formattedAmount = (params.amountMinor / 100).toFixed(2)

      // 3. Localhost Guard: omit webhookUrl if running locally without a public tunnel
      const rawWebhookUrl = (
        config.mollieWebhookUrl ||
        process.env.MOLLIE_WEBHOOK_URL ||
        ''
      ).trim()
      const isLocalhost = /localhost|127\.0\.0\.1/i.test(rawWebhookUrl)
      const webhookUrl = (rawWebhookUrl && !isLocalhost) ? rawWebhookUrl : undefined

      // 4. Method & Capture Mode routing
      const isSwish = params.paymentMethod === 'swish'
      const method = isSwish ? 'swish' : 'creditcard'

      const createPayload: any = {
        amount: {
          currency: params.currency,
          value: formattedAmount,
        },
        description: `Order ${params.orderReference}`,
        redirectUrl,
        method,
        metadata: {
          orderReference: params.orderReference,
          orderId,
          idempotencyKey: params.idempotencyKey || '',
          ...params.metadata,
        },
      }

      // Card payments use two-step authorization ('manual') to allow pre-dispatch fulfillment verification
      if (!isSwish) {
        createPayload.captureMode = 'manual'
      }

      // Attach public webhook URL if available
      if (webhookUrl) {
        createPayload.webhookUrl = webhookUrl
      }

      // 5. Create payment resource in Mollie
      const payment = await this.mollieClient.payments.create(createPayload)
      const checkoutUrl = payment.getCheckoutUrl() || undefined

      if (!checkoutUrl) {
        console.warn(`[Mollie Adapter] No checkout URL returned for payment ${payment.id}. Status: ${payment.status}`)
      }

      return {
        provider: 'MOLLIE',
        paymentId: payment.id,
        status: 'REQUIRES_ACTION',
        checkoutUrl,
        redirectUrl: checkoutUrl,
      }
    } catch (err: any) {
      console.error('[Mollie Adapter] Failed to initialize payment session:', err)
      throw new Error(`Mollie session creation failed: ${err.message || err}`)
    }
  }

  /**
   * Authoritatively verifies an inbound Mollie webhook notification.
   *
   * Mollie webhooks deliver an application/x-www-form-urlencoded or JSON POST body containing
   * only the payment id (tr_...). This method performs a server-to-server API lookup to fetch
   * the authentic payment status directly from Mollie's servers.
   *
   * @param headers - Request headers.
   * @param rawBody - Raw body string containing the transaction id.
   * @returns Normalized WebhookVerificationResult.
   */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    try {
      // 1. Extract transaction id from rawBody (supports urlencoded or JSON)
      let id = ''
      if (typeof rawBody === 'string') {
        const trimmed = rawBody.trim()
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed)
            id = parsed.id || ''
          } catch {}
        }
        if (!id) {
          const urlParams = new URLSearchParams(trimmed)
          id = urlParams.get('id') || ''
        }
      }

      if (!id) {
        throw new Error('Missing or invalid transaction ID in Mollie webhook payload')
      }

      // 2. Perform authoritative server-to-server lookup
      const payment: Payment = await this.mollieClient.payments.get(id)

      if (!payment || !payment.id) {
        throw new Error(`Payment ${id} not found in Mollie API`)
      }

      // 3. Map Mollie payment statuses to internal canonical order event types
      let eventType: string
      switch (payment.status) {
        case PaymentStatus.authorized:
          eventType = 'AUTHORIZED'
          break
        case PaymentStatus.paid:
          eventType = 'PAID'
          break
        case PaymentStatus.canceled:
          eventType = 'CANCELLED'
          break
        case PaymentStatus.failed:
        case PaymentStatus.expired:
          eventType = 'FAILED'
          break
        default:
          eventType = payment.status.toUpperCase()
          break
      }

      // 4. Extract amount in minor currency units (e.g. cents, ören)
      const amountMinor = payment.amount?.value
        ? Math.round(parseFloat(payment.amount.value) * 100)
        : undefined

      const orderReference = (payment.metadata as any)?.orderReference

      return {
        isValid: true,
        eventType,
        orderReference,
        paymentId: payment.id,
        amountMinor,
        currency: payment.amount?.currency,
        rawPayload: payment,
      }
    } catch (err: any) {
      console.error('[Mollie Adapter] Webhook verification failed:', err)
      throw new Error(`Mollie webhook verification error: ${err.message || err}`)
    }
  }

  /**
   * Captures previously authorized funds once order fulfillment/packing is confirmed.
   *
   * - If the payment is already 'paid' (e.g. Swish instant settlement), capture is already satisfied.
   * - If the payment is 'authorized' (Credit Card manual capture), invokes Mollie's Captures API
   *   for the fulfilled amount.
   * - If the fulfilled amount is less than the original authorization, releases the remaining hold.
   *
   * @param paymentId - Unique Mollie payment identifier (tr_...).
   * @param fulfilledTotalMinor - Total amount in minor units to capture.
   * @returns Promise resolving to true if capture succeeded, false otherwise.
   */
  async captureFunds(paymentId: string, fulfilledTotalMinor: number): Promise<boolean> {
    try {
      const payment = await this.mollieClient.payments.get(paymentId)

      // Swish payments settle immediately upon customer confirmation
      if (payment.status === PaymentStatus.paid) {
        return true
      }

      // Card payments in 'authorized' status are captured upon packing
      if (payment.status === PaymentStatus.authorized) {
        const formattedAmount = (fulfilledTotalMinor / 100).toFixed(2)

        const capture = await this.mollieClient.paymentCaptures.create({
          paymentId,
          amount: {
            currency: payment.amount.currency,
            value: formattedAmount,
          },
          description: `Fulfillment capture for payment ${paymentId}`,
        })

        // If warehouse packed a smaller quantity than ordered, release the uncaptured hold
        const authorizedAmountMinor = payment.amount?.value
          ? Math.round(parseFloat(payment.amount.value) * 100)
          : fulfilledTotalMinor

        if (fulfilledTotalMinor < authorizedAmountMinor) {
          try {
            await this.mollieClient.payments.releaseAuthorization(paymentId)
          } catch (relErr: any) {
            console.warn(`[Mollie Adapter] Notice: Could not release remaining hold on ${paymentId}:`, relErr.message)
          }
        }

        return Boolean(capture && capture.id)
      }

      console.warn(`[Mollie Adapter] Cannot capture payment ${paymentId} with status '${payment.status}'`)
      return false
    } catch (err: any) {
      console.error(`[Mollie Adapter] Failed to capture funds for ${paymentId}:`, err)
      return false
    }
  }

  /**
   * Voids or cancels an active authorization hold before capture occurs.
   * Releases held funds back to the customer if an order is canceled or items are out of stock.
   *
   * @param paymentId - Unique Mollie payment identifier (tr_...).
   * @returns Promise resolving to true if authorization was released or canceled, false otherwise.
   */
  async cancelAuthorization(paymentId: string): Promise<boolean> {
    try {
      const payment = await this.mollieClient.payments.get(paymentId)

      // Already canceled
      if (payment.status === PaymentStatus.canceled) {
        return true
      }

      // If cancelable through standard cancellation endpoint
      if (payment.isCancelable) {
        const canceled = await this.mollieClient.payments.cancel(paymentId)
        return canceled.status === PaymentStatus.canceled
      }

      // If in authorized state, release the authorization hold
      if (payment.status === PaymentStatus.authorized) {
        try {
          await this.mollieClient.payments.releaseAuthorization(paymentId)
          return true
        } catch (releaseErr: any) {
          console.warn(`[Mollie Adapter] releaseAuthorization failed on ${paymentId}:`, releaseErr.message)
          return false
        }
      }

      console.warn(`[Mollie Adapter] Payment ${paymentId} cannot be canceled in state '${payment.status}'`)
      return false
    } catch (err: any) {
      console.error(`[Mollie Adapter] Failed to cancel authorization for ${paymentId}:`, err)
      return false
    }
  }

  /**
   * Issues a refund for settled payments (such as Swish or captured card payments).
   * Used when items are out of stock during packing or for returns.
   *
   * @param params - Refund parameters including paymentId, orderReference, and amount in minor units.
   * @returns Promise resolving to true if refund was created, false otherwise.
   */
  async refundPayment(params: RefundPaymentParams): Promise<boolean> {
    try {
      const payment = await this.mollieClient.payments.get(params.paymentId)

      const formattedAmount = (params.amountMinor / 100).toFixed(2)

      const refund = await this.mollieClient.paymentRefunds.create({
        paymentId: params.paymentId,
        amount: {
          currency: payment.amount?.currency || 'SEK',
          value: formattedAmount,
        },
        description: params.reason || `Shortage refund for order ${params.orderReference}`,
        metadata: {
          orderReference: params.orderReference,
        },
      })

      return Boolean(refund && refund.id)
    } catch (err: any) {
      console.error(`[Mollie Adapter] Failed to create refund for ${params.paymentId}:`, err)
      return false
    }
  }
}

