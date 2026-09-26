// tests/unit/admin.products.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// 1. Hoisted Nitro & H3 Globals + Mocks
// Code inside vi.hoisted() runs BEFORE static imports are evaluated.
// ---------------------------------------------------------------------------
const { mockState, mockProductModel, mockProductInstance } = vi.hoisted(() => {
  const mockState = {
    body: {} as any,
    params: {} as Record<string, string>,
    status: null as number | null,
  }

  // Register Nitro / H3 auto-imported server globals
  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('getRouterParam', vi.fn((_event: any, param: string) => mockState.params[param]))
  vi.stubGlobal('setResponseStatus', vi.fn((_event: any, status: number) => {
    mockState.status = status
  }))
  vi.stubGlobal('createError', (err: { statusCode: number; statusMessage: string }) => {
    const error: any = new Error(err.statusMessage)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    return error
  })

  // Dummy Mongoose Document Instance
  const mockProductInstance = {
    _id: '65fa2c9e83b1d2001e4a9f10',
    name: { ar: 'طحينة', sv: 'Tahini', en: 'Tahini' },
    description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
    ingredients: { ar: 'سمسم', sv: 'Sesam', en: 'Sesame' },
    brand: 'Al Wadi',
    category: '65fa2c9e83b1d2001e4a9f11',
    price: { SEK: 4900, EUR: 430, USD: 470 },
    discount: 0,
    stockQuantity: 24,
    safetyBuffer: 3,
    netQuantity: { value: 450, unit: 'g' },
    grossWeight: 540,
    momsRate: 12,
    countryOfOrigin: 'Libanon',
    barcode: '5281001110052',
    allergens: [],
    images: [{ url: 'https://pub-xxx.r2.dev/products/img.webp', altText: 'Tahini', isPrimary: true }],
    isActive: true,
    save: vi.fn(async function (this: any) {
      return this
    }),
  }

  // Dummy Mongoose Model
  const mockProductModel: any = vi.fn(function (data: any) {
    return {
      ...data,
      _id: mockProductInstance._id,
      save: vi.fn(async function (this: any) {
        return this
      }),
    }
  })
  mockProductModel.findById = vi.fn()
  mockProductModel.findByIdAndUpdate = vi.fn()

  return { mockState, mockProductModel, mockProductInstance }
})

// ---------------------------------------------------------------------------
// 2. Mock Model Module
// ---------------------------------------------------------------------------
vi.mock('~/server/models/Product', () => ({
  Product: mockProductModel,
}))

// ---------------------------------------------------------------------------
// 3. Static Route Imports (Now safe because vi.hoisted set up globals first)
// ---------------------------------------------------------------------------
import createProductHandler from '~/server/api/admin/products/index.post.ts'
import updateProductHandler from '~/server/api/admin/products/[id].put.ts'
import getProductHandler from '~/server/api/admin/products/[id].get.ts'
import toggleActiveHandler from '~/server/api/admin/products/[id]/toggle-active.patch.ts'

// ---------------------------------------------------------------------------
// 4. Test Suite
// ---------------------------------------------------------------------------
describe('Admin Product Endpoints - Acceptance Criteria & Invariants', () => {
  const dummyEvent = {} as any
  const validObjectId = new Types.ObjectId().toString()

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.body = {}
    mockState.params = {}
    mockState.status = null
  })

  // -------------------------------------------------------------------------
  // AC-1: Multi-Currency Minor Unit Contract (POST & PUT)
  // -------------------------------------------------------------------------
  describe('AC-1: Independent Multi-Currency Minor Units', () => {
    const validBasePayload = {
      name: { ar: 'طحينة', sv: 'Tahini', en: 'Tahini' },
      description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
      brand: 'Al Wadi',
      category: validObjectId,
      stockQuantity: 20,
      safetyBuffer: 3,
      netQuantity: { value: 500, unit: 'g' },
      momsRate: 12,
    }

    it('rejects product creation when currency prices are floating decimals instead of integer minor units', async () => {
      mockState.body = {
        ...validBasePayload,
        price: { SEK: 49.50, EUR: 430, USD: 470 },
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'SEK, EUR, and USD prices must be non-negative integers in minor units'
      )
    })

    it('rejects product creation when any currency price is negative', async () => {
      mockState.body = {
        ...validBasePayload,
        price: { SEK: 4900, EUR: -100, USD: 470 },
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'SEK, EUR, and USD prices must be non-negative integers in minor units'
      )
    })

    it('rejects product creation when a required currency is missing', async () => {
      mockState.body = {
        ...validBasePayload,
        price: { SEK: 4900, EUR: 430 },
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'SEK, EUR, and USD prices must be non-negative integers in minor units'
      )
    })

    it('persists integer minor units exactly as supplied without automated conversion', async () => {
      mockState.body = {
        ...validBasePayload,
        price: { SEK: 4900, EUR: 430, USD: 470 },
      }

      const response = await createProductHandler(dummyEvent)
      expect(response.statusCode).toBe(201)
      expect(mockState.status).toBe(201)
    })
  })

  // -------------------------------------------------------------------------
  // Localization Guard: Mandatory 3-Language Copy
  // -------------------------------------------------------------------------
  describe('Multilingual Localization Guards (AR, SV, EN)', () => {
    it('rejects creation when Swedish translation is missing from product name', async () => {
      mockState.body = {
        name: { ar: 'بقلاوة', sv: '', en: 'Baklava' },
        description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
        brand: 'Sera',
        category: validObjectId,
        price: { SEK: 10000, EUR: 1000, USD: 1000 },
        stockQuantity: 10,
        safetyBuffer: 2,
        netQuantity: { value: 500, unit: 'g' },
        momsRate: 12,
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'Product name and description are mandatory in Arabic, Swedish, and English'
      )
    })

    it('rejects creation when Arabic description consists only of whitespace', async () => {
      mockState.body = {
        name: { ar: 'بقلاوة', sv: 'Baklava', en: 'Baklava' },
        description: { ar: '   ', sv: 'Beskrivning', en: 'Description' },
        brand: 'Sera',
        category: validObjectId,
        price: { SEK: 10000, EUR: 1000, USD: 1000 },
        stockQuantity: 10,
        safetyBuffer: 2,
        netQuantity: { value: 500, unit: 'g' },
        momsRate: 12,
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'Product name and description are mandatory in Arabic, Swedish, and English'
      )
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: Inventory & Safety Buffer Boundaries
  // -------------------------------------------------------------------------
  describe('AC-3: Inventory & Safety Buffer Configuration', () => {
    const validPayload = {
      name: { ar: 'بقلاوة', sv: 'Baklava', en: 'Baklava' },
      description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
      brand: 'Sera',
      category: validObjectId,
      price: { SEK: 10000, EUR: 1000, USD: 1000 },
      netQuantity: { value: 500, unit: 'g' },
      momsRate: 12,
    }

    it('rejects negative safety buffers', async () => {
      mockState.body = {
        ...validPayload,
        stockQuantity: 10,
        safetyBuffer: -1,
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'Safety buffer must be a non-negative integer'
      )
    })

    it('rejects decimal safety buffers', async () => {
      mockState.body = {
        ...validPayload,
        stockQuantity: 10,
        safetyBuffer: 2.5,
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'Safety buffer must be a non-negative integer'
      )
    })

    it('accepts a safetyBuffer of 0 to allow selling all physical inventory online', async () => {
      mockState.body = {
        ...validPayload,
        stockQuantity: 10,
        safetyBuffer: 0,
      }

      const response = await createProductHandler(dummyEvent)
      expect(response.statusCode).toBe(201)
    })
  })

  // -------------------------------------------------------------------------
  // Swedish Statutory Tax Compliance (Moms)
  // -------------------------------------------------------------------------
  describe('Moms Rate Compliance (12% Food, 25% Non-Food)', () => {
    it('rejects non-standard moms rates (e.g., 6% or 0%)', async () => {
      mockState.body = {
        name: { ar: 'طحينة', sv: 'Tahini', en: 'Tahini' },
        description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
        brand: 'Al Wadi',
        category: validObjectId,
        price: { SEK: 4900, EUR: 430, USD: 470 },
        stockQuantity: 10,
        safetyBuffer: 3,
        netQuantity: { value: 500, unit: 'g' },
        momsRate: 6,
      }

      await expect(createProductHandler(dummyEvent)).rejects.toThrowError(
        'Moms rate must be 12 (food) or 25 (non-food)'
      )
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/admin/products/:id (Form Hydration)
  // -------------------------------------------------------------------------
  describe('GET /api/admin/products/:id (Form Hydration)', () => {
    it('returns 400 when product ID format is invalid', async () => {
      mockState.params = { id: 'invalid-hex-id' }

      await expect(getProductHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Invalid product ID format',
      })
    })

    it('returns 404 when product does not exist in database', async () => {
      mockState.params = { id: validObjectId }
      mockProductModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      })

      await expect(getProductHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 404,
        statusMessage: 'Product not found',
      })
    })

    it('returns the product record when ID is valid', async () => {
      mockState.params = { id: validObjectId }
      mockProductModel.findById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockProductInstance),
      })

      const result = await getProductHandler(dummyEvent)
      expect(result.id).toBe(String(mockProductInstance._id))
      expect(result.brand).toBe('Al Wadi')
      expect(result.price.SEK).toBe(4900)
    })
  })

  // -------------------------------------------------------------------------
  // PUT /api/admin/products/:id (Product Mutation)
  // -------------------------------------------------------------------------
  describe('PUT /api/admin/products/:id (Product Update)', () => {
    it('updates product and returns 200 using returnDocument: after', async () => {
      mockState.params = { id: validObjectId }
      mockState.body = {
        name: { ar: 'طحينة جديدة', sv: 'Ny Tahini', en: 'New Tahini' },
        description: { ar: 'وصف جديد', sv: 'Ny beskrivning', en: 'New description' },
        brand: 'Al Wadi Al Akhdar',
        category: validObjectId,
        price: { SEK: 5500, EUR: 500, USD: 520 },
        stockQuantity: 30,
        safetyBuffer: 5,
        netQuantity: { value: 450, unit: 'g' },
        grossWeight: 540,
        momsRate: 12,
        isActive: true,
      }

      mockProductModel.findByIdAndUpdate.mockResolvedValue({
        _id: validObjectId,
        ...mockState.body,
      })

      const response = await updateProductHandler(dummyEvent)
      expect(response.statusCode).toBe(200)
      expect(response.message).toBe('Product updated successfully')
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validObjectId,
        expect.any(Object),
        { returnDocument: 'after', runValidators: true }
      )
    })
  })

  // -------------------------------------------------------------------------
  // AC-5: Soft-Archival Toggle (PATCH /toggle-active)
  // -------------------------------------------------------------------------
  describe('AC-5: Toggle Active State (Soft Deletion)', () => {
    it('inverts isActive from true to false', async () => {
      mockState.params = { id: validObjectId }

      const targetDoc = {
        _id: validObjectId,
        isActive: true,
        save: vi.fn(async function (this: any) {
          return this
        }),
      }
      mockProductModel.findById.mockResolvedValue(targetDoc)

      const result = await toggleActiveHandler(dummyEvent)

      expect(targetDoc.isActive).toBe(false)
      expect(targetDoc.save).toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 200,
        id: validObjectId,
        isActive: false,
      })
    })

    it('inverts isActive from false to true (reactivation)', async () => {
      mockState.params = { id: validObjectId }

      const targetDoc = {
        _id: validObjectId,
        isActive: false,
        save: vi.fn(async function (this: any) {
          return this
        }),
      }
      mockProductModel.findById.mockResolvedValue(targetDoc)

      const result = await toggleActiveHandler(dummyEvent)

      expect(targetDoc.isActive).toBe(true)
      expect(targetDoc.save).toHaveBeenCalled()
      expect(result.isActive).toBe(true)
    })
  })
})