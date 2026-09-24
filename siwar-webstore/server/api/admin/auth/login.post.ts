/**
 * server/api/admin/auth/login.post.ts
 *
 * Handles administrator authentication, validates bcrypt credentials,
 * and issues an encrypted HTTP-only session cookie.
 */
import bcrypt from 'bcrypt'
import { Admin } from '../../../models/Admin'
import { getAdminSession } from '../../../../utils/admin-session'

interface LoginRequestBody {
  email?: string
  password?: string
}

interface LoginResponse {
  id: string
  statusCode: number
  email: string
  role: 'admin' | 'staff'
  message: string
}

export default defineEventHandler(async (event): Promise<LoginResponse> => {
  // 1. Parse and sanitize the incoming JSON body
  const body = await readBody<LoginRequestBody>(event)
  const email = body?.email?.toLowerCase().trim()
  const password = body?.password

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required',
    })
  }

  // 2. Fetch the admin record from MongoDB Atlas
  const admin = await Admin.findOne({ email })

  // Use a generic error message to prevent email enumeration
  if (!admin || !admin.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  // 3. Verify password against the stored bcrypt hash
  const isMatch = await bcrypt.compare(password, admin.passwordHash)
  if (!isMatch) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password',
    })
  }

  // 4. Update the encrypted session cookie with admin profile data
  const session = await getAdminSession(event)
  await session.update({
    adminId: String(admin._id),
    email: admin.email,
    role: admin.role,
    authenticatedAt: Date.now(),
  })

  // 5. Return sanitized profile (never expose passwordHash)
  return {
    id: String(admin._id),
    email: admin.email,
    role: admin.role,
    statusCode: 200,
    message: 'Login successful',
  }
})