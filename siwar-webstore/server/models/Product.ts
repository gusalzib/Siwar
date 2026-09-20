// server/models/Product.ts
import { Schema, model, models, type Document, type Types } from 'mongoose'

// ---------------------------------------------------------------------------
// 1. TypeScript Interfaces
// These define the shape of your product data for autocomplete and error catching.
// ---------------------------------------------------------------------------

// Structure for multi-currency prices stored as integers in minor units (öre / cents)
export interface IProductPrice {
  SEK: number // e.g., 4500 öre = 45.00 SEK
  EUR: number // e.g., 450 cents = 4.50 EUR
  USD: number // e.g., 500 cents = 5.00 USD
}

// Structure for net content size, used to calculate comparison prices (jämförpris)
export interface INetQuantity {
  value: number // Numeric quantity (e.g., 400 or 1.5)
  unit: 'g' | 'kg' | 'ml' | 'l' | 'st' | 'dl' | 'cl' | 'قطعة'// Measurement unit
}

// Structure for product photography with accessibility alt text
export interface IProductImage {
  url: string // Public CDN/R2 image URL
  altText?: string // Screen-reader description for SEO and accessibility
  isPrimary?: boolean // Marks the main thumbnail photo
}

// Main Product Document interface
export interface IProduct extends Document {
  // Multilingual display name across all supported languages
  name: {
    ar: string // Arabic (primary)
    sv: string // Swedish
    en: string // English
  }

  // Multilingual marketing description
  description: {
    ar: string
    sv: string
    en: string
  }

  // Legally separated ingredients list required by food regulations (EU 1169/2011)
  ingredients?: {
    ar?: string
    sv?: string
    en?: string
  }

  // Producer / brand name used for faceted filtering (e.g., "Al Wadi", "Sera")
  brand: string

  // Reference linking this item to its Category document
  category: Types.ObjectId

  // Gallery of photos stored on Cloudflare R2
  images: IProductImage[]

  // Manual pricing in all 3 currencies (stored as integers in minor units)
  price: IProductPrice

  // Optional promotional discount percentage (e.g., 10 for 10% off)
  discount?: number

  // Total physical inventory recorded in the store/warehouse
  stockQuantity: number

  // Omnichannel safety buffer to prevent online orders from overselling physical shelf stock
  // Available online = MAX(0, stockQuantity - safetyBuffer)
  safetyBuffer: number

  // Net food content size (for customer information and jämförpris calculation)
  netQuantity: INetQuantity

  // Physical shipping weight in grams (jar/carton + contents) for carrier freight tiers
  grossWeight: number

  // Swedish VAT rate: 12% for food, 25% for non-food items
  momsRate: 12 | 25

  // Country of origin for imported goods (e.g., "Libanon", "Turkiet")
  countryOfOrigin?: string

  // Declared allergens for filtering and consumer safety (e.g., ["sesam", "nötter"])
  allergens: Types.ObjectId[]

  // EAN/GTIN barcode for fulfillment scanning and future physical POS sync
  barcode?: string

  // Visibility toggle to draft or archive products without deleting them
  isActive: boolean

  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// 2. Mongoose Schema
// The database validation schema enforced inside MongoDB Atlas.
// ---------------------------------------------------------------------------
const ProductSchema = new Schema<IProduct>(
  {
    name: {
      ar: { type: String, required: true, trim: true },
      sv: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    description: {
      ar: { type: String, required: true, trim: true },
      sv: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    ingredients: {
      ar: { type: String, default: '', trim: true },
      sv: { type: String, default: '', trim: true },
      en: { type: String, default: '', trim: true },
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true, // Enables fast filtering by brand
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true, // Enables fast category page lookups
    },
    images: [
      {
        url: { type: String, required: true },
        altText: { type: String, default: '' },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    price: {
      // Minor units (integer amounts) eliminate decimal math errors
      SEK: { type: Number, required: true, min: 0 },
      EUR: { type: Number, required: true, min: 0 },
      USD: { type: Number, required: true, min: 0 },
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    safetyBuffer: {
      type: Number,
      required: true,
      min: 0,
      default: 0, // Set to 2 or 3 for fast-moving items to protect shelf inventory
    },
    netQuantity: {
      value: { type: Number, required: true, min: 0 },
      unit: {
        type: String,
        required: true,
        enum: ['g', 'kg', 'ml', 'l', 'st'], // Allowed metric units for comparison pricing
      },
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0, // Package weight in grams for PostNord/freight pricing
    },
    momsRate: {
      type: Number,
      required: true,
      enum: [12, 25], // Fixed Swedish tax rates: 12% food, 25% non-food
      default: 12,
    },
    countryOfOrigin: {
      type: String,
      default: '',
      trim: true,
    },
    allergens: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Allergen',
        index: true, // Enables fast filtering by allergen ID
      },
    ],
    barcode: {
      type: String,
      trim: true,
      sparse: true, // Allows null/empty values without violating unique constraints
      index: true,  // Speeds up barcode lookups during packing
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Automatically creates and maintains createdAt and updatedAt dates
    timestamps: true,
  }
)

// ---------------------------------------------------------------------------
// 3. Database Indexes
// Compound text index enabling concurrent keyword search across all 3 languages
// ---------------------------------------------------------------------------
ProductSchema.index({
  'name.ar': 'text',
  'name.sv': 'text',
  'name.en': 'text',
  brand: 'text',
  'ingredients.ar': 'text',
  'ingredients.sv': 'text',
  'ingredients.en': 'text',
})

// Multikey index for fast faceted filtering & allergen exclusions (FR-2)
ProductSchema.index({ allergens: 1 })
// ---------------------------------------------------------------------------
// 4. Model Export
// Prevents Nuxt/Nitro hot reload from recompiling existing Mongoose models
// ---------------------------------------------------------------------------
export const Product = models.Product || model<IProduct>('Product', ProductSchema)