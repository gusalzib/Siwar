// tests/unit/section5.storefront-polish.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Section 5. Storefront Visual Polish (Catalog & Product Cards)', () => {
  const productCardPath = path.resolve(__dirname, '../../components/ProductCard.vue')
  const catalogPath = path.resolve(__dirname, '../../pages/catalog/index.vue')
  const productDetailPath = path.resolve(__dirname, '../../pages/products/[id].vue')

  const productCardContent = fs.readFileSync(productCardPath, 'utf-8')
  const catalogContent = fs.readFileSync(catalogPath, 'utf-8')
  const productDetailContent = fs.readFileSync(productDetailPath, 'utf-8')
  const homePath = path.resolve(__dirname, '../../pages/index.vue')
  const dealsPath = path.resolve(__dirname, '../../components/PromotionalDealsSection.vue')
  const homeContent = fs.readFileSync(homePath, 'utf-8')
  const dealsContent = fs.readFileSync(dealsPath, 'utf-8')
  const layoutPath = path.resolve(__dirname, '../../layouts/default.vue')
  const footerPath = path.resolve(__dirname, '../../components/StoreFooter.vue')
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8')
  const footerContent = fs.readFileSync(footerPath, 'utf-8')

  describe('1. Product Card Enhancements (components/ProductCard.vue)', () => {
    it('applies high-contrast borders, deep drop shadows, and smooth hover scaling', () => {
      expect(productCardContent).toContain('border-2 border-base-300 dark:border-zinc-700')
      expect(productCardContent).toContain('shadow-sm hover:shadow-xl')
      expect(productCardContent).toContain('hover:-translate-y-1 transition-all duration-300')
    })

    it('ensures uniform image aspect ratios with backdrop neutral fills and object-contain', () => {
      expect(productCardContent).toContain('h-52 w-full bg-neutral-50 dark:bg-zinc-900/60')
      expect(productCardContent).toContain('object-contain')
      expect(productCardContent).toContain('drop-shadow-sm')
    })

    it('features artistic rounded price pills with high-contrast currency display', () => {
      expect(productCardContent).toContain('rounded-xl bg-emerald-50 dark:bg-emerald-950/40')
      expect(productCardContent).toContain('border-emerald-200/80 dark:border-emerald-800/60')
      expect(productCardContent).toContain('activeCurrency')
      expect(productCardContent).toContain('text-emerald-800')
    })

    it('includes distinctive discount callouts and impending deadline urgency badges', () => {
      expect(productCardContent).toContain('-{{ product.discount }}%')
      expect(productCardContent).toContain('isExpiringSoon')
      expect(productCardContent).toContain('deals.endsSoon')
    })

    it('enforces high-contrast action buttons with consistent sizing across themes', () => {
      expect(productCardContent).toContain('!bg-emerald-600')
      expect(productCardContent).toContain('!text-white')
      expect(productCardContent).toContain('btn-sm h-9 min-h-9')
    })
  })

  describe('2. Catalog Page Overhaul (pages/catalog/index.vue)', () => {
    it('standardizes main content wrappers with min-h-screen and bottom padding', () => {
      expect(catalogContent).toContain('min-h-screen')
      expect(catalogContent).toContain('pb-16')
    })

    it('features high-contrast 2px borders and rounded-2xl cards across filters and skeleton loaders', () => {
      expect(catalogContent).toContain('border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl')
      expect(catalogContent).toContain('h-52 bg-base-200 dark:bg-zinc-800')
    })

    it('provides padded category filter buttons with cursor-pointer and active checkmark', () => {
      expect(catalogContent).toContain('px-4 py-2.5 rounded-xl')
      expect(catalogContent).toContain('cursor-pointer')
      expect(catalogContent).toContain('!bg-emerald-600 !text-white !border-emerald-600')
      expect(catalogContent).toContain('lucide:check')
    })

    it('features 4px thick section dividers across filter groups', () => {
      expect(catalogContent).toContain('border-t-[4px]')
    })

    it('embeds ProductCard component in hydrated grid', () => {
      expect(catalogContent).toContain('<ProductCard')
      expect(catalogContent).toContain(':product="product"')
    })

    it('adheres to brand styling without glassmorphism blur filters', () => {
      expect(catalogContent).not.toContain('backdrop-blur-md')
      expect(catalogContent).not.toContain('backdrop-blur-lg')
    })
  })

  describe('3. Product Detail Page Visual Consistency & Accessibility (pages/products/[id].vue)', () => {
    it('uses matching min-h-screen wrapper and neutral backdrop for primary image stage', () => {
      expect(productDetailContent).toContain('min-h-screen')
      expect(productDetailContent).toContain('pb-16')
      expect(productDetailContent).toContain('bg-neutral-50 dark:bg-zinc-900/60')
      expect(productDetailContent).toContain('border border-base-200 dark:border-zinc-800')
    })

    it('wraps gallery and product purchase info in high-contrast card containers with 2px borders', () => {
      expect(productDetailContent).toContain('border-2 border-base-300 dark:border-zinc-700 shadow-md')
    })

    it('employs rounded price pill styling with high-contrast text', () => {
      expect(productDetailContent).toContain('rounded-2xl bg-emerald-50')
      expect(productDetailContent).toContain('border-emerald-200/80 dark:border-emerald-800/60')
      expect(productDetailContent).toContain('!bg-emerald-600')
      expect(productDetailContent).toContain('!text-white')
    })
  })

  describe('4. Homepage Section Headers & Search Bar Accessibility (pages/index.vue & PromotionalDealsSection.vue)', () => {
    it('encloses promotional deals header in a solid card with rounded corners and clear borders', () => {
      expect(dealsContent).toContain('card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl')
      expect(dealsContent).toContain('border-2 border-base-300 dark:border-zinc-700')
    })

    it('encloses categories section header in a solid card with rounded corners and clear borders', () => {
      expect(homeContent).toContain('card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl')
    })

    it('ensures search submit button uses high-contrast text and is not invisible on light theme', () => {
      expect(homeContent).toContain('text-slate-950')
      expect(homeContent).not.toContain('btn btn-primary text-white')
    })

    it('ensures allergen filters use high-contrast dark text in light mode when active and do not turn white', () => {
      expect(homeContent).toContain('bg-rose-100 border-rose-500 text-rose-900')
      expect(homeContent).not.toContain('badge-error text-white')
    })
  })

  describe('5. Storefront Footer Stacking & Solid Contrast', () => {
    it('elevates footer with relative z-10 and solid background so background watermark never overlays on top of it', () => {
      expect(footerContent).toContain('relative z-10')
      expect(footerContent).toContain('bg-slate-900')
      expect(layoutContent).toContain('<StoreFooter class="relative z-10" />')
    })
  })
})
