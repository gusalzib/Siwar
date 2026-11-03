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

    it('renders a reusable confirmation modal with accessibility and brand tokens', () => {
      expect(paymentPageContent).toContain('<ConfirmModal')
      expect(paymentPageContent).toContain('isCancelModalOpen')
      expect(paymentPageContent).toContain('confirmCancelOrder')
      expect(paymentPageContent).toContain('closeCancelModal')

      const baseModalPath = path.resolve(__dirname, '../../components/BaseModal.vue')
      const baseModalContent = fs.readFileSync(baseModalPath, 'utf-8')
      expect(baseModalContent).toContain('<Teleport to="body">')
      expect(baseModalContent).toContain('<dialog')
      expect(baseModalContent).toContain('class="modal"')
      expect(baseModalContent).toContain('modal-backdrop')
    })

    it('provides both "Keep shopping" and "Cancel order" actions', () => {
      expect(paymentPageContent).toContain("t('checkout.keepShopping'")
      expect(paymentPageContent).toContain("t('checkout.confirmCancelOrder'")
    })

    it('uses high contrast non-glassmorphism brand colors for buttons', () => {
      const confirmModalPath = path.resolve(__dirname, '../../components/ConfirmModal.vue')
      const confirmModalContent = fs.readFileSync(confirmModalPath, 'utf-8')
      // Cancel button must have explicit !text-white on error red
      expect(confirmModalContent).toContain('!bg-red-600')
      expect(confirmModalContent).toContain('!text-white')
      // No backdrop blur on modal box
      expect(confirmModalContent).not.toContain('backdrop-blur-md')
      expect(confirmModalContent).not.toContain('backdrop-blur-lg')
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

  describe('4. Abandoned Session Fulfillment State Drift & Security Guards', () => {
    const cancelSessionPath = path.resolve(__dirname, '../../server/api/checkout/cancel-session.ts')
    const cancelSessionContent = fs.readFileSync(cancelSessionPath, 'utf-8')
    const packPostPath = path.resolve(__dirname, '../../server/api/admin/orders/[id]/pack.post.ts')
    const packPostContent = fs.readFileSync(packPostPath, 'utf-8')
    const composablePath = path.resolve(__dirname, '../../composables/useOrderPacking.ts')
    const composableContent = fs.readFileSync(composablePath, 'utf-8')
    const adminOrdersPath = path.resolve(__dirname, '../../pages/admin/orders/index.vue')
    const adminOrdersContent = fs.readFileSync(adminOrdersPath, 'utf-8')

    it('sets both paymentStatus and fulfillmentStatus to CANCELLED and records cancelledAt in cancel-session', () => {
      expect(cancelSessionContent).toContain("order.fulfillmentStatus = 'CANCELLED'")
      expect(cancelSessionContent).toContain('order.cancelledAt = new Date()')
    })

    it('atomically restores decremented inventory in cancel-session when inventoryDecremented is true', () => {
      expect(cancelSessionContent).toContain('if (order.inventoryDecremented)')
      expect(cancelSessionContent).toContain('Product.updateOne')
      expect(cancelSessionContent).toContain('$inc: { stockQuantity: qtyToRestore }')
      expect(cancelSessionContent).toContain('order.inventoryDecremented = false')
    })

    it('strictly rejects packing requests for UNPACKABLE_PAYMENT_STATUSES (ABANDONED, CANCELLED, FAILED, PENDING) in pack.post.ts', () => {
      expect(packPostContent).toContain("const UNPACKABLE_PAYMENT_STATUSES = ['ABANDONED', 'CANCELLED', 'FAILED', 'PENDING']")
      expect(packPostContent).toContain('UNPACKABLE_PAYMENT_STATUSES.includes(order.paymentStatus)')
      expect(packPostContent).toContain("order.fulfillmentStatus === 'CANCELLED'")
    })

    it('prevents financial capture and DISPATCHED transition if paymentStatus is not AUTHORIZED / PAID', () => {
      expect(packPostContent).toContain("order.paymentStatus !== 'AUTHORIZED'")
      expect(packPostContent).toContain("order.paymentStatus !== 'PAID'")
    })

    it('guards canDispatch and exports isOrderUnpackable in useOrderPacking composable', () => {
      expect(composableContent).toContain("!['AUTHORIZED', 'PAID'].includes(order.value?.paymentStatus)")
      expect(composableContent).toContain('isOrderUnpackable')
      expect(composableContent).toContain("const UNPACKABLE_PAYMENT_STATUSES = ['ABANDONED', 'CANCELLED', 'FAILED', 'PENDING']")
    })

    it('gates "Packa" CTA button behind canPackOrder in pages/admin/orders/index.vue', () => {
      expect(adminOrdersContent).toContain('function canPackOrder(order: any): boolean')
      expect(adminOrdersContent).toContain("order.fulfillmentStatus === 'PENDING_PACKING'")
      expect(adminOrdersContent).toContain("order.paymentStatus === 'AUTHORIZED' || order.paymentStatus === 'PAID'")
      expect(adminOrdersContent).toContain("canPackOrder(order) ? t('admin.orders.actions.pack') : t('admin.orders.actions.view')")
    })
  })
})

