import { Category } from '~/server/models/Category'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  try {
    const item = await Category.create(body)
    return item
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
})
