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
  netQuantity: {
    value: number
    unit: SupportedUnit
  }
  momsRate: 12 | 25
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
