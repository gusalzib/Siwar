// server/api/admin/products/index.get.ts
import type { QueryFilter } from 'mongoose'
import { Product, type IProduct } from '~/server/models/Product'

// This naming convention comes from Nuxt and Nitro's file-based routing system, not TypeScript itself. Nitro turns folder 
// structures and filenames inside server/api/ into live API endpoints automatically.
// index represents the root of the folder:
// Just like index.html is the default landing page of a folder in traditional web development, index in Nuxt/Nitro 
// represents the bare directory route. A file named server/api/admin/products/index... maps to /api/admin/products.
// (If you named it server/api/admin/products/list.get.ts, the URL would be /api/admin/products/list instead).


/**
 * Route: GET /api/admin/products
 * Access: Admin & Staff (Protected by server/middleware/admin-auth.ts)
 * 
 * Query Parameters:
 * - ?category=ID           -> Filter by MongoDB Category ObjectId
 * - ?stockStatus=low|out   -> Filter by buffer cut-off or zero inventory
 * - ?missingTranslations=true -> Filter products lacking AR, SV, or EN copy
 * - ?search=text           -> Case-insensitive search on name or brand
 */
export default defineEventHandler(async (event) => {
  // 1. Extract query parameters from the request URL (e.g. ?category=123&search=tea)
  const query = getQuery(event)
  const categoryId = query.category ? String(query.category) : ''
  const stockStatus = query.stockStatus ? String(query.stockStatus) : 'all'
  const missingTranslations = query.missingTranslations === 'true'
  const search = query.search ? String(query.search).trim() : ''

  // 2. Initialize a dynamic MongoDB filter object.
  // FilterQuery<IProduct> tells TypeScript that every key added to this object
  // must match a valid field from the Product model.
  const filter: QueryFilter<IProduct> = {}

  // --- Filter 1: By Category ---
  if (categoryId) {
    filter.category = categoryId
  }

  // --- Filter 2: By Stock Level & Safety Buffer ---
  if (stockStatus === 'low') {
    // "Low stock" means physical stock is greater than 0,
    // but at or below the product's safetyBuffer threshold.
    filter.stockQuantity = { $gt: 0 } // $gt = Greater Than

    // $expr allows comparing two database fields directly inside MongoDB
    // In this case: checks if stockQuantity <= safetyBuffer
    filter.$expr = { $lte: ['$stockQuantity', '$safetyBuffer'] } // $lte = Less Than or Equal
  } else if (stockStatus === 'out') {
    // Completely out of stock (0 units or negative)
    filter.stockQuantity = { $lte: 0 }
  }

  // --- Filter 3: Missing Translations Audit ---
  // Checks if any mandatory text field in Arabic, Swedish, or English is null or empty
  if (missingTranslations) {
    filter.$or = [
      { 'name.ar': { $in: [null, ''] } },
      { 'name.sv': { $in: [null, ''] } },
      { 'name.en': { $in: [null, ''] } },
      { 'description.ar': { $in: [null, ''] } },
      { 'description.sv': { $in: [null, ''] } },
      { 'description.en': { $in: [null, ''] } },
    ]
  }

  // --- Filter 4: Keyword Search ---
  if (search) {
    // 'i' creates a case-insensitive regular expression match
    const searchRegex = new RegExp(search, 'i')

    const searchFilter = {
      $or: [
        { 'name.ar': searchRegex },
        { 'name.sv': searchRegex },
        { 'name.en': searchRegex },
        { brand: searchRegex },
      ],
    }

    // Merge search filter with existing filters using $and so they do not overwrite each other
    filter.$and = filter.$and ? [...filter.$and, searchFilter] : [searchFilter]
  }

  // 3. Execute MongoDB Query
  // - .find(filter): matches all products meeting our filter criteria
  // - .populate('category', 'name'): replaces the category ObjectId with the actual Category document (name only)
  // - .sort({ createdAt: -1 }): orders newest items first
  // - .lean(): returns plain lightweight JavaScript objects instead of heavy Mongoose documents
  const products = await Product.find(filter)
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .lean()

  // 4. Transform and enrich each product for the frontend data table
  return products.map((p) => {
    // This callback runs once for EACH individual product 'p' in the array
    // Check if any language fields are missing or whitespace-only
    const hasMissingTranslations =
      !p.name?.ar?.trim() ||
      !p.name?.sv?.trim() ||
      !p.name?.en?.trim() ||
      !p.description?.ar?.trim() ||
      !p.description?.sv?.trim() ||
      !p.description?.en?.trim()

    // Calculate effective online available stock using the omnichannel buffer formula:
    // Available Stock = MAX(0, Physical Stock - Safety Buffer)
    const effectiveBuffer = p.safetyBuffer ?? 0
    const availableStock = Math.max(0, p.stockQuantity - effectiveBuffer)

    // Return sanitized, flat properties expected by the Vue table component
    return {
      id: String(p._id),
      name: p.name,
      brand: p.brand,
      category: p.category,
      images: p.images,
      price: p.price,
      stockQuantity: p.stockQuantity,
      safetyBuffer: p.safetyBuffer,
      availableStock,
      isActive: p.isActive,
      hasMissingTranslations,
    }
  })
})