import { isValidObjectId } from 'mongoose'
import { Category } from '~/server/models/Category'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
  
  const body = await readBody(event)
  try {
    const updated = await Category.findByIdAndUpdate(id, body, { new: true })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    return updated
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
})
