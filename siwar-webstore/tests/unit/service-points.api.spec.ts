// tests/unit/service-points.api.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockState } = vi.hoisted(() => {
  const mockState = {
    body: {} as any,
  }

  vi.stubGlobal('defineEventHandler', (fn: any) => fn)
  vi.stubGlobal('readBody', vi.fn(async () => mockState.body))
  vi.stubGlobal('createError', (err: any) => {
    const error: any = new Error(err.statusMessage || err.message)
    error.statusCode = err.statusCode
    error.statusMessage = err.statusMessage
    return error
  })

  return { mockState }
})

import servicePointsHandler from '~/server/api/shipping/service-points.post'
import { dhlAdapter } from '~/server/services/shipping/dhl.adapter'

describe('Storefront Service Point Lookup API (POST /api/shipping/service-points)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.body = {}
  })

  it('throws 400 if postalCode is missing or empty', async () => {
    mockState.body = { postalCode: '' }

    await expect(servicePointsHandler({} as any)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('Postal code is required'),
    })
  })

  it('calls dhlAdapter.findNearestServicePoints with sanitized parameters', async () => {
    mockState.body = {
      postalCode: ' 302 43 ',
      street: ' Storgatan 12 ',
      city: ' Halmstad ',
      countryCode: ' SE ',
    }

    const spy = vi.spyOn(dhlAdapter, 'findNearestServicePoints').mockResolvedValueOnce([
      {
        id: '2510',
        name: 'Coop Halmstad',
        street: 'Köpmansgatan 12',
        postalCode: '30242',
        city: 'Halmstad',
        distanceMeters: 740,
      },
    ])

    const result = await servicePointsHandler({} as any)

    expect(spy).toHaveBeenCalledWith({
      postalCode: '302 43',
      street: 'Storgatan 12',
      city: 'Halmstad',
      countryCode: 'SE',
      maxResults: 5,
    })

    expect(result.servicePoints).toHaveLength(1)
    expect(result.servicePoints[0]?.id).toBe('2510')
  })

  it('handles errors gracefully by returning empty servicePoints array with error flag', async () => {
    mockState.body = { postalCode: '99999' }

    vi.spyOn(dhlAdapter, 'findNearestServicePoints').mockRejectedValueOnce(
      new Error('DHL API Network Error')
    )

    const result = await servicePointsHandler({} as any)

    expect(result.servicePoints).toEqual([])
    expect(result.error).toBe('Failed to retrieve service points')
  })
})

