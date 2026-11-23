/**
 * server/scripts/seed-default-category.ts
 *
 * Standalone CLI script to seed or ensure the system default "Övrigt" (Other) category exists.
 * This runs outside Nuxt via tsx or node, connecting directly to MongoDB Atlas.
 *
 * Usage:
 *   npx tsx server/scripts/seed-default-category.ts
 *   npm run seed:category
 *
 * Environment variables expected (via .env):
 *   DATABASE_URL (or MONGODB_URI)
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { ensureDefaultCategory } from '../utils/defaultCategory'

// Load environment variables from .env file into process.env
config()

async function seedDefaultCategoryCli(): Promise<void> {
  const dbUri = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGODB_URL

  if (!dbUri) {
    console.error('Error: DATABASE_URL, MONGODB_URI, or MONGO_URL is not set in your environment.')
    process.exit(1)
  }

  console.log('Connecting to MongoDB...')

  try {
    await mongoose.connect(dbUri)
    console.log(' Connected to MongoDB Atlas.')

    const category = await ensureDefaultCategory()
    console.log(' System default fallback category verified/created successfully!')
    console.log(`   ID:              ${category._id}`)
    console.log(`   Name (Swedish):  ${category.name.sv}`)
    console.log(`   Name (Arabic):   ${category.name.ar}`)
    console.log(`   Name (English):  ${category.name.en}`)
    console.log(`   Slug:            ${JSON.stringify(category.slug)}`)
    console.log(`   isSystemDefault: ${category.isSystemDefault}`)
  } catch (error) {
    console.error(' Failed to seed default category:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log(' Disconnected from MongoDB.')
  }
}

seedDefaultCategoryCli()
