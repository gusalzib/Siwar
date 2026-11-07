// server/utils/defaultAdmin.ts
import bcrypt from 'bcrypt'
import { Admin, type IAdmin } from '../models/Admin'

const BCRYPT_SALT_ROUNDS = 12

/**
 * Automatically ensures that the root administrator account exists in MongoDB.
 *
 * Checks if an admin already exists. If not found, creates the initial admin account
 * using credentials from environment variables (or secure defaults).
 */
export async function ensureDefaultAdmin(): Promise<IAdmin | null> {
  const email = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@siwar.se').toLowerCase().trim()
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'SiwarAdmin2026!'

  // 1. Check if an admin with this email already exists
  const existingAdmin = await Admin.findOne({ email })
  if (existingAdmin) {
    return existingAdmin
  }

  // 2. Check if ANY admin account exists
  const anyAdmin = await Admin.countDocuments()
  if (anyAdmin > 0) {
    return null
  }

  // 3. Hash the password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

  // 4. Create the initial root admin
  const newAdmin = await Admin.create({
    email,
    passwordHash,
    role: 'admin',
  })

  console.log(`✅ Root administrator created successfully: ${email}`)
  return newAdmin
}

