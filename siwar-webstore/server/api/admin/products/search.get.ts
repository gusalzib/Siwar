// server/api/admin/products/search.get.ts
import { Product } from '~/server/models/Product'

export default defineEventHandler(async (event) => {
  const query = getQuery(event).q ? String(getQuery(event).q).trim() : ''

  if (!query) {
    return []
  }

  // Search across multilingual names, SKU, and barcode
  const products = await Product.find({
    isActive: true,
    $or: [
      { 'name.ar': { $regex: query, $options: 'i' } },
      { 'name.sv': { $regex: query, $options: 'i' } },
      { 'name.en': { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { barcode: { $regex: query, $options: 'i' } },
    ],
  })
    .select('_id name sku price momsRate stockQuantity')
    .limit(10)
    .lean()

  return products
})