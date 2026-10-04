// server/services/payments/index.ts
import type { PaymentGatewayAdapter, PaymentProviderType } from '../../../types/payment'
import { StripeGatewayAdapter } from './stripe.adapter'
import { SwishGatewayAdapter } from './swish.adapter'

/**
 * In-memory adapter cache (Registry / Multiton Pattern).
 * Reuses instantiated gateway adapter instances across server requests to avoid
 * redundant initialization overhead and certificate file re-reading.
 */
const registry = new Map<PaymentProviderType, PaymentGatewayAdapter>()

/**
 * Factory function that resolves and returns the payment gateway adapter for a specified provider.
 *
 * Implements lazy initialization:
 * - Checks the internal registry to see if an adapter instance already exists.
 * - Instantiates the appropriate adapter if this is the first request for that provider.
 * - Stores the initialized adapter in the registry for future requests.
 *
 * @param provider - The requested payment provider identifier ('STRIPE', 'SWISH', etc.).
 * @throws Error if an unrecognized or unsupported payment provider is requested.
 * @returns The singleton PaymentGatewayAdapter instance configured for the requested provider.
 */
export function getPaymentGateway(provider: PaymentProviderType): PaymentGatewayAdapter {
  if (!registry.has(provider)) {
    if (provider === 'STRIPE') {
      registry.set('STRIPE', new StripeGatewayAdapter())
    } else if (provider === 'SWISH') {
      registry.set('SWISH', new SwishGatewayAdapter())
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`)
    }
  }

  return registry.get(provider)!
}