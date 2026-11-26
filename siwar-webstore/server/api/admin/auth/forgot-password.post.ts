/**
 * server/api/admin/auth/forgot-password.post.ts
 *
 * Initiates an administrator password reset flow.
 * Generates a cryptographically secure token, hashes it in MongoDB with a 30-minute expiration,
 * and emails the reset link via Resend while maintaining strict anti-enumeration guarantees.
 */
import crypto from 'node:crypto'
import { Admin } from '../../../models/Admin'
import { mailService } from '../../../services/mail.service'

interface ForgotPasswordBody {
  email?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ForgotPasswordBody>(event)
  const email = body?.email ? String(body.email).trim().toLowerCase() : ''

  // Validate format if provided
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid email address is required',
    })
  }

  try {
    const admin = await Admin.findOne({ email })

    if (admin) {
      // 1. Generate cryptographically secure raw token (32 bytes = 64 hex characters)
      const rawToken = crypto.randomBytes(32).toString('hex')

      // 2. Hash the token with SHA-256 before persisting to database
      const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes validity

      admin.resetTokenHash = resetTokenHash
      admin.resetTokenExpiresAt = resetTokenExpiresAt
      await admin.save()

      // 3. Resolve site base URL (from runtimeConfig or request headers with https://www.siwar.se fallback)
      const config = useRuntimeConfig()
      let baseUrl: string = (config?.public as Record<string, any>)?.siteUrl || process.env.SITE_URL || ''
      if (!baseUrl) {
        try {
          const reqUrl = getRequestURL(event)
          baseUrl = reqUrl.origin
        } catch {
          baseUrl = 'https://www.siwar.se'
        }
      }
      baseUrl = baseUrl.replace(/\/+$/, '')
      const resetUrl = `${baseUrl}/admin/reset-password?token=${rawToken}`

      // 4. Dispatch transactional email via Resend
      await mailService.sendAdminPasswordReset(admin.email, resetUrl)
    }
  } catch (err: any) {
    console.error('Error during admin forgot-password processing:', err)
  }

  // Anti-enumeration guarantee: always return 200 with identical confirmation text
  return {
    statusCode: 200,
    message: 'If an administrator account exists for this email, a password reset link has been sent.',
  }
})

