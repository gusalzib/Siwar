// tests/unit/section6.admin-products.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Section 6. Admin Products View Overhaul & Filters (pages/admin/products/index.vue)', () => {
  const adminProductsPath = path.resolve(__dirname, '../../pages/admin/products/index.vue')
  const adminProductsGetPath = path.resolve(__dirname, '../../server/api/admin/products/index.get.ts')
  const svLocalePath = path.resolve(__dirname, '../../i18n/locales/sv.json')
  const enLocalePath = path.resolve(__dirname, '../../i18n/locales/en.json')
  const arLocalePath = path.resolve(__dirname, '../../i18n/locales/ar.json')

  const adminProductsContent = fs.readFileSync(adminProductsPath, 'utf-8')
  const adminProductsGetContent = fs.readFileSync(adminProductsGetPath, 'utf-8')
  const svLocale = JSON.parse(fs.readFileSync(svLocalePath, 'utf-8'))
  const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf-8'))
  const arLocale = JSON.parse(fs.readFileSync(arLocalePath, 'utf-8'))

  describe('1. Elimination of Table and Implementation of Responsive Wide Product Cards', () => {
    it('removes the desktop <table> layout and overflow-x-auto table wrappers', () => {
      expect(adminProductsContent).not.toContain('<table')
      expect(adminProductsContent).not.toContain('<tbody>')
      expect(adminProductsContent).not.toContain('<thead>')
    })

    it('renders stacked wide product cards with high-contrast borders and rounded corners', () => {
      expect(adminProductsContent).toContain('article')
      expect(adminProductsContent).toContain('border-2 border-base-300 dark:border-zinc-700')
      expect(adminProductsContent).toContain('rounded-2xl')
    })

    it('displays high-resolution product thumbnails with primary image indicator badge', () => {
      expect(adminProductsContent).toContain('getPrimaryImage')
      expect(adminProductsContent).toContain('object-contain')
      expect(adminProductsContent).toContain('admin.products.cards.primaryImage')
    })

    it('renders primary title, brand badge, and category badge', () => {
      expect(adminProductsContent).toContain('getLocalizedText(product.name)')
      expect(adminProductsContent).toContain('product.brand')
      expect(adminProductsContent).toContain('product.category')
    })

    it('displays barcode / SKU field when present and fallback when absent', () => {
      expect(adminProductsContent).toContain('product.barcode')
      expect(adminProductsContent).toContain('lucide:scan-barcode')
    })

    it('renders stock indicators for physical inventory, safety buffer, and online availability', () => {
      expect(adminProductsContent).toContain('product.stockQuantity')
      expect(adminProductsContent).toContain('product.safetyBuffer')
      expect(adminProductsContent).toContain('product.availableStock')
      expect(adminProductsContent).toContain('admin.products.cards.stockPhysical')
      expect(adminProductsContent).toContain('admin.products.cards.stockBuffer')
      expect(adminProductsContent).toContain('admin.products.cards.stockOnline')
    })

    it('renders multi-currency pricing in SEK, EUR, and USD alongside promotional discount badges', () => {
      expect(adminProductsContent).toContain('toMajorUnits(product.price?.SEK')
      expect(adminProductsContent).toContain('toMajorUnits(product.price?.EUR')
      expect(adminProductsContent).toContain('toMajorUnits(product.price?.USD')
      expect(adminProductsContent).toContain('isDiscountActiveOrScheduled')
      expect(adminProductsContent).toContain('-{{ product.discount }}%')
    })
  })

  describe('2. Top Toolbar Status & Deals Filters (AC-1)', () => {
    it('provides status filter tabs for All, Active Only, and Archived Only', () => {
      expect(adminProductsContent).toContain("selectedStatus = 'all'")
      expect(adminProductsContent).toContain("selectedStatus = 'active'")
      expect(adminProductsContent).toContain("selectedStatus = 'archived'")
      expect(adminProductsContent).toContain("t('admin.products.filters.status.all')")
      expect(adminProductsContent).toContain("t('admin.products.filters.status.active')")
      expect(adminProductsContent).toContain("t('admin.products.filters.status.archived')")
    })

    it('provides a deals toggle button for discounted and promotional products', () => {
      expect(adminProductsContent).toContain('onlyDiscounted = !onlyDiscounted')
      expect(adminProductsContent).toContain("t('admin.products.filters.deals.discounted')")
    })

    it('preserves keyword search, category, stock level, and missing translation filters', () => {
      expect(adminProductsContent).toContain('searchQuery')
      expect(adminProductsContent).toContain('selectedCategory')
      expect(adminProductsContent).toContain('selectedStockStatus')
      expect(adminProductsContent).toContain('onlyMissingTranslations')
      expect(adminProductsContent).toContain('resetFilters')
    })

    it('passes isArchived and hasDiscount query parameters reactively to /api/admin/products', () => {
      expect(adminProductsContent).toContain("q.isArchived = 'true'")
      expect(adminProductsContent).toContain("q.isArchived = 'false'")
      expect(adminProductsContent).toContain("q.hasDiscount = 'true'")
      expect(adminProductsContent).toContain('/api/admin/products')
    })
  })

  describe('3. Action Triggers & Non-blocking Delete Modal (AC-3 Pattern)', () => {
    it('renders edit link, archive toggle, and delete trigger buttons on each card', () => {
      expect(adminProductsContent).toContain('localePath(`/admin/products/${product.id}`)')
      expect(adminProductsContent).toContain('toggleArchive(product.id)')
      expect(adminProductsContent).toContain('openDeleteModal(product)')
    })

    it('replaces window.confirm with a DaisyUI dialog modal matching brand tokens', () => {
      expect(adminProductsContent).toContain('<dialog ref="deleteModalRef"')
      expect(adminProductsContent).toContain('class="modal')
      expect(adminProductsContent).toContain('confirmDeleteProduct')
      expect(adminProductsContent).toContain('closeDeleteModal')
      expect(adminProductsContent).not.toContain('confirm(')
    })
  })

  describe('4. Backend API Support (server/api/admin/products/index.get.ts)', () => {
    it('includes barcode in the transformed product response payload', () => {
      expect(adminProductsGetContent).toContain('barcode: p.barcode || null')
    })

    it('filters by soft-archival active status via isArchived query parameter', () => {
      expect(adminProductsGetContent).toContain("isArchived === 'true'")
      expect(adminProductsGetContent).toContain('filter.isActive = false')
      expect(adminProductsGetContent).toContain("isArchived === 'false'")
      expect(adminProductsGetContent).toContain('filter.isActive = true')
    })

    it('filters by promotional discount via hasDiscount query parameter', () => {
      expect(adminProductsGetContent).toContain("hasDiscount === 'true'")
      expect(adminProductsGetContent).toContain('filter.discount = { $gt: 0 }')
    })
  })

  describe('5. Multilingual Localization Integrity (sv, en, ar)', () => {
    it('defines status and deals filters in Swedish, English, and Arabic', () => {
      expect(svLocale.admin.products.filters.status.all).toBeTruthy()
      expect(svLocale.admin.products.filters.status.active).toBeTruthy()
      expect(svLocale.admin.products.filters.status.archived).toBeTruthy()
      expect(svLocale.admin.products.filters.deals.discounted).toBeTruthy()

      expect(enLocale.admin.products.filters.status.all).toBeTruthy()
      expect(enLocale.admin.products.filters.status.active).toBeTruthy()
      expect(enLocale.admin.products.filters.status.archived).toBeTruthy()
      expect(enLocale.admin.products.filters.deals.discounted).toBeTruthy()

      expect(arLocale.admin.products.filters.status.all).toBeTruthy()
      expect(arLocale.admin.products.filters.status.active).toBeTruthy()
      expect(arLocale.admin.products.filters.status.archived).toBeTruthy()
      expect(arLocale.admin.products.filters.deals.discounted).toBeTruthy()
    })

    it('defines card labels and delete modal strings in all 3 languages', () => {
      expect(svLocale.admin.products.cards.barcode).toBeTruthy()
      expect(svLocale.admin.products.cards.stockPhysical).toBeTruthy()
      expect(svLocale.admin.products.deleteModal.title).toBeTruthy()
      expect(svLocale.admin.products.deleteModal.confirm).toBeTruthy()

      expect(enLocale.admin.products.cards.barcode).toBeTruthy()
      expect(enLocale.admin.products.cards.stockPhysical).toBeTruthy()
      expect(enLocale.admin.products.deleteModal.title).toBeTruthy()
      expect(enLocale.admin.products.deleteModal.confirm).toBeTruthy()

      expect(arLocale.admin.products.cards.barcode).toBeTruthy()
      expect(arLocale.admin.products.cards.stockPhysical).toBeTruthy()
      expect(arLocale.admin.products.deleteModal.title).toBeTruthy()
      expect(arLocale.admin.products.deleteModal.confirm).toBeTruthy()
    })
  })
})
