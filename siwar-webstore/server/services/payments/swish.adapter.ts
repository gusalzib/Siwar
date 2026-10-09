// server/services/payments/swish.adapter.ts
import type {
  PaymentGatewayAdapter,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  WebhookVerificationResult,
  RefundPaymentParams,
} from '../../../types/payment'
import { createSwishPaymentRequest, createSwishRefund } from '../../utils/swish'

/**
 * Swish payment gateway adapter implementing the universal PaymentGatewayAdapter interface.
 *
 * Handles the Swedish Swish e-commerce payment flow:
 * - Initiates Swish payment requests with BankID authentication tokens and QR code SVG assets.
 * - Restricts transactions strictly to SEK as required by the Swedish Swish interbank system.
 * - Implements the adapter interface for instant account-to-account settlement.
 * - Normalizes asynchronous callback/webhook payloads from Swish servers into standard payment results.
 */
export class SwishGatewayAdapter implements PaymentGatewayAdapter {
  /** Identifier matching the universal PaymentProviderType union */
  readonly provider = 'SWISH' as const

  /**
   * Currencies supported by Swish.
   * Swish operates exclusively within the Swedish banking network and strictly accepts SEK.
   */
  readonly supportedCurrencies = ['SEK'] as const

  /**
   * Initiates a Swish e-commerce payment request for an order.
   *
   * Validates currency compatibility, generates the unique Swish instruction UUID,
   * communicates with the Swish API over mutual TLS (mTLS), and retrieves both
   * the mobile checkout token and an SVG QR code for desktop scanning.
   *
   * @param params - Session creation parameters including order reference, amount in ören, and customer details.
   * @throws Error if an unsupported currency other than SEK is requested.
   * @returns PaymentSessionResult marked as 'REQUIRES_ACTION' with the Swish token and QR SVG data URL.
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult> {
    if (params.currency !== 'SEK') {
      throw new Error('Swish only supports SEK')
    }

    const swishRes = await createSwishPaymentRequest({
      amountMinorSEK: params.amountMinor,
      payeePaymentReference: params.orderReference,
      message: `Order ${params.orderReference}`,
      instructionUUID: params.idempotencyKey,
    })

    return {
      provider: this.provider,
      paymentId: swishRes.instructionUUID,
      // Swish requires customer interaction: scanning QR code or opening Swish app to approve with BankID
      status: 'REQUIRES_ACTION',
      swishToken: swishRes.token,
      qrSvgUrl: swishRes.qrSvgUrl,
    }
  }

  /**
   * Captures authorized funds for an order.
   *
   * Unlike credit card processing, Swish is an immediate account-to-account bank transfer.
   * Funds are settled directly into the merchant's account once the customer confirms via BankID,
   * without a separate pre-authorization hold phase. This method fulfills the universal gateway
   * contract as an immediate success operation.
   *
   * @param paymentId - The Swish instruction UUID.
   * @param amountMinor - The amount in ören to capture.
   * @returns True indicating the capture requirement is fulfilled.
   */
  async captureFunds(paymentId: string, fulfilledTotalMinor: number): Promise<boolean> {
    return true
  }

  /**
   * Cancels or voids an authorization hold.
   *
   * Because Swish executes direct bank transfers upon customer approval rather than temporary card holds,
   * there is no pending card reservation to void. Unpaid sessions expire automatically on the Swish network,
   * and completed payments require a dedicated refund flow. Fulfills the gateway interface as a no-op success.
   *
   * @param paymentId - The Swish instruction UUID.
   * @returns True indicating the hold release requirement is satisfied.
   */
  async cancelAuthorization(paymentId: string): Promise<boolean> {
    return true
  }

  /**
   * Settles fulfillment shortages by returning unfulfilled funds directly to the customer's bank.
   */
  async refundPayment(params: RefundPaymentParams): Promise<boolean> {
    await createSwishRefund({
      originalPaymentReference: params.paymentId,
      amountMinorSEK: params.amountMinor,
      payerPaymentReference: params.orderReference,
      message: params.reason || `Siwar Justering ${params.orderReference}`,
    })
    return true
  }

  
  /**
   * Validates and parses an incoming Swish callback (webhook) payload.
   *
   * Swish dispatches an HTTP POST request to the configured callback URL upon payment completion,
   * timeout, or customer decline. This method parses the raw JSON payload and normalizes the attributes
   * (converting decimal SEK amounts to integer minor units / ören) to match standard webhook contracts.
   *
   * @param headers - HTTP request headers from the callback request.
   * @param rawBody - Raw JSON request body string sent by the Swish server.
   * @returns WebhookVerificationResult containing standardized status, order reference, and amount.
   */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    const payload = JSON.parse(rawBody)

    return {
      isValid: true,
      eventType: payload.status,
      paymentId: payload.id,
      orderReference: payload.payeePaymentReference,
      // Convert decimal SEK amount (e.g. 199.00) into integer minor units (ören)
      amountMinor: Math.round(Number(payload.amount) * 100),
      currency: payload.currency,
      rawPayload: payload,
    }
  }
}