// tests/unit/section1.backend.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SOCIAL_PLATFORM_OPTIONS,
  VALID_SOCIAL_PLATFORMS,
  type ISocialLink,
} from '~/utils/social'

// ---------------------------------------------------------------------------
// 1. Hoisted Nitro & H3 Globals + Mocks
// ---------------------------------------------------------------------------
const { mockState, mockProductModel, mockStoreSettingsModel, mockAllergenModel, mockCategoryModel } = vi.hoisted(() => {
  const mockState = {
    body: {} as any,
    query: {} as Record<string, any>,
    params: {} as Record<string, string>,
    settingsDoc: {} as any,
    capturedFilter: null as any,
  }

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('getQuery', vi.fn(() => mockState.query))
  vi.stubGlobal('getRouterParam', vi.fn((_event: any, param: string) => mockState.params[param]))

  // Mock Product Model
  const mockProductModel: any = {
    countDocuments: vi.fn(async (filter: any) => {
      mockState.capturedFilter = filter
      return 1
    }),
    find: vi.fn((filter: any) => {
      mockState.capturedFilter = filter
      return {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            _id: '65fa2c9e83b1d2001e4a9f10',
            name: { ar: 'شاي', sv: 'Te', en: 'Tea' },
            description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
            brand: 'Ahmad Tea',
            category: { _id: 'cat1', name: { ar: 'شاي', sv: 'Te', en: 'Tea' } },
            allergens: [],
            price: { SEK: 4900, EUR: 450, USD: 500 },
            discount: 10,
            stockQuantity: 20,
            safetyBuffer: 2,
            isActive: filter?.isActive !== undefined ? filter.isActive : true,
          },
        ]),
      }
    }),
  }

  // Mock Allergen Model
  const mockAllergenModel: any = {
    find: vi.fn((query: any) => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockImplementation(async () => {
        const milkId = '65fa2c9e83b1d2001e4a9f20'
        const glutenId = '65fa2c9e83b1d2001e4a9f21'
        const results: any[] = []
        const orConditions = query?.$or || []
        const codeIn = orConditions.find((c: any) => c.code)?.code?.$in || []
        if (codeIn.includes('milk')) results.push({ _id: milkId, code: 'milk' })
        if (codeIn.includes('gluten')) results.push({ _id: glutenId, code: 'gluten' })
        return results
      }),
    })),
  }

  // Mock Category Model
  const mockCategoryModel: any = {
    findOne: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: '65fa2c9e83b1d2001e4a9f30' }),
    })),
  }

  // Mock StoreSettings Model constructor & findOne
  const createSettingsInstance = () => ({
    ...mockState.settingsDoc,
    save: vi.fn(async function (this: any) {
      if (this.general) mockState.settingsDoc.general = this.general
      if (this.socialLinks) mockState.settingsDoc.socialLinks = this.socialLinks
      return this
    }),
  })

  const mockStoreSettingsModel: any = vi.fn(function () {
    return createSettingsInstance()
  })

  mockStoreSettingsModel.findOne = vi.fn(async () => createSettingsInstance())

  return { mockState, mockProductModel, mockStoreSettingsModel, mockAllergenModel, mockCategoryModel }
})

vi.mock('~/server/models/Product', () => ({
  Product: mockProductModel,
}))

vi.mock('~/server/models/Allergens', () => ({
  Allergen: mockAllergenModel,
}))

vi.mock('~/server/models/Category', () => ({
  Category: mockCategoryModel,
}))

vi.mock('~/server/models/StoreSettings', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    StoreSettings: mockStoreSettingsModel,
    getStoreGeneralSettings: vi.fn(async () => mockState.settingsDoc.general),
    getStorePickupSettings: vi.fn(async () => mockState.settingsDoc.pickup),
    clearGeneralSettingsCache: vi.fn(),
    clearPickupSettingsCache: vi.fn(),
  }
})

// Import route handlers
import getSettingsHandler from '~/server/api/settings.get'
import getAdminProductsHandler from '~/server/api/admin/products/index.get'
import getCatalogHandler from '~/server/api/catalog/index.get'
import putAdminGeneralSettingsHandler from '~/server/api/admin/settings/general.put'
import putAdminSettingsHandler from '~/server/api/admin/settings/index.put'

describe('Section 1. Backend & Configuration', () => {
  const dummyEvent = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.body = {}
    mockState.query = {}
    mockState.params = {}
    mockState.capturedFilter = null
    mockState.settingsDoc = {
      general: {
        storeName: { ar: 'سوار', sv: 'Siwar', en: 'Siwar' },
        tagline: { ar: 'سوار', sv: 'Siwar', en: 'Siwar' },
        company: { name: 'Siwar Butik AB', orgNumber: '559123-4567', vatNumber: 'SE559123456701' },
        contact: { email: 'order@siwar.se', phone: '+46 35 123 456' },
        address: { street: 'Storgatan 12', postalCode: '302 43', city: 'Halmstad', country: 'Sverige' },
        schedule: [],
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com/siwar', isActive: true, sortOrder: 1 },
          { platform: 'facebook', url: 'https://facebook.com/siwar', isActive: false, sortOrder: 2 },
        ],
      },
      pickup: {
        enabled: true,
        address: { street: 'Storgatan 12', postalCode: '302 43', city: 'Halmstad', country: 'Sverige' },
        schedule: [],
        instructions: { ar: '', sv: '', en: '' },
      },
      socialLinks: [
        { platform: 'instagram', url: 'https://instagram.com/siwar', isActive: true, sortOrder: 1 },
        { platform: 'facebook', url: 'https://facebook.com/siwar', isActive: false, sortOrder: 2 },
      ],
    }
  })

  describe('1. In-Memory Social Media Platform Dropdown', () => {
    it('defines all 6 required platforms with proper icons', () => {
      const platforms = SOCIAL_PLATFORM_OPTIONS.map((opt) => opt.platform)
      expect(platforms).toEqual(['instagram', 'facebook', 'tiktok', 'whatsapp', 'youtube', 'x'])
      expect(VALID_SOCIAL_PLATFORMS).toHaveLength(6)

      const instagram = SOCIAL_PLATFORM_OPTIONS.find((p) => p.platform === 'instagram')
      expect(instagram?.icon).toBe('skill-icons:instagram')

      const facebook = SOCIAL_PLATFORM_OPTIONS.find((p) => p.platform === 'facebook')
      expect(facebook?.icon).toBe('logos:facebook')

      const tiktok = SOCIAL_PLATFORM_OPTIONS.find((p) => p.platform === 'tiktok')
      expect(tiktok?.icon).toBe('logos:tiktok-icon')

      const whatsapp = SOCIAL_PLATFORM_OPTIONS.find((p) => p.platform === 'whatsapp')
      expect(whatsapp?.icon).toBe('logos:whatsapp-icon')
    })
  })

  describe('2. Public Settings Endpoint (GET /api/settings)', () => {
    it('exposes socialLinks array sorted by sortOrder', async () => {
      const response = await getSettingsHandler(dummyEvent)
      expect(response).toHaveProperty('socialLinks')
      expect(Array.isArray(response.socialLinks)).toBe(true)
      expect(response.socialLinks).toHaveLength(2)
      expect(response.socialLinks[0]?.platform).toBe('instagram')
      expect(response.socialLinks[0]?.url).toBe('https://instagram.com/siwar')
      expect(response.socialLinks[0]?.isActive).toBe(true)
      expect(response.socialLinks[1]?.platform).toBe('facebook')
      expect(response.socialLinks[1]?.isActive).toBe(false)
    })
  })

  describe('3. Admin Settings Endpoints (PUT /api/admin/settings and general.put)', () => {
    it('persists socialLinks and updates settings via PUT /api/admin/settings', async () => {
      const payload: { socialLinks: ISocialLink[] } = {
        socialLinks: [
          { platform: 'tiktok', url: 'https://tiktok.com/@siwar', isActive: true, sortOrder: 0 },
          { platform: 'youtube', url: 'https://youtube.com/@siwar', isActive: true, sortOrder: 1 },
        ],
      }
      mockState.body = payload

      const res = await putAdminSettingsHandler(dummyEvent)
      expect(res.statusCode).toBe(200)
      expect(res.socialLinks).toHaveLength(2)
      expect(res.socialLinks[0].platform).toBe('tiktok')
      expect(res.socialLinks[1].platform).toBe('youtube')
    })

    it('persists socialLinks via PUT /api/admin/settings/general', async () => {
      const payload = {
        storeName: { ar: 'سوار', sv: 'Siwar', en: 'Siwar' },
        socialLinks: [
          { platform: 'whatsapp', url: 'https://wa.me/4635123456', isActive: true, sortOrder: 0 },
        ],
      }
      mockState.body = payload

      const res = await putAdminGeneralSettingsHandler(dummyEvent)
      expect(res.statusCode).toBe(200)
      expect(res.general.socialLinks).toHaveLength(1)
      expect(res.general.socialLinks[0].platform).toBe('whatsapp')
    })
  })

  describe('4. Admin Products Filters (GET /api/admin/products)', () => {
    it('filters on isActive: false when isArchived is true', async () => {
      mockState.query = { isArchived: 'true' }
      await getAdminProductsHandler(dummyEvent)
      expect(mockState.capturedFilter.isActive).toBe(false)
    })

    it('filters on isActive: true when isArchived is false', async () => {
      mockState.query = { isArchived: 'false' }
      await getAdminProductsHandler(dummyEvent)
      expect(mockState.capturedFilter.isActive).toBe(true)
    })

    it('does not filter isActive when isArchived is all', async () => {
      mockState.query = { isArchived: 'all' }
      await getAdminProductsHandler(dummyEvent)
      expect(mockState.capturedFilter.isActive).toBeUndefined()
    })

    it('filters on discount > 0 when hasDiscount is true', async () => {
      mockState.query = { hasDiscount: 'true' }
      await getAdminProductsHandler(dummyEvent)
      expect(mockState.capturedFilter.discount).toEqual({ $gt: 0 })
    })

    it('supports combining isArchived and hasDiscount filters', async () => {
      mockState.query = { isArchived: 'false', hasDiscount: 'true' }
      await getAdminProductsHandler(dummyEvent)
      expect(mockState.capturedFilter.isActive).toBe(true)
      expect(mockState.capturedFilter.discount).toEqual({ $gt: 0 })
    })
  })

  describe('5. Catalog Allergen Exclusion Filtering (GET /api/catalog - AC-10)', () => {
    it('resolves semantic allergen code (e.g. milk) and excludes matching products via $nin', async () => {
      mockState.query = { excludeAllergens: 'milk' }
      await getCatalogHandler(dummyEvent)
      expect(mockState.capturedFilter.allergens).toBeDefined()
      expect(mockState.capturedFilter.allergens.$nin).toBeDefined()
      const excludedStrs = mockState.capturedFilter.allergens.$nin.map(String)
      expect(excludedStrs).toContain('65fa2c9e83b1d2001e4a9f20')
    })

    it('resolves comma-separated allergen codes (e.g. milk,gluten) into multiple ObjectIds in $nin', async () => {
      mockState.query = { excludeAllergens: 'milk,gluten' }
      await getCatalogHandler(dummyEvent)
      expect(mockState.capturedFilter.allergens).toBeDefined()
      expect(mockState.capturedFilter.allergens.$nin).toBeDefined()
      const excludedStrs = mockState.capturedFilter.allergens.$nin.map(String)
      expect(excludedStrs).toContain('65fa2c9e83b1d2001e4a9f20')
      expect(excludedStrs).toContain('65fa2c9e83b1d2001e4a9f21')
    })

    it('supports array query parameter (e.g. ?excludeAllergens=milk&excludeAllergens=gluten)', async () => {
      mockState.query = { excludeAllergens: ['milk', 'gluten'] }
      await getCatalogHandler(dummyEvent)
      const excludedStrs = mockState.capturedFilter.allergens.$nin.map(String)
      expect(excludedStrs).toContain('65fa2c9e83b1d2001e4a9f20')
      expect(excludedStrs).toContain('65fa2c9e83b1d2001e4a9f21')
    })

    it('passes direct 24-character ObjectIds directly to $nin without error', async () => {
      const customId = '65fa2c9e83b1d2001e4a9f99'
      mockState.query = { excludeAllergens: customId }
      await getCatalogHandler(dummyEvent)
      expect(mockState.capturedFilter.allergens).toBeDefined()
      const excludedStrs = mockState.capturedFilter.allergens.$nin.map(String)
      expect(excludedStrs).toContain(customId)
    })

    it('does not apply allergens filter when excludeAllergens is omitted or empty', async () => {
      mockState.query = {}
      await getCatalogHandler(dummyEvent)
      expect(mockState.capturedFilter.allergens).toBeUndefined()

      mockState.query = { excludeAllergens: '' }
      await getCatalogHandler(dummyEvent)
      expect(mockState.capturedFilter.allergens).toBeUndefined()
    })
  })
})
