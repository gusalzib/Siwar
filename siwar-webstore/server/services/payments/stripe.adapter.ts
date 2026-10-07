// server/services/payments/stripe.adapter.ts
import Stripe from 'stripe'
import type {
  PaymentGatewayAdapter,
  CreatePaymentSessionParams,
  PaymentSessionResult,
  WebhookVerificationResult,
} from '../../../types/payment'

/**
 * Stripe payment gateway adapter implementing the universal PaymentGatewayAdapter interface.
 *
 * This adapter manages the end-to-end Stripe payment lifecycle:
 * - Creates PaymentIntents with manual capture to authorize funds during checkout.
 * - Captures authorized funds upon order packaging in the warehouse.
 * - Releases authorization holds if an order is canceled or items are out of stock.
 * - Cryptographically verifies inbound Stripe webhooks using HMAC signatures.
 */
export class StripeGatewayAdapter implements PaymentGatewayAdapter {
  /** Identifier matching the universal PaymentProviderType union */
  readonly provider = 'STRIPE' as const

  /** Currencies accepted by the store for Stripe transactions */
  readonly supportedCurrencies = ['SEK', 'EUR', 'USD'] as const

  /** Internal Stripe SDK instance */
  private stripe: Stripe

  /**
   * Initializes the Stripe SDK client using server-only runtime configuration.
   * Ensures the secret key remains secure and locked to the configured API version.
   */
  constructor() {
    const config = useRuntimeConfig()
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2026-08-26.dahlia',
    })
  }

  /**
   * Creates an authorized PaymentIntent session for the checkout process.
   *
   * Utilizes manual capture ('capture_method: manual') to place an authorization hold
   * on the customer's payment method. Funds are reserved on the card but not settled
   * until warehouse fulfillment confirms inventory availability and completes packaging.
   *
   * @param params - Payment session initialization parameters including order details, customer contact, and amount in minor currency units.
   * @returns PaymentSessionResult containing the client secret required by Stripe Elements on the frontend.
   */
  async createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amountMinor,
      currency: params.currency.toLowerCase(),
      // Place an authorization hold rather than charging immediately (supports warehouse packing workflow)
      capture_method: 'manual',
      receipt_email: params.customer.email,
      // Metadata allows cross-referencing and reconciliation directly within the Stripe Dashboard
      metadata: {
        orderReference: params.orderReference,
        customerName: params.customer.fullName,
        customerPhone: params.customer.phone,
        ...params.metadata,
      },
    }, 
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined  
    )

    return {
      provider: this.provider,
      paymentId: paymentIntent.id,
      status: 'REQUIRES_ACTION',
      clientSecret: paymentIntent.client_secret || undefined,
    }
  }

  /**
   * Captures previously authorized funds once order fulfillment has been verified.
   * Supports partial or full capture up to the authorized amount.
   *
   * @param paymentId - The Stripe PaymentIntent ID (e.g. pi_xxx).
   * @param amountMinor - The amount to capture in minor currency units (cents, ören).
   * @returns True if the capture succeeded and status is 'succeeded', false otherwise.
   */
  async captureFunds(paymentId: string, amountMinor: number): Promise<boolean> {
    const intent = await this.stripe.paymentIntents.capture(paymentId, {
      amount_to_capture: amountMinor,
    })
    return intent.status === 'succeeded'
  }

  /**
   * Cancels or voids an active authorization hold.
   * Used when an order is canceled prior to fulfillment or when inventory shortages occur,
   * immediately releasing the held funds back to the customer's payment method.
   *
   * @param paymentId - The Stripe PaymentIntent ID (e.g. pi_xxx).
   * @returns True if the authorization was successfully canceled, false otherwise.
   */
  async cancelAuthorization(paymentId: string): Promise<boolean> {
    const intent = await this.stripe.paymentIntents.cancel(paymentId)
    return intent.status === 'canceled'
  }

  /**
   * Cryptographically validates an incoming Stripe webhook payload using the webhook signing secret.
   * Extracts and standardizes event information to isolate external provider details from business logic.
   *
   * @param headers - Request headers containing the 'stripe-signature' HMAC header.
   * @param rawBody - Raw unparsed HTTP request payload string required for signature computation.
   * @throws Error if the signature header is missing or signature verification fails.
   * @returns WebhookVerificationResult containing normalized payment and event data.
   */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<WebhookVerificationResult> {
    const sig = headers['stripe-signature']
    if (!sig) {
      throw new Error('Missing stripe-signature header')
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
    // Validates payload authenticity and integrity against Stripe's signing secret
    const event = this.stripe.webhooks.constructEvent(rawBody, sig, secret)

    // Extract PaymentIntent object if event payload contains one
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    return {
      isValid: true,
      eventType: event.type,
      paymentId: paymentIntent?.id,
      orderReference: paymentIntent?.metadata?.orderReference,
      amountMinor: paymentIntent?.amount,
      currency: paymentIntent?.currency?.toUpperCase(),
      rawPayload: event,
    }
  }
}