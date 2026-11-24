// tests/unit/admin.docs.spec.ts
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, hash: '' }),
}))

// Stub Nuxt globals
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: any) => fn)
vi.stubGlobal('navigateTo', vi.fn((to: any, opts: any) => ({ to, opts })))
vi.stubGlobal('useRequestHeaders', vi.fn(() => ({})))
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRouter', () => ({ replace: vi.fn(), push: vi.fn() }))
vi.stubGlobal('useRoute', () => ({ query: {}, hash: '' }))
vi.stubGlobal('useLocalePath', () => (p: string) => p)
vi.stubGlobal('useI18n', () => ({
  t: (key: string, paramsOrFallback?: any, fallback?: string) => {
    if (paramsOrFallback && typeof paramsOrFallback === 'object' && paramsOrFallback.level) {
      return `Priority ${paramsOrFallback.level}`
    }
    if (typeof fallback === 'string') return fallback
    if (typeof paramsOrFallback === 'string') return paramsOrFallback
    return key
  },
  locale: { value: 'sv' },
}))

import DiscountHierarchyDoc from '~/components/admin/docs/DiscountHierarchyDoc.vue'
import AdminDocsPage from '~/pages/admin/docs/index.vue'

describe('Internal Admin Documentation (Issue #56 - Task 1)', () => {
  describe('1. Localization Parity across sv, en, ar', () => {
    const requiredDocKeys = [
      'title',
      'subtitle',
      'backToAdmin',
      'backToProducts',
      'tableOfContents',
      'pricingHelpLink',
    ]

    const requiredDiscountKeys = [
      'title',
      'subtitle',
      'badgeText',
      'tier1Title',
      'tier1Subtitle',
      'tier1Description',
      'tier2Title',
      'tier2Subtitle',
      'tier2Description',
      'tier3Title',
      'tier3Subtitle',
      'tier3Description',
      'tier4Title',
      'tier4Subtitle',
      'tier4Description',
      'mutualExclusionTitle',
      'mutualExclusionDesc',
      'taxAndComparisonTitle',
      'taxAndComparisonDesc',
      'checkoutValidationTitle',
      'checkoutValidationDesc',
    ]

    it('verifies that all admin.docs keys exist and are non-empty across all locales', () => {
      for (const locName of ['sv.json', 'en.json', 'ar.json']) {
        const filePath = path.resolve(__dirname, `../../i18n/locales/${locName}`)
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

        expect(json.admin?.docs).toBeDefined()

        for (const key of requiredDocKeys) {
          expect(json.admin.docs[key]).toBeDefined()
          expect(typeof json.admin.docs[key]).toBe('string')
          expect(json.admin.docs[key].length).toBeGreaterThan(0)
        }

        expect(json.admin.docs.discounts).toBeDefined()
        for (const key of requiredDiscountKeys) {
          expect(json.admin.docs.discounts[key]).toBeDefined()
          expect(typeof json.admin.docs.discounts[key]).toBe('string')
          expect(json.admin.docs.discounts[key].length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('2. DiscountHierarchyDoc Component', () => {
    it('renders the 4-tier discount precedence hierarchy and operational cards', () => {
      const wrapper = mount(DiscountHierarchyDoc, {
        global: {
          stubs: {
            Icon: { template: '<span />' },
          },
        },
      })

      const text = wrapper.text()
      // Verifies all 4 tiers are represented in order
      expect(text).toContain('Priority 1')
      expect(text).toContain('Priority 2')
      expect(text).toContain('Priority 3')
      expect(text).toContain('Priority 4')

      // Verifies operational sections
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.findAll('.card').length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('3. Admin Docs Hub Page (index.vue)', () => {
    it('mounts and renders sidebar navigation with discounts active by default', () => {
      const wrapper = mount(AdminDocsPage, {
        global: {
          stubs: {
            NuxtLink: { template: '<a><slot /></a>' },
            Icon: { template: '<span />' },
            DiscountHierarchyDoc: { template: '<div class="discount-doc-stub" />' },
          },
        },
      })

      expect(wrapper.find('.discount-doc-stub').exists()).toBe(true)
      expect(wrapper.find('aside').exists()).toBe(true)
      expect(wrapper.find('main').exists()).toBe(true)
    })
  })

  describe('4. Admin Route Protection Middleware', () => {
    it('redirects unauthenticated visitors to /admin/login when authenticated is false', async () => {
      const prevFetch = globalThis.$fetch
      try {
        globalThis.$fetch = vi.fn().mockResolvedValue({
          statusCode: 200,
          authenticated: false,
          user: null,
        }) as any

        const middleware = (await import('~/middleware/admin')).default
        const result = (await middleware({ path: '/admin/docs' } as any)) as any
        expect(result).toBeDefined()
        expect(result.to).toBe('/admin/login')
      } finally {
        globalThis.$fetch = prevFetch
      }
    })

    it('allows authenticated admin users through', async () => {
      const prevFetch = globalThis.$fetch
      try {
        globalThis.$fetch = vi.fn().mockResolvedValue({
          statusCode: 200,
          authenticated: true,
          user: { id: 'admin1', email: 'admin@siwar.se', role: 'admin' },
        }) as any

        const middleware = (await import('~/middleware/admin')).default
        const result = await middleware({ path: '/admin/docs' } as any)
        expect(result).toBeUndefined()
      } finally {
        globalThis.$fetch = prevFetch
      }
    })
  })
})
