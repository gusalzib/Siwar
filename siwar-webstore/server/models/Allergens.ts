// server/models/Allergen.ts
import mongoose, { Schema, model, type Document, type Model } from 'mongoose'

// Blueprint for the Allergen entity
export interface IAllergen extends Document {
  // A unique, language-agnostic key (e.g., "sesame", "peanuts", "gluten")
  code: string

  // Localized display labels for each supported store language
  name: {
    ar: string
    sv: string
    en: string
  }

  // Active status toggle for the admin dropdown
  isActive: boolean

  createdAt: Date
  updatedAt: Date
}

const AllergenSchema = new Schema<IAllergen>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      ar: { type: String, required: true, trim: true },
      sv: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

export const Allergen = (mongoose.models.Allergen as Model<IAllergen>) || model<IAllergen>('Allergen', AllergenSchema)