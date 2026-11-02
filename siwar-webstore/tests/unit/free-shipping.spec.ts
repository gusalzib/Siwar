// tests/unit/free-shipping.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore, type CartItem } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'
import { calculateShippingFee, type ServerShippingConfig } from '~/server/services/shipping.service'

vi.mock('nuxt/app', () => ({
  useCookie: (name: string, options: any) => ({
    value: options?.default ? options.default() : null,
  }),
}))

describe('Issue #42: Product-Level Free Shipping & Payment Exit Guard', () => {
  describe('1. Free Shipping Service Rules (server/services/shipping.service.ts)', () => {
    const customConfig: ServerShippingConfig = {
      freeShippingThresholdMinorSEK: 89900,
      freeShippingItemGrantsEntireOrder: false,
      deliveryDays: { min: 1, max: 3 },
      tiers: [
        { maxWeightGrams: 3000, feeMinorSEK: 7700 },
        { maxWeightGrams: 7000, feeMinorSEK: 8900 },
        { maxWeightGrams: Infinity, feeMinorSEK: 10900 },
      ],
    }

    it('exempts freeShipping items from gross parcel weight calculation', async () => {
      // 2kg normal item + 2kg free shipping item
      // Gross weight = 4000g, but billable weight = 2000g (<= 3000g -> tier 1: 77 SEK)
      const items = [
        { productId: 'p1', quantity: 1, grossWeight: 2000, freeShipping: false },
        { productId: 'p2', quantity: 1, grossWeight: 2000, freeShipping: true },
      ]

      const result = await calculateShippingFee(items, 50000, undefined, customConfig)
      expect(result.feeMinorSEK).toBe(7700)
      expect(result.isFreeShipping).toBe(false)
    })

    it('sets shipping fee to 0 if all items in cart have freeShipping: true', async () => {
      const items = [
        { productId: 'p1', quantity: 2, grossWeight: 5000, freeShipping: true },
      ]

      const result = await calculateShippingFee(items, 20000, undefined, customConfig)
      expect(result.feeMinorSEK).toBe(0)
      expect(result.isFreeShipping).toBe(true)
    })

    it('sets shipping fee to 0 if freeShippingItemGrantsEntireOrder is true and at least one item has freeShipping', async () => {
      const campaignConfig: ServerShippingConfig = {
        ...customConfig,
        freeShippingItemGrantsEntireOrder: true,
      }

      // Heavy 20kg order with a single free shipping spice packet
      const items = [
        { productId: 'p_heavy', quantity: 1, grossWeight: 20000, freeShipping: false },
        { productId: 'p_free', quantity: 1, grossWeight: 50, freeShipping: true },
      ]

      const result = await calculateShippingFee(items, 30000, undefined, campaignConfig)
      expect(result.feeMinorSEK).toBe(0)
      expect(result.isFreeShipping).toBe(true)
    })

    it('does not grant free shipping for whole order if freeShippingItemGrantsEntireOrder is false and normal items present', async () => {
      const normalConfig: ServerShippingConfig = {
        ...customConfig,
        freeShippingItemGrantsEntireOrder: false,
      }

      // 4kg normal + 50g free shipping
      // Billable weight = 4000g (tier 2: 7000g -> 89 SEK)
      const items = [
        { productId: 'p_normal', quantity: 1, grossWeight: 4000, freeShipping: false },
        { productId: 'p_free', quantity: 1, grossWeight: 50, freeShipping: true },
      ]

      const result = await calculateShippingFee(items, 30000, undefined, normalConfig)
      expect(result.feeMinorSEK).toBe(8900)
      expect(result.isFreeShipping).toBe(false)
    })
  })

  describe('2. Pinia Cart Store Free Shipping Integration (stores/cart.ts)', () => {
    let cartStore: ReturnType<typeof useCartStore>
    let preferencesStore: ReturnType<typeof usePreferencesStore>

    const normalItem: Omit<CartItem, 'quantity'> = {
      productId: 'prod_normal',
      name: { sv: 'Standardvara' },
      thumbnailUrl: '',
      price: { SEK: 10000, EUR: 1000, USD: 1000 },
      momsRate: 25,
      grossWeight: 2000,
      availableStock: 10,
      freeShipping: false,
    }

    const freeShippingItem: Omit<CartItem, 'quantity'> = {
      productId: 'prod_free_box',
      name: { sv: 'Presentlåda med fri frakt' },
      thumbnailUrl: '',
      price: { SEK: 25000, EUR: 2500, USD: 2500 },
      momsRate: 12,
      grossWeight: 2000,
      availableStock: 5,
      freeShipping: true,
    }

    beforeEach(() => {
      setActivePinia(createPinia())
      const storage: Record<string, string> = {}
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          storage[key] = String(val)
        }),
        removeItem: vi.fn((key: string) => {
          delete storage[key]
        }),
        clear: vi.fn(() => {
          for (const k in storage) delete storage[k]
        }),
      })
      vi.stubGlobal('window', {})

      cartStore = useCartStore()
      preferencesStore = usePreferencesStore()
      preferencesStore.currency = 'SEK'
    })

    it('excludes freeShipping items from totalGrossWeightGrams calculation', () => {
      cartStore.addItem(normalItem, 1) // 2000g
      cartStore.addItem(freeShippingItem, 1) // 2000g but freeShipping: true

      // Billable gross weight should only be 2000g, not 4000g
      expect(cartStore.totalGrossWeightGrams).toBe(2000)
    })

    it('evaluates isFreeShippingQualified to true when all items have freeShipping', () => {
      cartStore.addItem(freeShippingItem, 1)

      expect(cartStore.isFreeShippingQualified).toBe(true)
      expect(cartStore.shippingFeeMinor).toBe(0)
    })
  })

  describe('3. Payment Exit Guard & Confirmation Modal (pages/checkout/payment.vue)', () => {
    const paymentPagePath = path.resolve(__dirname, '../../pages/checkout/payment.vue')
    const paymentPageContent = fs.readFileSync(paymentPagePath, 'utf-8')

    it('attaches window beforeunload listener and router onBeforeRouteLeave guard', () => {
      expect(paymentPageContent).toContain("window.addEventListener('beforeunload', handleBeforeUnload)")
      expect(paymentPageContent).toContain('onBeforeRouteLeave')
    })

    it('renders a confirmation modal warning user about leaving active payment session', () => {
      expect(paymentPageContent).toContain('isLeaveModalOpen')
      expect(paymentPageContent).toContain('confirmLeavePayment')
      expect(paymentPageContent).toContain('Är du säker på att du vill lämna betalningen? Din beställning är inte slutförd ännu.')
    })

    it('sends ABANDONED status to cancel-session when user confirms exit or on beacon unload', () => {
      expect(paymentPageContent).toContain("status: 'ABANDONED'")
      expect(paymentPageContent).toContain("navigator.sendBeacon('/api/checkout/cancel-session'")
    })

    it('removes beforeunload listener upon successful payment authorization', () => {
      expect(paymentPageContent).toContain('isPaymentCommitted.value = true')
      expect(paymentPageContent).toContain("window.removeEventListener('beforeunload', handleBeforeUnload)")
    })
  })
})
