import { Allergen } from '~/server/models/Allergens'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  try {
    const item = await Allergen.create(body)
    return item
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
})
