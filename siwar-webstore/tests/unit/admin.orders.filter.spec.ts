import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Load localization files
const svLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/sv.json'), 'utf-8')
)
const enLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8')
)
const arLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8')
)

describe('Admin Orders Default Filtering — Hide Cancelled Orders (Issue #56 Section 4)', () => {
  const adminOrdersPagePath = path.resolve(__dirname, '../../pages/admin/orders/index.vue')
  const adminOrdersApiPath = path.resolve(__dirname, '../../server/api/admin/orders/index.get.ts')

  const adminOrdersPageContent = fs.readFileSync(adminOrdersPagePath, 'utf-8')
  const adminOrdersApiContent = fs.readFileSync(adminOrdersApiPath, 'utf-8')

  describe('1. Localization Parity (sv, en, ar)', () => {
    it('defines includeCancelled in Swedish, English, and Arabic locales', () => {
      expect(svLocale.admin.orders.filters.includeCancelled).toBe('Visa avbrutna ordrar')
      expect(enLocale.admin.orders.filters.includeCancelled).toBe('Show cancelled orders')
      expect(arLocale.admin.orders.filters.includeCancelled).toBe('عرض الطلبات الملغاة')
    })
  })

  describe('2. Admin Orders UI (pages/admin/orders/index.vue)', () => {
    it('declares includeCancelled ref synced with route query and resets on resetFilters()', () => {
      expect(adminOrdersPageContent).toContain('const includeCancelled = ref(')
      expect(adminOrdersPageContent).toContain('route?.query?.includeCancelled')
      expect(adminOrdersPageContent).toContain('includeCancelled.value = false')
    })

    it('passes includeCancelled to /api/admin/orders query parameters', () => {
      expect(adminOrdersPageContent).toContain("includeCancelled: includeCancelled.value ? 'true' : undefined")
    })

    it('watches includeCancelled to reset currentPage to 1', () => {
      expect(adminOrdersPageContent).toMatch(/watch\(\[.*includeCancelled.*\], \(\) => \{\s*currentPage\.value = 1/)
    })

    it('renders DaisyUI toggle with icon and localized label in filter toolbar', () => {
      expect(adminOrdersPageContent).toContain('v-model="includeCancelled"')
      expect(adminOrdersPageContent).toContain('class="toggle toggle-xs toggle-primary"')
      expect(adminOrdersPageContent).toContain("name=\"lucide:ban\"")
      expect(adminOrdersPageContent).toContain("t('admin.orders.filters.includeCancelled'")
    })

    it('provides client-side fallback filtering to exclude CANCELLED orders when on default view', () => {
      expect(adminOrdersPageContent).toContain("selectedFulfillmentStatus.value === 'all' && !includeCancelled.value")
      expect(adminOrdersPageContent).toContain("o.fulfillmentStatus !== 'CANCELLED'")
    })
  })

  describe('3. Admin Orders API Handler (server/api/admin/orders/index.get.ts)', () => {
    it('extracts includeCancelled from query parameters', () => {
      expect(adminOrdersApiContent).toContain("const includeCancelled = query.includeCancelled === 'true'")
    })

    it('excludes CANCELLED orders by default when fulfillmentStatus is all and includeCancelled is false', () => {
      expect(adminOrdersApiContent).toContain("filter.fulfillmentStatus = { $ne: 'CANCELLED' }")
    })

    it('evaluates filter condition correctly in API code structure', () => {
      // Must check !includeCancelled when fulfillmentStatus === 'all'
      expect(adminOrdersApiContent).toMatch(/else if \(!includeCancelled\) \{\s*\/\/ [^\n]*\s*filter\.fulfillmentStatus = \{ \$ne: 'CANCELLED' \}/)
    })
  })

  describe('4. API Handler Execution Logic Simulation', () => {
    it('filters out CANCELLED orders when includeCancelled is false or omitted', () => {
      // Replicate API filtering logic under test
      function buildFilter(query: Record<string, any>) {
        const fulfillmentStatus = query.fulfillmentStatus ? String(query.fulfillmentStatus) : 'all'
        const staleOnly = query.staleOnly === 'true'
        const includeCancelled = query.includeCancelled === 'true'
        const filter: any = {}

        if (staleOnly) {
          filter.fulfillmentStatus = 'PENDING_PACKING'
        } else if (fulfillmentStatus !== 'all') {
          filter.fulfillmentStatus = fulfillmentStatus
        } else if (!includeCancelled) {
          filter.fulfillmentStatus = { $ne: 'CANCELLED' }
        }
        return filter
      }

      // Default view (no query params)
      const defaultFilter = buildFilter({})
      expect(defaultFilter.fulfillmentStatus).toEqual({ $ne: 'CANCELLED' })

      // Explicitly include cancelled
      const withCancelledFilter = buildFilter({ includeCancelled: 'true' })
      expect(withCancelledFilter.fulfillmentStatus).toBeUndefined()

      // Explicitly filter for CANCELLED
      const explicitCancelledFilter = buildFilter({ fulfillmentStatus: 'CANCELLED' })
      expect(explicitCancelledFilter.fulfillmentStatus).toBe('CANCELLED')

      // Explicitly filter for PENDING_PACKING
      const pendingFilter = buildFilter({ fulfillmentStatus: 'PENDING_PACKING' })
      expect(pendingFilter.fulfillmentStatus).toBe('PENDING_PACKING')
    })
  })
})

