/**
 * server/api/admin/auth/reset-password.post.ts
 *
 * Validates a password reset token and updates the administrator's passwordHash.
 * Invalidates the reset token immediately upon successful password change.
 */
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { Admin } from '../../../models/Admin'

interface ResetPasswordBody {
  token?: string
  newPassword?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ResetPasswordBody>(event)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Reset token is required',
    })
  }

  if (!newPassword || newPassword.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters long',
    })
  }

  // 1. Hash the incoming raw token to compare against stored resetTokenHash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  // 2. Query for admin with matching unexpired token
  const admin = await Admin.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpiresAt')

  if (!admin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired password reset token',
    })
  }

  // 3. Hash the new password with bcrypt (12 salt rounds)
  const passwordHash = await bcrypt.hash(newPassword, 12)

  // 4. Update password and invalidate token
  admin.passwordHash = passwordHash
  admin.resetTokenHash = undefined
  admin.resetTokenExpiresAt = undefined
  await admin.save()

  return {
    statusCode: 200,
    message: 'Password has been reset successfully',
  }
})

