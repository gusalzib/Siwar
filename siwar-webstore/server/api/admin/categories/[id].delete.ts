import { isValidObjectId } from 'mongoose'
import { Category } from '~/server/models/Category'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !isValidObjectId(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid ID' })
  
  const result = await Category.findByIdAndDelete(id)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { success: true }
})
