// tests/unit/cart.store.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore, type CartItem } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

vi.mock('nuxt/app', () => ({
  useCookie: (name: string, options: any) => {
    return { value: options?.default ? options.default() : null }
  }
}))

describe('Issue #8: Pinia Cart Store Suite', () => {
  let cartStore: ReturnType<typeof useCartStore>
  let preferencesStore: ReturnType<typeof usePreferencesStore>

  // Reusable sample products
  const foodItem: Omit<CartItem, 'quantity'> = {
    productId: 'prod_tahini',
    sku: 'TAH-450',
    name: { ar: 'طحينة', sv: 'Tahini', en: 'Tahini' },
    thumbnailUrl: 'https://example.com/tahini.webp',
    price: { SEK: 5000, EUR: 500, USD: 550 }, // 50.00 SEK, 5.00 EUR, 5.50 USD
    momsRate: 12, // 12% food tax
    grossWeight: 500, // 500 grams
    availableStock: 4,
  }

  const generalMerchandiseItem: Omit<CartItem, 'quantity'> = {
    productId: 'prod_burner',
    sku: 'BRN-100',
    name: { ar: 'مبخرة', sv: 'Rökelsekar', en: 'Incense Burner' },
    thumbnailUrl: 'https://example.com/burner.webp',
    price: { SEK: 12000, EUR: 1100, USD: 1200 }, // 120.00 SEK
    momsRate: 25, // 25% non-food tax
    grossWeight: 600,
    availableStock: 2,
  }
    beforeEach(() => {
        // 1. Fresh Pinia instance
        setActivePinia(createPinia())

        // 2. Mock storage dictionary
        const storage: Record<string, string> = {}
        const mockLocalStorage = {
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
    }

    // 3. Stub global localStorage and window so isClient() returns true
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('window', {})
    


    cartStore = useCartStore()
    preferencesStore = usePreferencesStore()
    preferencesStore.currency = 'SEK'
  })

  // -------------------------------------------------------------------------
  // AC-1: Prevent Over-Adding Beyond Buffer
  // -------------------------------------------------------------------------
  describe('AC-1: Stock Limits & Clamping Against Available Stock', () => {
    it('approves adding quantities up to availableStock', () => {
      const status = cartStore.addItem(foodItem, 3)

      expect(status).toBe('SUCCESS')
      expect(cartStore.items).toHaveLength(1)
      expect(cartStore.items[0]?.quantity).toBe(3)
    })

    it('clamps quantity to availableStock and returns EXCEEDS_AVAILABLE_STOCK when adding more than stock', () => {
      // availableStock is 4, customer attempts to add 5
      const status = cartStore.addItem(foodItem, 5)

      expect(status).toBe('EXCEEDS_AVAILABLE_STOCK')
      expect(cartStore.items[0]?.quantity).toBe(4) // Clamped to available stock limit
    })

    it('blocks incrementing beyond availableStock and preserves quantity', () => {
      cartStore.addItem(foodItem, 4)

      // Attempt to increment from 4 to 5
      const status = cartStore.incrementQuantity(foodItem.productId)

      expect(status).toBe('EXCEEDS_AVAILABLE_STOCK')
      expect(cartStore.items[0]?.quantity).toBe(4)
    })

    it('blocks adding an item when availableStock is 0', () => {
      const oosItem = { ...foodItem, availableStock: 0 }
      const status = cartStore.addItem(oosItem, 1)

      expect(status).toBe('OUT_OF_STOCK_ONLINE')
      expect(cartStore.items).toHaveLength(0)
    })

    it('automatically removes the item line when decremented to 0', () => {
      cartStore.addItem(foodItem, 1)
      const status = cartStore.decrementQuantity(foodItem.productId)

      expect(status).toBe('ITEM_REMOVED')
      expect(cartStore.items).toHaveLength(0)
      expect(cartStore.totalItemCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // AC-2: Live Currency Switch & Deterministic Swedish Moms Split
  // -------------------------------------------------------------------------
  describe('AC-2: Live Currency Switch & Moms Breakdown', () => {
    it('recalculates product line totals and subtotals instantly when currency changes', () => {
      cartStore.addItem(foodItem, 2) // 2x 50 SEK / 5 EUR / 5.50 USD

      // In SEK
      expect(cartStore.cartSubtotalMinor).toBe(10000) // 100.00 SEK

      // Switch to EUR
      preferencesStore.currency = 'EUR'
      expect(cartStore.cartSubtotalMinor).toBe(1000) // 10.00 EUR

      // Switch to USD
      preferencesStore.currency = 'USD'
      expect(cartStore.cartSubtotalMinor).toBe(1100) // 11.00 USD
    })

    it('computes net subtotal (excluding moms and shipping) and separates food moms from merchandise moms', () => {
      // 1x Food Item (50.00 SEK gross at 12% moms)
      // Food Tax: round(5000 * 12 / 112) = 536 öre. Net: 5000 - 536 = 4464 öre
      cartStore.addItem(foodItem, 1)

      // 1x Merchandise Item (120.00 SEK gross at 25% moms)
      // Goods Tax: round(12000 * 25 / 125) = 2400 öre. Net: 12000 - 2400 = 9600 öre
      cartStore.addItem(generalMerchandiseItem, 1)

      expect(cartStore.productsNetMinor).toBe(4464 + 9600) // 14064 öre (140.64 SEK)
      expect(cartStore.momsBreakdown.itemsMoms12Minor).toBe(536)
      expect(cartStore.momsBreakdown.itemsMoms25Minor).toBe(2400)
    })

    it('dynamically adapts tiered shipping fees and shipping moms by currency', () => {
      // Weight = 500g (Tier 1 <= 3000g)
      cartStore.addItem(foodItem, 1)

      // In SEK: 77.00 SEK (7,700 öre)
      expect(cartStore.shippingFeeMinor).toBe(7700)
      expect(cartStore.shippingMoms25Minor).toBe(1540) // round(7700 * 25 / 125)
      expect(cartStore.grandTotalMinor).toBe(5000 + 7700)

      // In EUR: 7.50 EUR (750 cents)
      preferencesStore.currency = 'EUR'
      expect(cartStore.shippingFeeMinor).toBe(750)
      expect(cartStore.shippingMoms25Minor).toBe(150) // round(750 * 25 / 125)
      expect(cartStore.grandTotalMinor).toBe(500 + 750)

      // In USD: 8.00 USD (800 cents)
      preferencesStore.currency = 'USD'
      expect(cartStore.shippingFeeMinor).toBe(800)
      expect(cartStore.shippingMoms25Minor).toBe(160) // round(800 * 25 / 125)
      expect(cartStore.grandTotalMinor).toBe(550 + 800)
    })

    it('grants free shipping when cart meets threshold (899 SEK / 85 EUR / 90 USD)', () => {
      // Add 18 units of food (18 * 50 SEK = 900.00 SEK > 899.00 SEK)
      const bulkFood = { ...foodItem, availableStock: 25 }
      cartStore.addItem(bulkFood, 18)

      expect(cartStore.isFreeShippingQualified).toBe(true)
      expect(cartStore.shippingFeeMinor).toBe(0)
      expect(cartStore.shippingMoms25Minor).toBe(0)
      expect(cartStore.grandTotalMinor).toBe(cartStore.cartSubtotalMinor)
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: Session Persistence
  // -------------------------------------------------------------------------
  describe('AC-3: Browser Session Persistence', () => {
    it('persists cart mutations to localStorage under siwar_cart', async () => {
      cartStore.hydrateCart()
      cartStore.addItem(foodItem, 2)

      // Wait for Vue's asynchronous deep watcher flush
      await nextTick()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'siwar_cart',
        expect.stringContaining('prod_tahini')
      )
    })

    it('restores stored cart items upon hydration', () => {
      const mockSavedCart = [
        {
          ...foodItem,
          quantity: 3,
        },
      ]
      localStorage.setItem('siwar_cart', JSON.stringify(mockSavedCart))

      // Ensure store starts unhydrated for this check
      cartStore.isHydrated = false
      cartStore.hydrateCart()

      expect(cartStore.items).toHaveLength(1)
      expect(cartStore.items[0]?.productId).toBe('prod_tahini')
      expect(cartStore.items[0]?.quantity).toBe(3)
      expect(cartStore.totalItemCount).toBe(3)
    })
  })
})