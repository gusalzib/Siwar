// tests/unit/admin.quick-adjust.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Types } from 'mongoose'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// 1. Hoisted Nitro & H3 Globals + Mocks
// ---------------------------------------------------------------------------
const { mockState, mockProductModel, mockStoreSettingsModel, dummyProduct } = vi.hoisted(() => {
  const mockState = {
    body: {} as any,
    params: {} as Record<string, string>,
    status: null as number | null,
  }

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

  const dummyProduct = {
    _id: '65fa2c9e83b1d2001e4a9f10',
    name: { ar: 'طحينة فاخرة', sv: 'Premium Tahini', en: 'Premium Tahini' },
    description: { ar: 'وصف', sv: 'Beskrivning', en: 'Description' },
    brand: 'Al Wadi',
    price: { SEK: 4900, EUR: 430, USD: 470 },
    discount: 0,
    discountStartsAt: null,
    discountExpiresAt: null,
    stockQuantity: 5,
    safetyBuffer: 3,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }

  const mockProductModel: any = {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  }

  const mockStoreSettingsModel: any = {
    findOne: vi.fn(),
  }

  return { mockState, mockProductModel, mockStoreSettingsModel, dummyProduct }
})

// ---------------------------------------------------------------------------
// 2. Mock Models & Services
// ---------------------------------------------------------------------------
vi.mock('~/server/models/Product', () => ({
  Product: mockProductModel,
}))

vi.mock('~/server/models/StoreSettings', () => ({
  StoreSettings: mockStoreSettingsModel,
}))

// ---------------------------------------------------------------------------
// 3. Static Route Handler Imports
// ---------------------------------------------------------------------------
import stockPatchHandler from '~/server/api/admin/products/[id]/stock.patch.ts'
import discountPatchHandler from '~/server/api/admin/products/[id]/discount.patch.ts'

// ---------------------------------------------------------------------------
// 4. Test Suite
// ---------------------------------------------------------------------------
describe('Issue #28: Fast-Path Stock & Discount Adjustment Architecture', () => {
  const dummyEvent = {} as any
  const validId = new Types.ObjectId().toString()

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.body = {}
    mockState.params = { id: validId }
    mockState.status = null

    // Default mock behavior for Product.findById
    mockProductModel.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: validId,
        stockQuantity: 5,
        safetyBuffer: 3,
        discount: 0,
        discountStartsAt: null,
        discountExpiresAt: null,
        updatedAt: new Date(),
      }),
    })

    // Default mock behavior for StoreSettings.findOne
    mockStoreSettingsModel.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          inventory: { defaultGlobalSafetyBuffer: 3 },
        }),
      }),
    })
  })

  // -------------------------------------------------------------------------
  // Part 1: PATCH /api/admin/products/:id/stock
  // -------------------------------------------------------------------------
  describe('PATCH /api/admin/products/:id/stock', () => {
    it('rejects invalid ObjectId formats with HTTP 400', async () => {
      mockState.params = { id: 'invalid-id-format' }
      await expect(stockPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Invalid product ID format',
      })
    })

    it('AC-3: rejects negative stock adjustments with HTTP 400 safeguard', async () => {
      // Current stock is 5; delta -10 would result in -5
      mockState.body = { delta: -10 }
      await expect(stockPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'stockQuantity cannot be negative',
      })
    })

    it('AC-3: rejects direct negative stockQuantity input with HTTP 400 safeguard', async () => {
      mockState.body = { stockQuantity: -3 }
      await expect(stockPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'stockQuantity cannot be negative',
      })
    })

    it('AC-1: applies delta +12 to physical stock 5, resulting in 17 total and 14 online available', async () => {
      mockState.body = { delta: 12 }

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          stockQuantity: 17,
          safetyBuffer: 3,
          updatedAt: new Date(),
        }),
      })

      const response = await stockPatchHandler(dummyEvent)

      expect(response.statusCode).toBe(200)
      expect(response.stockQuantity).toBe(17)
      expect(response.safetyBuffer).toBe(3)
      expect(response.availableStock).toBe(14) // 17 - 3 = 14

      // Verifies atomic $set operation
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          $set: expect.objectContaining({ stockQuantity: 17 }),
        }),
        { returnDocument: 'after' }
      )
    })

    it('AC-2: applies safetyBuffer adjustment atomically as a non-negative integer', async () => {
      mockState.body = { safetyBuffer: 2 }

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          stockQuantity: 5,
          safetyBuffer: 2,
          updatedAt: new Date(),
        }),
      })

      const response = await stockPatchHandler(dummyEvent)

      expect(response.statusCode).toBe(200)
      expect(response.safetyBuffer).toBe(2)
      expect(response.availableStock).toBe(3) // 5 - 2 = 3

      // Verifies atomic $set operation
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          $set: expect.objectContaining({ safetyBuffer: 2 }),
        }),
        { returnDocument: 'after' }
      )
    })

    it('rejects negative safetyBuffer input with HTTP 400 safeguard', async () => {
      mockState.body = { safetyBuffer: -1 }
      await expect(stockPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'safetyBuffer must be a non-negative integer',
      })
    })

    it('AC-6: isolates updates so only inventory/buffer and updatedAt are modified', async () => {
      mockState.body = { stockQuantity: 20, safetyBuffer: 4 }

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          stockQuantity: 20,
          safetyBuffer: 4,
          updatedAt: new Date(),
        }),
      })

      await stockPatchHandler(dummyEvent)

      const updateCall = mockProductModel.findByIdAndUpdate.mock.calls[0]
      const updatePayload = updateCall[1]

      expect(updatePayload.$set).toHaveProperty('stockQuantity', 20)
      expect(updatePayload.$set).toHaveProperty('safetyBuffer', 4)
      expect(updatePayload.$set).toHaveProperty('updatedAt')
      expect(updatePayload.$set).not.toHaveProperty('name')
      expect(updatePayload.$set).not.toHaveProperty('description')
      expect(updatePayload.$set).not.toHaveProperty('price')
      expect(updatePayload.$set).not.toHaveProperty('images')
    })
  })

  // -------------------------------------------------------------------------
  // Part 2: PATCH /api/admin/products/:id/discount
  // -------------------------------------------------------------------------
  describe('PATCH /api/admin/products/:id/discount', () => {
    it('rejects invalid ObjectId formats with HTTP 400', async () => {
      mockState.params = { id: 'invalid-id' }
      await expect(discountPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Invalid product ID format',
      })
    })

    it('rejects negative or out-of-range discount values (>90%) with HTTP 400', async () => {
      mockState.body = { discount: -5 }
      await expect(discountPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'discount must be between 0 and 90',
      })

      mockState.body = { discount: 95 }
      await expect(discountPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'discount must be between 0 and 90',
      })
    })

    it('rejects discount schedules where expiresAt <= startsAt with HTTP 400', async () => {
      mockState.body = {
        discount: 20,
        discountStartsAt: '2026-06-01T12:00:00Z',
        discountExpiresAt: '2026-06-01T10:00:00Z', // before startsAt
      }

      await expect(discountPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'discountExpiresAt must be after discountStartsAt',
      })
    })

    it('AC-4: applies 25% discount and sets campaign schedule atomically', async () => {
      const starts = new Date('2026-01-01T00:00:00Z')
      const expires = new Date('2026-12-31T23:59:59Z')

      mockState.body = {
        discount: 25,
        discountStartsAt: starts.toISOString(),
        discountExpiresAt: expires.toISOString(),
      }

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          discount: 25,
          discountStartsAt: starts,
          discountExpiresAt: expires,
          updatedAt: new Date(),
        }),
      })

      const response = await discountPatchHandler(dummyEvent)

      expect(response.statusCode).toBe(200)
      expect(response.discount).toBe(25)
      expect(response.showDiscountBadge).toBe(true)

      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          $set: expect.objectContaining({
            discount: 25,
            discountStartsAt: starts,
            discountExpiresAt: expires,
          }),
        }),
        { returnDocument: 'after' }
      )
    })

    it('AC-5: sets discount to 0% and automatically normalizes schedule dates to null', async () => {
      mockState.body = {
        discount: 0,
        discountStartsAt: '2026-01-01T00:00:00Z',
        discountExpiresAt: '2026-12-31T23:59:59Z',
      }

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          discount: 0,
          discountStartsAt: null,
          discountExpiresAt: null,
          updatedAt: new Date(),
        }),
      })

      const response = await discountPatchHandler(dummyEvent)

      expect(response.statusCode).toBe(200)
      expect(response.discount).toBe(0)
      expect(response.discountStartsAt).toBeNull()
      expect(response.discountExpiresAt).toBeNull()
      expect(response.discountStatus).toBe('none')
      expect(response.showDiscountBadge).toBe(false)

      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({
          $set: expect.objectContaining({
            discount: 0,
            discountStartsAt: null,
            discountExpiresAt: null,
          }),
        }),
        { returnDocument: 'after' }
      )
    })

    it('rejects applying ordinary discount with HTTP 400 when product has active Kortdatum clearance', async () => {
      mockProductModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          discount: 0,
          kortdatum: {
            isKortdatum: true,
            clearanceDiscount: 40,
            bestBeforeDate: new Date('2026-12-01'),
          },
          updatedAt: new Date(),
        }),
      })

      mockState.body = { discount: 20 }

      await expect(discountPatchHandler(dummyEvent)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Kortdatum clearance is active for this product'),
      })
    })

    it('allows setting discount to 0% even if product has Kortdatum clearance record', async () => {
      mockProductModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          discount: 0,
          kortdatum: {
            isKortdatum: true,
            clearanceDiscount: 40,
            bestBeforeDate: new Date('2026-12-01'),
          },
          updatedAt: new Date(),
        }),
      })

      mockProductModel.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: validId,
          discount: 0,
          discountStartsAt: null,
          discountExpiresAt: null,
          updatedAt: new Date(),
        }),
      })

      mockState.body = { discount: 0 }

      const response = await discountPatchHandler(dummyEvent)
      expect(response.statusCode).toBe(200)
      expect(response.discount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Part 3: Frontend Component & Integration Verification
  // -------------------------------------------------------------------------
  describe('Frontend Quick-Action Modals & Integration', () => {
    const stockModalPath = path.resolve(__dirname, '../../components/admin/AdminStockAdjustModal.vue')
    const discountModalPath = path.resolve(__dirname, '../../components/admin/AdminDiscountAdjustModal.vue')
    const productsViewPath = path.resolve(__dirname, '../../pages/admin/products/index.vue')

    it('AdminStockAdjustModal.vue wraps BaseModal and includes delta buttons and availability badge', () => {
      const content = fs.readFileSync(stockModalPath, 'utf-8')
      expect(content).toContain('<BaseModal')
      expect(content).toContain('applyDelta(-1)')
      expect(content).toContain('applyDelta(1)')
      expect(content).toContain('applyDelta(5)')
      expect(content).toContain('applyDelta(10)')
      expect(content).toContain('applyDelta(20)')
      expect(content).toContain('effectiveOnlineStock')
      expect(content).toContain('localBuffer')
    })

    it('AdminDiscountAdjustModal.vue wraps BaseModal and includes presets, datetime pickers, and clear dates', () => {
      const content = fs.readFileSync(discountModalPath, 'utf-8')
      expect(content).toContain('<BaseModal')
      expect(content).toContain('DISCOUNT_PRESETS')
      expect(content).toContain('selectPreset')
      expect(content).toContain('clearDates')
      expect(content).toContain('type="datetime-local"')
      expect(content).toContain('calculateDiscountedPrice')
      expect(content).toContain('hasActiveKortdatum')
      expect(content).toContain('hasActiveCategorySale')
      expect(content).toContain('isDiscountBlocked')
      expect(content).toContain('kortdatumActiveNotice')
      expect(content).toContain('categorySaleActiveNotice')
    })

    it('pages/admin/products/index.vue includes trigger buttons and mounts both modals', () => {
      const content = fs.readFileSync(productsViewPath, 'utf-8')
      expect(content).toContain('openStockModal(product)')
      expect(content).toContain('openDiscountModal(product)')
      expect(content).toContain('onStockSaved')
      expect(content).toContain('onDiscountSaved')
      expect(content).toContain('<AdminStockAdjustModal')
      expect(content).toContain('<AdminDiscountAdjustModal')
      expect(content).toContain('name="lucide:boxes"')
      expect(content).toContain('name="lucide:percent"')
    })

    it('verifies all required i18n keys are declared in sv.json, en.json, and ar.json', () => {
      const sv = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/sv.json'), 'utf-8'))
      const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8'))
      const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8'))

      // Action triggers
      expect(sv.admin.products.actions.quickStock).toBeTruthy()
      expect(sv.admin.products.actions.quickDiscount).toBeTruthy()
      expect(en.admin.products.actions.quickStock).toBeTruthy()
      expect(en.admin.products.actions.quickDiscount).toBeTruthy()
      expect(ar.admin.products.actions.quickStock).toBeTruthy()
      expect(ar.admin.products.actions.quickDiscount).toBeTruthy()

      // Stock modal keys
      expect(sv.admin.stockModal.title).toBeTruthy()
      expect(sv.admin.stockModal.inStockBadge).toBeTruthy()
      expect(en.admin.stockModal.title).toBeTruthy()
      expect(en.admin.stockModal.inStockBadge).toBeTruthy()
      expect(ar.admin.stockModal.title).toBeTruthy()
      expect(ar.admin.stockModal.inStockBadge).toBeTruthy()

      // Discount modal keys
      expect(sv.admin.discountModal.title).toBeTruthy()
      expect(sv.admin.discountModal.clearDates).toBeTruthy()
      expect(sv.admin.discountModal.kortdatumActiveTitle).toBeTruthy()
      expect(sv.admin.discountModal.kortdatumActiveNotice).toBeTruthy()
      expect(sv.admin.discountModal.categorySaleActiveTitle).toBeTruthy()
      expect(sv.admin.discountModal.categorySaleActiveNotice).toBeTruthy()

      expect(en.admin.discountModal.title).toBeTruthy()
      expect(en.admin.discountModal.clearDates).toBeTruthy()
      expect(en.admin.discountModal.kortdatumActiveTitle).toBeTruthy()
      expect(en.admin.discountModal.kortdatumActiveNotice).toBeTruthy()
      expect(en.admin.discountModal.categorySaleActiveTitle).toBeTruthy()
      expect(en.admin.discountModal.categorySaleActiveNotice).toBeTruthy()

      expect(ar.admin.discountModal.title).toBeTruthy()
      expect(ar.admin.discountModal.clearDates).toBeTruthy()
      expect(ar.admin.discountModal.kortdatumActiveTitle).toBeTruthy()
      expect(ar.admin.discountModal.kortdatumActiveNotice).toBeTruthy()
      expect(ar.admin.discountModal.categorySaleActiveTitle).toBeTruthy()
      expect(ar.admin.discountModal.categorySaleActiveNotice).toBeTruthy()
    })
  })
})
