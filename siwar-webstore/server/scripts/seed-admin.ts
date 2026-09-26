/**
 * server/scripts/seed-admin.ts
 *
 * Standalone CLI script to bootstrap the root administrator account.
 * This runs outside Nuxt via tsx or node, connecting directly to MongoDB Atlas.
 *
 * Usage:
 *   npx tsx server/scripts/seed-admin.ts
 *
 * Environment variables expected (via .env):
 *   DATABASE_URL (or MONGODB_URI)
 *   ADMIN_DEFAULT_EMAIL (optional, defaults to admin@siwar.se)
 *   ADMIN_DEFAULT_PASSWORD (optional, defaults to a generated secure string)
 */

import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { config } from 'dotenv'
import { Admin } from '../models/Admin'

// Load environment variables from .env file into process.env
config()

const BCRYPT_SALT_ROUNDS = 12

async function seedAdmin(): Promise<void> {
  const dbUri = process.env.DATABASE_URL || process.env.MONGODB_URI

  if (!dbUri) {
    console.error('Error: DATABASE_URL or MONGODB_URI is not set in your .env file.')
    process.exit(1)
  }

  const email = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@siwar.se').toLowerCase().trim()
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'SiwarAdmin2026!'

  console.log('Connecting to MongoDB...')

  try {
    await mongoose.connect(dbUri)
    console.log(' Connected to MongoDB Atlas.')

    // 1. Check if an admin with this email already exists
    const existingAdmin = await Admin.findOne({ email })

    if (existingAdmin) {
      console.log(`Admin account "${email}" already exists. No changes made.`)
      return
    }

    // 2. Hash the password with bcrypt (12 rounds)
    console.log('Hashing admin password with bcrypt...')
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

    // 3. Insert the root admin
    const newAdmin = await Admin.create({
      email,
      passwordHash,
      role: 'admin',
    })

    if (!newAdmin) {
        console.error(' Failed to seed admin account. New Admin is null');
        return;
    }

    console.log('   Root admin account successfully created!')
    console.log(`   ID:    ${newAdmin._id}`)
    console.log(`   Email: ${newAdmin.email}`)
    console.log(`   Role:  ${newAdmin.role}`)
    console.log('   Make sure to update the default password after your first login.')
  } catch (error) {
    console.error(' Failed to seed admin account:', error)
    process.exit(1)
  } finally {
    // 4. Safely close database connection so CLI terminates cleanly
    await mongoose.disconnect()
    console.log(' Disconnected from MongoDB.')
  }
}

seedAdmin()