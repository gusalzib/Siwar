// server/api/catalog/index.get.ts
import { type QueryFilter, Types } from 'mongoose'
import { Product, type IProduct } from '~/server/models/Product'
import { Category } from '~/server/models/Category'

/**
 * Route: GET /api/catalog
 * Public endpoint delivering paginated, faceted catalog items for SSR (Server-Side Rendering).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // 1. Parse pagination and sort parameters
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(48, Math.max(1, Number(query.limit) || 12))
  const skip = (page - 1) * limit
  const sortParam = String(query.sort || 'newest')

  // 2. Base filter: Only active public catalog items
  const filter: QueryFilter<IProduct> = { isActive: true }

  // 3. Category Filter (by ObjectId or multilingual slug)
  if (query.category) {
    const categoryParam = String(query.category).trim()
    if (Types.ObjectId.isValid(categoryParam)) {
      filter.category = new Types.ObjectId(categoryParam)
    } else {
      // Resolve slug match against SV, EN, or AR
      const categoryDoc = await Category.findOne({
        $or: [
          { 'slug.sv': categoryParam },
          { 'slug.en': categoryParam },
          { 'slug.ar': categoryParam },
          { code: categoryParam },
        ],
      }).select('_id').lean()

      if (categoryDoc) {
        filter.category = categoryDoc._id
      }
    }
  }

  // 4. AC-1: Simultaneous Multilingual Search
  // Queries Arabic, Swedish, English titles and brand simultaneously regardless of UI locale
  if (query.search || query.q) {
    const rawSearch = String(query.search || query.q).trim()
    if (rawSearch) {
      // Escape regex special characters to prevent injection
      const sanitized = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const searchRegex = new RegExp(sanitized, 'i')

      const searchConditions = [
        { 'name.ar': searchRegex },
        { 'name.sv': searchRegex },
        { 'name.en': searchRegex },
        { brand: searchRegex },
      ]

      filter.$and = filter.$and ? [...filter.$and, { $or: searchConditions }] : [{ $or: searchConditions }]
    }
  }

  // 5. AC-2: Allergen Exclusion Filtering ($nin)
  // Excludes any product whose allergens array contains ANY of the selected allergen IDs
  if (query.excludeAllergens) {
    const rawAllergens = Array.isArray(query.excludeAllergens)
      ? query.excludeAllergens
      : String(query.excludeAllergens).split(',')

    const allergenObjectIds = rawAllergens
      .map((id) => String(id).trim())
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id))

    if (allergenObjectIds.length > 0) {
      filter.allergens = { $nin: allergenObjectIds }
    }
  }

  // 6. Brand and Country of Origin Filters
  if (query.brand) {
    const brands = Array.isArray(query.brand) ? query.brand : String(query.brand).split(',')
    filter.brand = { $in: brands.map((b) => String(b).trim()) }
  }

  if (query.origin) {
    const origins = Array.isArray(query.origin) ? query.origin : String(query.origin).split(',')
    filter.countryOfOrigin = { $in: origins.map((o) => String(o).trim()) }
  }

  // 7. Sort Mapping
  let sortCriteria: Record<string, 1 | -1> = { createdAt: -1 }
  if (sortParam === 'price_asc') sortCriteria = { 'price.SEK': 1 }
  if (sortParam === 'price_desc') sortCriteria = { 'price.SEK': -1 }

  // 8. Concurrent query execution for TTFB < 300ms
  const [totalCount, rawProducts] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('allergens', 'name code')
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean(),
  ])

  // 9. Format response payload with comparison prices and safety buffer availability
  const products = rawProducts.map((p) => {
    const buffer = p.safetyBuffer ?? 0
    const availableStock = Math.max(0, p.stockQuantity - buffer)
    const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null

    // Determine inventory status code
    let statusCode = 'IN_STOCK'
    if (p.stockQuantity <= 0) {
      statusCode = 'OUT_OF_STOCK'
    } else if (availableStock === 0) {
      statusCode = 'OUT_OF_STOCK_ONLINE'
    }

    return {
      id: String(p._id),
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      countryOfOrigin: p.countryOfOrigin,
      allergens: p.allergens,
      primaryImage,
      price: p.price,
      discount: p.discount || 0,
      netQuantity: p.netQuantity,
      momsRate: p.momsRate,
      stockQuantity: p.stockQuantity,
      availableStock,
      statusCode,
      canAddToCart: availableStock > 0,
    }
  })

  return {
    products,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  }
})