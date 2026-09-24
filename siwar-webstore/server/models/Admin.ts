/**
 * server/models/Admin.ts
 *
 * Mongoose model for store administrators and staff.
 * Admins are seeded via CLI or created by super-admins and never through public sign-up.
 */
import mongoose, { Schema, model, type Document, type Model } from 'mongoose'

// ---------------------------------------------------------------------------
// 1. TypeScript Interface
// Defines the shape of an Admin document in TypeScript code.
// ---------------------------------------------------------------------------
export interface IAdmin extends Document {
  email: string
  passwordHash: string
  role: 'admin' | 'staff'
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// 2. Mongoose Schema
// Enforces schema structure and validations directly inside MongoDB.
// ---------------------------------------------------------------------------
const AdminSchema = new Schema<IAdmin>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'staff'],
        message: '{VALUE} is not a supported role',
      },
      default: 'admin',
    },
  },
  {
    // Automatically manages createdAt and updatedAt properties
    timestamps: true,
  }
)

// ---------------------------------------------------------------------------
// 3. Model Export
// Nuxt 3 frequently re-evaluates server modules during development.
// Checking 'models.Admin' first prevents "OverwriteModelError".
// ---------------------------------------------------------------------------
export const Admin = (mongoose.models.Admin as Model<IAdmin>) || model<IAdmin>('Admin', AdminSchema)