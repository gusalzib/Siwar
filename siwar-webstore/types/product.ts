// types/product.ts
import type { ProductAvailability } from '~/server/services/inventory.service'
import type { SupportedUnit } from '~/server/services/pricing.service'

export interface LocalizedString {
  ar: string
  sv: string
  en: string
}

export interface PopulatedCategory {
  _id: string
  name: LocalizedString
  slug: LocalizedString
  discountPercent?: number
  discountStartsAt?: Date | string | null
  discountExpiresAt?: Date | string | null
  isActiveDiscount?: boolean
  isSystemDefault?: boolean
}

export interface PopulatedAllergen {
  _id: string
  code: string
  name: LocalizedString
}

export interface StorefrontProduct {
  id: string
  _id: string
  name: LocalizedString
  description: LocalizedString
  ingredients?: LocalizedString
  brand: string
  category?: PopulatedCategory
  grossWeight?: number
  images: Array<{
    url: string
    altText?: string
    isPrimary?: boolean
  }>
  price: {
    SEK: number
    EUR: number
    USD: number
  }
  discount?: number
  discountStartsAt?: Date | string | null
  discountExpiresAt?: Date | string | null
  discountedPrice?: {
    SEK: number
    EUR: number
    USD: number
  } | null
  discountSource?: string
  activeDiscountType?: 'KORTDATUM' | 'CATEGORY' | 'ORDINARY' | 'NONE'
  deadlineDate?: Date | string | null
  freeShipping?: boolean
  netQuantity: {
    value: number
    unit: SupportedUnit
  }
  momsRate: 6 | 12 | 25
  kortdatum?: {
    isKortdatum: boolean
    bestBeforeDate?: Date | string | null
    clearanceDiscount?: number
  } | null
  countryOfOrigin?: string
  allergens?: PopulatedAllergen[]
  nutritionTable?: {
    energyKj?: number
    energyKcal?: number
    fat?: number
    saturatedFat?: number
    carbohydrates?: number
    sugars?: number
    protein?: number
    salt?: number
  }
  availability: ProductAvailability
}
