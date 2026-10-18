// types/payment.ts

/**
 * Supported payment providers across the platform.
 * Used for routing checkout requests and gateway factory lookups.
 */
export type PaymentProviderType = 'STRIPE' | 'SWISH'

/**
 * Unified payment lifecycle states across all gateways.
 * Normalizes provider-specific statuses into a consistent state machine for orders.
 */
export type PaymentHoldStatus =
  /** Customer action required (e.g. 3D Secure verification on card, or BankID approval in Swish) */
  | 'REQUIRES_ACTION'
  /** Funds are authorized and held on customer's account, ready to be captured upon warehouse packing */
  | 'REQUIRES_CAPTURE'
  /** Payment is captured and funds have been successfully settled */
  | 'SUCCEEDED'
  /** Payment failed, was rejected by the bank, or timed out */
  | 'FAILED'
  /** Payment session or authorization hold was canceled by the customer or merchant */
  | 'CANCELED'

/**
 * Standard parameters required to initialize a payment session with any provider.
 */
export interface CreatePaymentSessionParams {
  /** Unique merchant order reference used for tracking and reconciliation */
  orderReference: string
  /** Total transaction amount in minor currency units (e.g. cents for EUR/USD, ören for SEK) */
  amountMinor: number
  /** Three-letter ISO 4217 currency code */
  currency: 'SEK' | 'EUR' | 'USD'
  /** Basic customer contact details required by payment providers */
  customer: {
    fullName: string
    email: string
    phone: string
  }
  /** Additional provider metadata or custom tracking key-value pairs */
  metadata?: Record<string, string>

  /** Unique idempotency key to prevent duplicate charges or sessions on retries */
  idempotencyKey?: string
}

/**
 * Unified response returned by all payment adapters after creating a payment session.
 * Contains provider-agnostic identifiers as well as provider-specific frontend artifacts.
 */
export interface PaymentSessionResult {
  /** The payment provider that generated this session */
  provider: PaymentProviderType
  /** Unique transaction or payment identifier issued by the provider */
  paymentId: string
  /** Initial status of the payment session */
  status: PaymentHoldStatus
  /** Client secret required by Stripe Elements on the frontend */
  clientSecret?: string
  /** Self-contained Base64 SVG Data URL of the Swish QR code for desktop checkout */
  qrSvgUrl?: string
  /** Swish payment request token used to launch the Swish app on mobile */
  swishToken?: string
  /** External redirect URL used for hosted checkout gateways (e.g. Klarna) */
  redirectUrl?: string
}

/**
 * Standardized result extracted from an inbound webhook or callback notification.
 * Shields the application core from disparate third-party webhook payload structures.
 */
export interface WebhookVerificationResult {
  /** Indicates whether the cryptographic signature or authenticity check succeeded */
  isValid: boolean
  /** Provider-specific event type (e.g. 'payment_intent.amount_capturable_updated', 'PAID') */
  eventType: string
  /** Merchant order reference associated with this transaction */
  orderReference?: string
  /** Provider's unique payment or transaction ID */
  paymentId: string
  /** Authorized or captured amount in minor currency units */
  amountMinor?: number
  /** ISO currency code of the transaction */
  currency?: string
  /** Complete raw parsed payload from the provider for audit logging */
  rawPayload: any
}


export interface RefundPaymentParams {
  paymentId: string
  orderReference: string
  amountMinor: number
  reason?: string
}

/**
 * Universal payment gateway adapter contract (Adapter Pattern).
 *
 * Enforces a consistent interface across disparate payment providers (Stripe, Swish, Klarna),
 * allowing checkout flows, warehouse capture jobs, and webhook handlers to operate
 * interchangeably without provider-specific logic leaks.
 */
export interface PaymentGatewayAdapter {
  /** Unique provider identifier matching PaymentProviderType */
  readonly provider: PaymentProviderType

  /** List of ISO currency codes accepted by this specific gateway */
  readonly supportedCurrencies: readonly string[]

  /**
   * Initializes a payment session or places an authorization hold on the customer's funds.
   *
   * @param params - Standard session creation parameters (order reference, amount in minor units, customer info).
   * @returns PaymentSessionResult containing the session status and frontend integration artifacts.
   */
  createSession(params: CreatePaymentSessionParams): Promise<PaymentSessionResult>

  /**
   * Captures previously authorized funds once order fulfillment/packing is confirmed.
   *
   * @param paymentId - Unique payment identifier issued by the provider.
   * @param amountMinor - Amount to capture in minor currency units.
   * @returns Promise resolving to true if capture succeeded, false otherwise.
   */
  captureFunds(paymentId: string, fulfilledTotalMinor: number): Promise<boolean>

  /**
   * Voids or cancels an active authorization hold before capture occurs.
   * Releases held funds back to the customer if an order is canceled or items are out of stock.
   *
   * @param paymentId - Unique payment identifier issued by the provider.
   * @returns Promise resolving to true if authorization was released, false otherwise.
   */
  cancelAuthorization(paymentId: string): Promise<boolean>


  refundPayment?(params: RefundPaymentParams): Promise<boolean>

  /**
   * Verifies the authenticity and cryptographic signature of an inbound webhook,
   * then normalizes the vendor payload into a standardized WebhookVerificationResult.
   *
   * @param headers - Inbound HTTP request headers (e.g. containing signature headers).
   * @param rawBody - Raw unparsed HTTP request body string.
   * @throws Error if signature verification fails or required headers are missing.
   * @returns Promise resolving to normalized event data.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerificationResult>
}