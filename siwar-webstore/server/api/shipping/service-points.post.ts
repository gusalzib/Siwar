// server/api/shipping/service-points.post.ts

import { dhlAdapter } from '~/server/services/shipping/dhl.adapter'

interface ServicePointsRequestBody {
  postalCode?: string
  street?: string
  city?: string
  countryCode?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ServicePointsRequestBody>(event).catch(() => ({}))

  const postalCode = body?.postalCode ? String(body.postalCode).trim() : ''
  if (!postalCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Postal code is required to search for nearby service points.',
    })
  }

  const street = body?.street ? String(body.street).trim() : undefined
  const city = body?.city ? String(body.city).trim() : undefined
  const countryCode = body?.countryCode ? String(body.countryCode).trim() : 'SE'

  try {
    const servicePoints = await dhlAdapter.findNearestServicePoints({
      postalCode,
      street,
      city,
      countryCode,
      maxResults: 5,
    })

    return {
      servicePoints: servicePoints || [],
    }
  } catch (err: any) {
    console.error('[ServicePointsAPI] Failed to fetch service points:', err?.message || err)
    return {
      servicePoints: [],
      error: 'Failed to retrieve service points',
    }
  }
})

