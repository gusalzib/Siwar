// tests/unit/kassa.component.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KassaPage from '~/pages/kassa.vue'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

vi.mock('nuxt/app', () => ({
  useCookie: (name: string, options: any) => {
    return { value: options?.default ? options.default() : null }
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}))

// Mock Nuxt composables and components
vi.stubGlobal('useRouter', () => ({ replace: vi.fn(), push: vi.fn() }))
vi.stubGlobal('useLocalePath', () => (path: string) => path)
vi.stubGlobal('useI18n', () => ({
  t: (key: string, paramsOrFallback?: any, fallback?: string) => {
    if (typeof fallback === 'string') return fallback
    if (typeof paramsOrFallback === 'string') return paramsOrFallback
    return key
  },
  locale: { value: 'sv' },
}))

describe('Rigorous Component Test: pages/kassa.vue', () => {
  let pinia: ReturnType<typeof createPinia>
  let cartStore: ReturnType<typeof useCartStore>
  let preferences: ReturnType<typeof usePreferencesStore>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock Nuxt composables like useCookie before instantiating stores

    cartStore = useCartStore()
    preferences = usePreferencesStore()
    preferences.currency = 'SEK'

    // Mock cart with 1x Food item (112.00 SEK: 100 net + 12 moms)
    // and 1x Merchandise item (100.00 SEK: 80 net + 20 moms)
    cartStore.items = [
      {
        productId: 'food_1',
        name: { sv: 'Tahini' },
        thumbnailUrl: '',
        price: { SEK: 11200, EUR: 1100, USD: 1200 },
        momsRate: 12,
        grossWeight: 1000,
        availableStock: 5,
        quantity: 1,
      },
      {
        productId: 'item_2',
        name: { sv: 'Rökelsekar' },
        thumbnailUrl: '',
        price: { SEK: 10000, EUR: 1000, USD: 1100 },
        momsRate: 25,
        grossWeight: 1000,
        availableStock: 5,
        quantity: 1,
      },
    ]
  })

  function createWrapper() {
    return mount(KassaPage, {
      global: {
        plugins: [pinia],
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          Icon: { template: '<span />' },
          Transition: false,
        },
      },
    })
  }

  it('catches sign inversion in effectiveShippingMomsMinor & Net', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any

    // Ensure Delivery is selected (Cart weight 2kg -> shipping 77.00 SEK / 7700 ore)
    vm.fulfillmentMethod = 'DELIVERY'

    // 77 SEK gross -> Tax: round(7700 * 25 / 125) = 1540 ore (15.40 SEK)
    // Net: 7700 - 1540 = 6160 ore (61.60 SEK)
    expect(vm.effectiveShippingFeeMinor).toBe(7700)
    expect(vm.effectiveShippingMomsMinor).toBe(1540)
    expect(vm.effectiveShippingNetMinor).toBe(6160)

    // Identity check: Gross MUST equal Net + Moms
    expect(vm.effectiveShippingNetMinor + vm.effectiveShippingMomsMinor).toBe(
      vm.effectiveShippingFeeMinor
    )
  })

  it('catches sign inversion in checkoutGrandTotalMinor', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any

    vm.fulfillmentMethod = 'DELIVERY'

    // Products gross = 11200 + 10000 = 21200 ore (212.00 SEK)
    // Shipping gross = 7700 ore (77.00 SEK)
    // Grand Total MUST be 21200 + 7700 = 28900 ore (289.00 SEK)
    // If you wrote: cartSubtotalMinor - effectiveShippingFeeMinor, this FAILS (13500 != 28900)
    expect(vm.checkoutGrandTotalMinor).toBe(28900)
  })

  it('catches sign inversion in checkoutTotalMomsMinor', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any

    vm.fulfillmentMethod = 'DELIVERY'

    // Items Moms 12%: round(11200 * 12 / 112) = 1200 ore
    // Items Moms 25%: round(10000 * 25 / 125) = 2000 ore
    // Shipping Moms: round(7700 * 25 / 125) = 1540 ore
    // Total moms MUST be 1200 + 2000 + 1540 = 4740 ore (47.40 SEK)
    // If you wrote: 1200 - 2000 - 1540, this produces -2340 and FAILS immediately!
    expect(vm.checkoutTotalMomsMinor).toBe(4740)
  })

  it('verifies that In-Store Pickup zeros out shipping fee and shipping moms', async () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any

    vm.fulfillmentMethod = 'PICKUP'

    expect(vm.effectiveShippingFeeMinor).toBe(0)
    expect(vm.effectiveShippingMomsMinor).toBe(0)
    expect(vm.effectiveShippingNetMinor).toBe(0)
    expect(vm.checkoutGrandTotalMinor).toBe(cartStore.cartSubtotalMinor)
  })

  it('displays dynamic deliveryDays from StoreSettings via cartStore.shippingConfig instead of hardcoded timeframe', async () => {
    const prevFetch = (globalThis as any).$fetch
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/settings') {
          return {
            shipping: {
              freeShippingThresholdMinorSEK: 89900,
              freeShippingItemGrantsEntireOrder: false,
              deliveryDays: { min: 2, max: 7 },
              tiers: [],
            },
          }
        }
        return {}
      })
    )

    try {
      await cartStore.fetchShippingConfig()
      expect(cartStore.shippingConfig.deliveryDays).toEqual({ min: 2, max: 7 })

      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('2–7 vardagar via DHL')
    } finally {
      vi.stubGlobal('$fetch', prevFetch)
    }
  })

  it('parameterizes checkout.parcelDeliveryDesc and legal.terms.sec4_delivery_desc across sv, en, and ar locales', () => {
    for (const locName of ['sv.json', 'en.json', 'ar.json']) {
      const json = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, `../../i18n/locales/${locName}`), 'utf-8')
      )
      expect(json.checkout.parcelDeliveryDesc).toContain('{min}')
      expect(json.checkout.parcelDeliveryDesc).toContain('{max}')
      expect(json.legal.terms.sec4_delivery_desc).toContain('{min}')
      expect(json.legal.terms.sec4_delivery_desc).toContain('{max}')
    }
  })
})