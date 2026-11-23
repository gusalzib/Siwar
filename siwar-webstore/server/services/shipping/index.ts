// server/services/shipping/index.ts

import type { ShippingCarrierAdapter, ShippingCarrierName } from '~/server/types/shipping'
import { DhlAdapter, dhlAdapter } from './dhl.adapter'

export * from '~/server/types/shipping'
export { DhlAdapter, dhlAdapter }

/**
 * Cache singleton carrier adapter instances to reuse connections and configuration state.
 */
const carrierRegistry: Map<string, ShippingCarrierAdapter> = new Map()

// Register default DHL carrier instance
carrierRegistry.set('DHL', dhlAdapter)

/**
 * Factory resolver for shipping carrier adapters.
 * Decouples order fulfillment dispatch from specific logistics carriers.
 *
 * Defaults to 'DHL' per platform delivery strategy.
 *
 * @param carrier Requested carrier name (e.g. 'DHL', 'POSTNORD'). Case-insensitive.
 * @returns An adapter conforming to the ShippingCarrierAdapter domain interface.
 */
export function getShippingCarrier(carrier: string = 'DHL'): ShippingCarrierAdapter {
  const normalizedKey = (carrier || 'DHL').trim().toUpperCase()

  const existing = carrierRegistry.get(normalizedKey)
  if (existing) {
    return existing
  }

  // Resolve by known carrier implementations
  switch (normalizedKey) {
    case 'DHL': {
      const adapter = new DhlAdapter()
      carrierRegistry.set(normalizedKey, adapter)
      return adapter
    }
    default: {
      console.warn(
        `[ShippingFactory] Carrier '${carrier}' is not yet explicitly implemented; falling back to default carrier 'DHL'.`
      )
      return dhlAdapter
    }
  }
}

/**
 * Default shipping carrier instance for primary platform dispatch (DHL Freight Sweden).
 */
export const defaultShippingCarrier: ShippingCarrierAdapter = dhlAdapter

