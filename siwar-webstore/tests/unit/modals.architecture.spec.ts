// tests/unit/modals.architecture.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Reusable Modal Architecture (BaseModal & ConfirmModal)', () => {
  const baseModalPath = path.resolve(__dirname, '../../components/BaseModal.vue')
  const confirmModalPath = path.resolve(__dirname, '../../components/ConfirmModal.vue')
  const orderCancelModalPath = path.resolve(__dirname, '../../components/OrderCancelModal.vue')
  const favoriterPagePath = path.resolve(__dirname, '../../pages/favoriter.vue')
  const paymentPagePath = path.resolve(__dirname, '../../pages/checkout/payment.vue')
  const adminProductsPagePath = path.resolve(__dirname, '../../pages/admin/products/index.vue')

  const baseModalContent = fs.readFileSync(baseModalPath, 'utf-8')
  const confirmModalContent = fs.readFileSync(confirmModalPath, 'utf-8')
  const orderCancelModalContent = fs.readFileSync(orderCancelModalPath, 'utf-8')
  const favoriterPageContent = fs.readFileSync(favoriterPagePath, 'utf-8')
  const paymentPageContent = fs.readFileSync(paymentPagePath, 'utf-8')
  const adminProductsContent = fs.readFileSync(adminProductsPagePath, 'utf-8')

  describe('1. BaseModal Component Foundation', () => {
    it('implements native HTML <dialog> teleported to body', () => {
      expect(baseModalContent).toContain('<Teleport to="body">')
      expect(baseModalContent).toContain('<dialog')
      expect(baseModalContent).toContain('class="modal"')
      expect(baseModalContent).toContain('ref="dialogRef"')
    })

    it('manages dialog lifecycle with showModal() and close()', () => {
      expect(baseModalContent).toContain('dialogRef.value.showModal()')
      expect(baseModalContent).toContain('dialogRef.value.close()')
    })

    it('supports slot projection for header, default body, and footer', () => {
      expect(baseModalContent).toContain('<slot name="header"')
      expect(baseModalContent).toContain('<slot :close="handleClose"')
      expect(baseModalContent).toContain('<slot name="footer"')
    })

    it('renders an accessible backdrop with click-to-close behavior', () => {
      expect(baseModalContent).toContain('class="modal-backdrop')
      expect(baseModalContent).toContain('handleBackdropClick')
    })

    it('respects non-glassmorphism brand tokens and dark mode styling', () => {
      expect(baseModalContent).toContain('bg-base-100')
      expect(baseModalContent).toContain('dark:bg-base-200')
      expect(baseModalContent).toContain('border-2')
      expect(baseModalContent).not.toContain('backdrop-blur-md')
      expect(baseModalContent).not.toContain('backdrop-blur-lg')
    })
  })

  describe('2. ConfirmModal Component (Props-Driven)', () => {
    it('wraps BaseModal and accepts title, message, and icon as props', () => {
      expect(confirmModalContent).toContain('<BaseModal')
      expect(confirmModalContent).toContain('title: string')
      expect(confirmModalContent).toContain('message?: string')
      expect(confirmModalContent).toContain('icon?: string')
    })

    it('supports color variants with high contrast buttons (danger, warning, primary, info)', () => {
      expect(confirmModalContent).toContain('!bg-red-600')
      expect(confirmModalContent).toContain('!text-white')
      expect(confirmModalContent).toContain('iconVariantClasses')
      expect(confirmModalContent).toContain('confirmButtonClasses')
    })

    it('emits confirm and close events properly', () => {
      expect(confirmModalContent).toContain("emit('confirm')")
      expect(confirmModalContent).toContain("emit('close')")
    })

    it('supports loading indicator when isSubmitting is true', () => {
      expect(confirmModalContent).toContain('isSubmitting')
      expect(confirmModalContent).toContain('loading loading-spinner')
    })
  })

  describe('3. Refactored Consumers Integration', () => {
    it('pages/favoriter.vue uses ConfirmModal for clearing favorites', () => {
      expect(favoriterPageContent).toContain('<ConfirmModal')
      expect(favoriterPageContent).toContain('isClearModalOpen')
      expect(favoriterPageContent).toContain('confirmClearFavorites')
      expect(favoriterPageContent).toContain('closeClearModal')
      expect(favoriterPageContent).not.toContain('<dialog ref="clearModalRef"')
    })

    it('components/OrderCancelModal.vue uses ConfirmModal with slot for reason input', () => {
      expect(orderCancelModalContent).toContain('<ConfirmModal')
      expect(orderCancelModalContent).toContain('manualCancelReason')
      expect(orderCancelModalContent).toContain('handleConfirm')
      expect(orderCancelModalContent).not.toContain('showModal()')
    })

    it('pages/checkout/payment.vue uses ConfirmModal for order cancellation', () => {
      expect(paymentPageContent).toContain('<ConfirmModal')
      expect(paymentPageContent).toContain('isCancelModalOpen')
      expect(paymentPageContent).toContain('confirmCancelOrder')
      expect(paymentPageContent).toContain('closeCancelModal')
      expect(paymentPageContent).not.toContain('<dialog ref="cancelModalRef"')
    })

    it('pages/admin/products/index.vue uses ConfirmModal for product deletion', () => {
      expect(adminProductsContent).toContain('<ConfirmModal')
      expect(adminProductsContent).toContain('isDeleteModalOpen')
      expect(adminProductsContent).toContain('confirmDeleteProduct')
      expect(adminProductsContent).toContain('closeDeleteModal')
      expect(adminProductsContent).not.toContain('<dialog ref="deleteModalRef"')
    })

    it('components/admin/settings/CategoryManager.vue uses ConfirmModal for deletion and eliminates window.confirm', () => {
      const categoryManagerPath = path.resolve(__dirname, '../../components/admin/settings/CategoryManager.vue')
      const categoryManagerContent = fs.readFileSync(categoryManagerPath, 'utf-8')
      expect(categoryManagerContent).toContain('<ConfirmModal')
      expect(categoryManagerContent).toContain('isDeleteModalOpen')
      expect(categoryManagerContent).toContain('confirmDeleteCategory')
      expect(categoryManagerContent).toContain('openDeleteModal(category)')
      expect(categoryManagerContent).not.toMatch(/confirm\(/)
    })

    it('components/admin/settings/AllergenManager.vue uses ConfirmModal for deletion and eliminates window.confirm', () => {
      const allergenManagerPath = path.resolve(__dirname, '../../components/admin/settings/AllergenManager.vue')
      const allergenManagerContent = fs.readFileSync(allergenManagerPath, 'utf-8')
      expect(allergenManagerContent).toContain('<ConfirmModal')
      expect(allergenManagerContent).toContain('isDeleteModalOpen')
      expect(allergenManagerContent).toContain('confirmDeleteAllergen')
      expect(allergenManagerContent).toContain('openDeleteModal(allergen)')
      expect(allergenManagerContent).not.toMatch(/confirm\(/)
    })

    it('components/admin/settings/BannerManager.vue uses ConfirmModal for deletion and eliminates window.confirm', () => {
      const bannerManagerPath = path.resolve(__dirname, '../../components/admin/settings/BannerManager.vue')
      const bannerManagerContent = fs.readFileSync(bannerManagerPath, 'utf-8')
      expect(bannerManagerContent).toContain('<ConfirmModal')
      expect(bannerManagerContent).toContain('isDeleteModalOpen')
      expect(bannerManagerContent).toContain('confirmDeleteBanner')
      expect(bannerManagerContent).toContain('openDeleteModal(banner)')
      expect(bannerManagerContent).not.toMatch(/confirm\(/)
    })

    it('verifies settings modal strings and common actions exist across sv, en, ar', () => {
      const sv = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/sv.json'), 'utf-8'))
      const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8'))
      const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8'))

      for (const loc of [sv, en, ar]) {
        expect(loc.common?.save).toBeTruthy()
        expect(loc.common?.cancel).toBeTruthy()
        expect(loc.admin?.banners?.deleteModalTitle).toBeTruthy()
        expect(loc.admin?.banners?.cancel).toBeTruthy()
        expect(loc.admin?.categories?.deleteModalTitle).toBeTruthy()
        expect(loc.admin?.allergens?.deleteModalTitle).toBeTruthy()
      }
    })
  })
})
