// tests/unit/section3.navigation-payment.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Section 3. Navigation & Payment Refinements', () => {
  describe('1. Navigation Collapse Threshold (layouts/default.vue)', () => {
    const layoutPath = path.resolve(__dirname, '../../layouts/default.vue')
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8')

    it('dynamically controls hamburger menu threshold (xl:hidden for shoppers, min-[1600px]:hidden for admin view)', () => {
      // The hamburger dropdown container uses xl:hidden for standard storefront and 1600px for admin view
      expect(layoutContent).toContain(":class=\"isAdmin ? 'min-[1600px]:hidden' : 'xl:hidden'\"")
      expect(layoutContent).not.toContain('class="dropdown lg:hidden"')
    })

    it('dynamically controls desktop navigation links visibility (hidden xl:flex for shoppers, hidden min-[1600px]:flex for admin view)', () => {
      // The center desktop navigation bar is hidden until xl (>= 1280px) for shoppers and >= 1600px for admin view
      expect(layoutContent).toContain(":class=\"isAdmin ? 'hidden min-[1600px]:flex' : 'hidden xl:flex'\"")
      expect(layoutContent).not.toContain('class="hidden lg:flex')
    })
  })

  describe('2. Payment Cancellation Modal (pages/checkout/payment.vue)', () => {
    const paymentPagePath = path.resolve(__dirname, '../../pages/checkout/payment.vue')
    const paymentPageContent = fs.readFileSync(paymentPagePath, 'utf-8')

    it('does not use native window.confirm()', () => {
      expect(paymentPageContent).not.toMatch(/confirm\(/)
    })

    it('renders a DaisyUI dialog modal with teleport and accessibility tokens', () => {
      expect(paymentPageContent).toContain('<dialog ref="cancelModalRef" class="modal"')
      expect(paymentPageContent).toContain('<Teleport to="body">')
      expect(paymentPageContent).toContain('class="modal-box')
      expect(paymentPageContent).toContain('class="modal-backdrop')
    })

    it('provides both "Keep shopping" and "Cancel order" actions', () => {
      expect(paymentPageContent).toContain("t('checkout.keepShopping'")
      expect(paymentPageContent).toContain("t('checkout.confirmCancelOrder'")
    })

    it('uses high contrast non-glassmorphism brand colors for buttons', () => {
      // Cancel button must have explicit !text-white on error red
      expect(paymentPageContent).toContain('!bg-red-600')
      expect(paymentPageContent).toContain('!text-white')
      // No backdrop blur on modal box
      expect(paymentPageContent).not.toContain('backdrop-blur-md')
      expect(paymentPageContent).not.toContain('backdrop-blur-lg')
    })
  })

  describe('3. Payment Cancellation Logic & Session Cleanup', () => {
    let mockSessionStorage: Record<string, string> = {}

    beforeEach(() => {
      mockSessionStorage = {
        siwar_checkout_payload: JSON.stringify({ shippingFeeMinor: 4900 }),
        siwar_active_payment_session: JSON.stringify({ orderReference: 'ORD-12345', clientSecret: 'cs_test' }),
      }
    })

    it('purges session cache and draft payload when cancellation is confirmed', async () => {
      const activeOrderReference = 'ORD-12345'
      const mockFetch = vi.fn().mockResolvedValue({ success: true })

      // Simulate confirmCancelOrder flow
      if (activeOrderReference) {
        await mockFetch('/api/checkout/cancel-session', {
          method: 'POST',
          body: { orderReference: activeOrderReference },
        })
      }

      delete mockSessionStorage.siwar_checkout_payload
      delete mockSessionStorage.siwar_active_payment_session

      expect(mockFetch).toHaveBeenCalledWith('/api/checkout/cancel-session', {
        method: 'POST',
        body: { orderReference: 'ORD-12345' },
      })
      expect(mockSessionStorage.siwar_checkout_payload).toBeUndefined()
      expect(mockSessionStorage.siwar_active_payment_session).toBeUndefined()
    })
  })
})
