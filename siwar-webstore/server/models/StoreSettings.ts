// server/models/StoreSettings.ts
import mongoose, { Schema, model, type Document } from 'mongoose'

export interface IShippingTier {
  maxWeightGrams: number // e.g., 3000, 7000, or null/Infinity for final tier
  feeMinorSEK: number    // e.g., 7700 (77.00 SEK)
}

export interface IStoreSettings {
  shipping: {
    freeShippingThresholdMinorSEK: number // e.g., 89900 (899.00 SEK)
    deliveryDays: {
      min: number // e.g., 1
      max: number // e.g., 3
    }
    tiers: IShippingTier[]
  }
  inventory: {
    defaultGlobalSafetyBuffer: number // Fallback buffer (e.g., 3 or 5)
  }
  updatedAt: Date
}

const ShippingTierSchema = new Schema<IShippingTier>(
  {
    maxWeightGrams: { type: Number, required: true },
    feeMinorSEK: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const StoreSettingsSchema = new Schema<IStoreSettings>(
  {
    shipping: {
      freeShippingThresholdMinorSEK: { type: Number, default: 89900 },
      deliveryDays: {
        min: { type: Number, default: 1 },
        max: { type: Number, default: 3 },
      },
      tiers: {
        type: [ShippingTierSchema],
        default: [
          { maxWeightGrams: 3000, feeMinorSEK: 7700 },
          { maxWeightGrams: 7000, feeMinorSEK: 8900 },
          { maxWeightGrams: 9999999, feeMinorSEK: 10900 },
        ],
      },
    },
    inventory: {
      defaultGlobalSafetyBuffer: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
)

export const StoreSettings =
  mongoose.models.StoreSettings || model<IStoreSettings>('StoreSettings', StoreSettingsSchema)