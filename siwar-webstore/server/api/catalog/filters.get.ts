// server/api/catalog/filters.get.ts
import { Category } from '~/server/models/Category'
import { Allergen } from '~/server/models/Allergens'
import { Product } from '~/server/models/Product'

// Provides the active taxonomy used to populate the faceted filter sidebar and homepage categories

export default defineEventHandler(async () => {
  const [categories, allergens, distinctBrands, distinctOrigins, categoryImagesAgg] = await Promise.all([
    Category.find({ isActive: true }).select('_id name slug').lean(),
    Allergen.find({ isActive: true }).select('_id name code').lean(),
    Product.distinct('brand', { isActive: true }),
    Product.distinct('countryOfOrigin', { isActive: true, countryOfOrigin: { $ne: '' } }),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          hasValidImages: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$images', []] },
                        as: 'img',
                        cond: { $gt: [{ $strLenCP: { $ifNull: ['$$img.url', ''] } }, 0] },
                      },
                    },
                  },
                  0,
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      { $sort: { hasValidImages: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          firstProductImage: {
            $first: {
              $let: {
                vars: {
                  validImgs: {
                    $filter: {
                      input: { $ifNull: ['$images', []] },
                      as: 'img',
                      cond: { $gt: [{ $strLenCP: { $ifNull: ['$$img.url', ''] } }, 0] },
                    },
                  },
                },
                in: {
                  $let: {
                    vars: {
                      primaryImg: {
                        $filter: {
                          input: '$$validImgs',
                          as: 'vImg',
                          cond: { $eq: ['$$vImg.isPrimary', true] },
                        },
                      },
                    },
                    in: {
                      $cond: {
                        if: { $gt: [{ $size: '$$primaryImg' }, 0] },
                        then: { $arrayElemAt: ['$$primaryImg.url', 0] },
                        else: {
                          $cond: {
                            if: { $gt: [{ $size: '$$validImgs' }, 0] },
                            then: { $arrayElemAt: ['$$validImgs.url', 0] },
                            else: null,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]),
  ])

  const categoryMetaMap = new Map<string, { imageUrl: string | null; productCount: number }>()
  categoryImagesAgg.forEach((item: any) => {
    if (item._id) {
      categoryMetaMap.set(String(item._id), {
        imageUrl: item.firstProductImage || null,
        productCount: item.productCount || 0,
      })
    }
  })

  return {
    categories: categories.map((c: any) => {
      const catId = String(c._id)
      const meta = categoryMetaMap.get(catId)
      return {
        id: catId,
        name: c.name as Record<string, string>,
        slug: c.slug as Record<string, string>,
        imageUrl: meta?.imageUrl || null,
        productCount: meta?.productCount || 0,
      }
    }),
    allergens: allergens.map((a: any) => ({
      id: String(a._id),
      code: String(a.code),
      name: a.name as Record<string, string>,
    })),
    brands: (distinctBrands as string[]).filter(Boolean).sort(),
    origins: (distinctOrigins as string[]).filter(Boolean).sort(),
  }
})