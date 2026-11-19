// tests/unit/mollie.section4.ui.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KassaPage from '~/pages/kassa.vue'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

vi.mock('nuxt/app', () => ({
  useCookie: (_name: string, options: any) => ({
    value: options?.default ? options.default() : null,
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.stubGlobal('useRouter', () => ({ replace: vi.fn(), push: vi.fn() }))
vi.stubGlobal('useLocalePath', () => (p: string) => p)
vi.stubGlobal('useI18n', () => ({
  t: (_key: string, paramsOrFallback?: any, fallback?: string) => {
    if (typeof fallback === 'string') return fallback
    if (typeof paramsOrFallback === 'string') return paramsOrFallback
    return _key
  },
  locale: { value: 'sv' },
}))

describe('Issue #53 - Section 4: Storefront Checkout, Payment UI & Confirmation Polling', () => {
  describe('1. pages/kassa.vue — Active Card vs Swish routing through MOLLIE', () => {
    let pinia: ReturnType<typeof createPinia>
    let cartStore: ReturnType<typeof useCartStore>
    let preferences: ReturnType<typeof usePreferencesStore>

    beforeEach(() => {
      pinia = createPinia()
      setActivePinia(pinia)
      cartStore = useCartStore()
      preferences = usePreferencesStore()
      preferences.currency = 'SEK'
      cartStore.items = [
        {
          productId: 'prod_1',
          name: { sv: 'Olivolja' },
          thumbnailUrl: '',
          price: { SEK: 15000, EUR: 1500, USD: 1600 },
          momsRate: 12,
          grossWeight: 1000,
          availableStock: 10,
          quantity: 1,
        },
      ]
    })

    it('defaults paymentMethod to MOLLIE with selectable creditcard and swish sub-methods', async () => {
      const wrapper = mount(KassaPage, {
        global: {
          plugins: [pinia],
          stubs: {
            NuxtLink: { template: '<a><slot /></a>' },
            Icon: { template: '<span />' },
            Transition: false,
          },
        },
      })

      const vm = wrapper.vm as any
      expect(vm.selectedPaymentMethod).toBe('MOLLIE')
      expect(vm.selectedPaymentSubMethod).toBe('creditcard')

      // Card and Swish radio inputs are both present and active in SEK
      const cardRadio = wrapper.find('input[type="radio"][value="creditcard"]')
      const swishRadio = wrapper.find('input[type="radio"][value="swish"]')
      expect(cardRadio.exists()).toBe(true)
      expect(swishRadio.exists()).toBe(true)
      expect(swishRadio.attributes('disabled')).toBeUndefined()

      // Selecting Swish updates sub-method while keeping provider = MOLLIE
      await swishRadio.setValue(true)
      expect(vm.selectedPaymentSubMethod).toBe('swish')
      expect(vm.selectedPaymentMethod).toBe('MOLLIE')

      // Switching currency away from SEK auto-switches sub-method back to creditcard
      preferences.currency = 'EUR'
      await wrapper.vm.$nextTick()
      expect(vm.selectedPaymentSubMethod).toBe('creditcard')
    })
  })

  describe('2. pages/checkout/payment.vue — Mollie Redirect Guard & Legacy Disabled UI (AC-1 & AC-4)', () => {
    const paymentSource = fs.readFileSync(
      path.resolve(__dirname, '../../pages/checkout/payment.vue'),
      'utf-8'
    )

    it('sets isPaymentCommitted before redirecting to Mollie checkoutUrl so beforeunload does not fire ABANDONED beacon', () => {
      expect(paymentSource).toContain('function redirectToMollieCheckout()')
      expect(paymentSource).toContain('isRedirectingToGateway.value = true')
      expect(paymentSource).toContain('isPaymentCommitted.value = true')
      expect(paymentSource).toContain("window.removeEventListener('beforeunload', handleBeforeUnload)")
      expect(paymentSource).toContain('window.location.href = mollieCheckoutUrl.value')

      // Verify isPaymentCommitted is set BEFORE window.location.href assignment
      const commitIdx = paymentSource.indexOf('isPaymentCommitted.value = true', paymentSource.indexOf('function redirectToMollieCheckout'))
      const redirectIdx = paymentSource.indexOf('window.location.href = mollieCheckoutUrl.value')
      expect(commitIdx).toBeGreaterThan(-1)
      expect(redirectIdx).toBeGreaterThan(commitIdx)
    })

    it('AC-4: preserves legacy #stripe-element-mount and Swish QR UI in a visibly disabled, non-clickable container', () => {
      expect(paymentSource).toContain('opacity-40 pointer-events-none select-none')
      expect(paymentSource).toContain('id="stripe-element-mount"')
      expect(paymentSource).toContain('Swish BankID QR')
      expect(paymentSource).toContain('aria-disabled="true"')
    })

    it('uses high-contrast !text-white on Mollie CTA button and avoids glassmorphism', () => {
      expect(paymentSource).toContain("t('checkout.payWithMollie'")
      expect(paymentSource).toContain('!bg-emerald-600 hover:!bg-emerald-700 !text-white')
      expect(paymentSource).not.toContain('backdrop-blur')
    })
  })

  describe('3. pages/order/confirmation/[id].vue — Async Mollie Polling & Status Banners', () => {
    const confirmationSource = fs.readFileSync(
      path.resolve(__dirname, '../../pages/order/confirmation/[id].vue'),
      'utf-8'
    )

    it('implements brief polling when order paymentStatus is PENDING and clears cart upon confirmation', () => {
      expect(confirmationSource).toContain('function startPaymentPolling()')
      expect(confirmationSource).toContain('function stopPaymentPolling()')
      expect(confirmationSource).toContain('clearCompletedCheckoutState()')
      expect(confirmationSource).toContain('cartStore.clearCart()')
      expect(confirmationSource).toContain("t('order.paymentVerifyingTitle'")
      expect(confirmationSource).toContain("t('order.paymentFailedTitle'")
      expect(confirmationSource).toContain("t('order.returnToCheckout'")
    })
  })

  describe('4. Full Localization Parity across sv.json, en.json, and ar.json', () => {
    const requiredCheckoutKeys = [
      'payWithMollie',
      'redirectingToMollie',
      'mollieCardNotice',
      'mollieSwishNotice',
      'legacyProvidersDisabled',
      'orderReferenceLabel',
    ]
    const requiredOrderKeys = [
      'paymentVerifyingTitle',
      'paymentVerifyingDesc',
      'paymentFailedTitle',
      'paymentFailedDesc',
      'returnToCheckout',
    ]

    it('contains all new Mollie checkout and order confirmation keys in sv, en, and ar locales', () => {
      for (const file of ['sv.json', 'en.json', 'ar.json']) {
        const json = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, `../../i18n/locales/${file}`), 'utf-8')
        )
        for (const key of requiredCheckoutKeys) {
          expect(json.checkout[key], `Missing checkout.${key} in ${file}`).toBeTruthy()
        }
        for (const key of requiredOrderKeys) {
          expect(json.order[key], `Missing order.${key} in ${file}`).toBeTruthy()
        }
      }
    })
  })
})

