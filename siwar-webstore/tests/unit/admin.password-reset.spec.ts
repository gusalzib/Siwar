import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// 1. Load localization files
const svLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/sv.json'), 'utf-8')
)
const enLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8')
)
const arLocale = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8')
)

describe('Task 7: Admin Password Reset Flow', () => {
  const adminModelPath = path.resolve(__dirname, '../../server/models/Admin.ts')
  const middlewarePath = path.resolve(__dirname, '../../middleware/admin.ts')
  const forgotPasswordApiPath = path.resolve(
    __dirname,
    '../../server/api/admin/auth/forgot-password.post.ts'
  )
  const resetPasswordApiPath = path.resolve(
    __dirname,
    '../../server/api/admin/auth/reset-password.post.ts'
  )
  const loginPagePath = path.resolve(__dirname, '../../pages/admin/login.vue')
  const forgotPasswordPagePath = path.resolve(__dirname, '../../pages/admin/forgot-password.vue')
  const resetPasswordPagePath = path.resolve(__dirname, '../../pages/admin/reset-password.vue')
  const mailServicePath = path.resolve(__dirname, '../../server/services/mail.service.ts')

  describe('1. Admin Model Schema Extension (server/models/Admin.ts)', () => {
    it('defines resetTokenHash and resetTokenExpiresAt with select: false in AdminSchema', () => {
      const content = fs.readFileSync(adminModelPath, 'utf-8')

      expect(content).toContain('resetTokenHash?: string')
      expect(content).toContain('resetTokenExpiresAt?: Date')
      expect(content).toContain('resetTokenHash: {')
      expect(content).toContain('select: false')
      expect(content).toContain('resetTokenExpiresAt: {')
      expect(content).toContain('mongoose.models.Admin')
      expect(content).toContain("model<IAdmin>('Admin', AdminSchema)")
    })
  })

  describe('2. Client/SSR Route Guard Whitelist (middleware/admin.ts)', () => {
    it('allows unauthenticated access to /admin/login, /admin/forgot-password, and /admin/reset-password', () => {
      const content = fs.readFileSync(middlewarePath, 'utf-8')

      expect(content).toContain("'/admin/login'")
      expect(content).toContain("'/admin/forgot-password'")
      expect(content).toContain("'/admin/reset-password'")
      expect(content).toContain('publicAdminRoutes.some')
    })
  })

  describe('3. Forgot Password API (server/api/admin/auth/forgot-password.post.ts)', () => {
    const apiContent = fs.readFileSync(forgotPasswordApiPath, 'utf-8')

    it('enforces anti-enumeration by returning 200 message on execution', () => {
      expect(apiContent).toContain('statusCode: 200')
      expect(apiContent).toContain(
        'If an administrator account exists for this email, a password reset link has been sent.'
      )
    })

    it('generates a 32-byte random hex token and hashes with sha256', () => {
      expect(apiContent).toContain("crypto.randomBytes(32).toString('hex')")
      expect(apiContent).toContain("crypto.createHash('sha256')")
      expect(apiContent).toContain('.digest(\'hex\')')
    })

    it('sets a 30-minute token expiration timestamp', () => {
      expect(apiContent).toContain('30 * 60 * 1000')
    })

    it('constructs reset URL and dispatches transactional email via mailService', () => {
      expect(apiContent).toContain('/admin/reset-password?token=')
      expect(apiContent).toContain('mailService.sendAdminPasswordReset')
    })
  })

  describe('4. Reset Password API (server/api/admin/auth/reset-password.post.ts)', () => {
    const apiContent = fs.readFileSync(resetPasswordApiPath, 'utf-8')

    it('validates token and minimum password length (at least 8 chars)', () => {
      expect(apiContent).toContain('!token')
      expect(apiContent).toContain('newPassword.length < 8')
      expect(apiContent).toContain('Password must be at least 8 characters long')
    })

    it('hashes the incoming raw token and queries unexpired token hash', () => {
      expect(apiContent).toContain("crypto.createHash('sha256').update(token).digest('hex')")
      expect(apiContent).toContain('resetTokenExpiresAt: { $gt: new Date() }')
      expect(apiContent).toContain("select('+resetTokenHash +resetTokenExpiresAt')")
    })

    it('hashes new password with bcrypt (12 rounds) and invalidates reset token', () => {
      expect(apiContent).toContain('bcrypt.hash(newPassword, 12)')
      expect(apiContent).toContain('admin.resetTokenHash = undefined')
      expect(apiContent).toContain('admin.resetTokenExpiresAt = undefined')
      expect(apiContent).toContain('await admin.save()')
      expect(apiContent).toContain('Password has been reset successfully')
    })
  })

  describe('5. Resend Mail Service (server/services/mail.service.ts)', () => {
    it('defines sendAdminPasswordReset with expiration notice and transactional HTML', () => {
      const content = fs.readFileSync(mailServicePath, 'utf-8')

      expect(content).toContain('sendAdminPasswordReset(to: string, resetUrl: string)')
      expect(content).toContain('30 minuter')
      expect(content).toContain('Reset Password')
    })
  })

  describe('6. Frontend UI Pages & Components', () => {
    it('pages/admin/login.vue includes a link to forgot-password', () => {
      const loginContent = fs.readFileSync(loginPagePath, 'utf-8')

      expect(loginContent).toContain("localePath('/admin/forgot-password')")
      expect(loginContent).toContain("t('admin.login.forgotPassword')")
    })

    it('pages/admin/forgot-password.vue implements layout: false, email form, and back to login', () => {
      const content = fs.readFileSync(forgotPasswordPagePath, 'utf-8')

      expect(content).toContain('layout: false')
      expect(content).toContain('/api/admin/auth/forgot-password')
      expect(content).toContain("t('admin.passwordReset.forgotTitle')")
      expect(content).toContain("t('admin.passwordReset.sentSuccess')")
      expect(content).toContain("localePath('/admin/login')")
    })

    it('pages/admin/reset-password.vue extracts query token, validates matching passwords, and posts to reset-password', () => {
      const content = fs.readFileSync(resetPasswordPagePath, 'utf-8')

      expect(content).toContain('layout: false')
      expect(content).toContain('route.query.token')
      expect(content).toContain('/api/admin/auth/reset-password')
      expect(content).toContain("t('admin.passwordReset.passwordMismatch')")
      expect(content).toContain("t('admin.passwordReset.passwordTooShort')")
      expect(content).toContain("t('admin.passwordReset.invalidOrExpiredToken')")
      expect(content).toContain("t('admin.passwordReset.resetSuccess')")
    })
  })

  describe('7. Multilingual Localization Parity (sv, en, ar)', () => {
    const requiredPasswordResetKeys = [
      'forgotTitle',
      'forgotSubtitle',
      'emailLabel',
      'emailPlaceholder',
      'sendLink',
      'sending',
      'sentSuccess',
      'backToLogin',
      'resetTitle',
      'resetSubtitle',
      'newPasswordLabel',
      'confirmPasswordLabel',
      'passwordMismatch',
      'passwordTooShort',
      'resetSubmit',
      'resetting',
      'resetSuccess',
      'invalidOrExpiredToken',
      'requestNewLink',
    ]

    it('verifies admin.login.forgotPassword exists across all 3 languages', () => {
      expect(svLocale.admin.login.forgotPassword).toBe('Glömt lösenord?')
      expect(enLocale.admin.login.forgotPassword).toBe('Forgot password?')
      expect(arLocale.admin.login.forgotPassword).toBe('نسيت كلمة المرور؟')
    })

    it('verifies all admin.passwordReset.* keys exist and are non-empty in Swedish', () => {
      for (const key of requiredPasswordResetKeys) {
        expect(svLocale.admin.passwordReset[key], `Missing sv key: admin.passwordReset.${key}`).toBeTruthy()
      }
    })

    it('verifies all admin.passwordReset.* keys exist and are non-empty in English', () => {
      for (const key of requiredPasswordResetKeys) {
        expect(enLocale.admin.passwordReset[key], `Missing en key: admin.passwordReset.${key}`).toBeTruthy()
      }
    })

    it('verifies all admin.passwordReset.* keys exist and are non-empty in Arabic', () => {
      for (const key of requiredPasswordResetKeys) {
        expect(arLocale.admin.passwordReset[key], `Missing ar key: admin.passwordReset.${key}`).toBeTruthy()
      }
    })
  })

  describe('8. Cryptographic Token Hashing Verification', () => {
    it('generates independent unique raw tokens and matching sha256 digests', () => {
      const rawToken1 = crypto.randomBytes(32).toString('hex')
      const rawToken2 = crypto.randomBytes(32).toString('hex')

      expect(rawToken1).not.toBe(rawToken2)
      expect(rawToken1.length).toBe(64)

      const hash1 = crypto.createHash('sha256').update(rawToken1).digest('hex')
      const hash2 = crypto.createHash('sha256').update(rawToken1).digest('hex')
      const hash3 = crypto.createHash('sha256').update(rawToken2).digest('hex')

      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash1.length).toBe(64)
    })
  })
})

