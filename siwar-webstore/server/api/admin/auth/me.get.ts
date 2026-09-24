/**
 * server/api/admin/auth/me.get.ts
 *
 * Validates the caller's session cookie and returns the authenticated
 * administrator's identity profile. Throws HTTP 401 if unauthenticated.
 */
import { requireAdminSession } from '../../../../utils/admin-session'

interface AdminProfileResponse {
  statusCode: number
  id: string
  email: string
  role: 'admin' | 'staff'
  authenticatedAt?: number
}

export default defineEventHandler(async (event): Promise<AdminProfileResponse> => {
  // 1. Guard check: extracts session or throws 401 Unauthorized
  const sessionData = await requireAdminSession(event)

  // 2. Set explicit HTTP 200 status header
  setResponseStatus(event, 200)

  // 3. Return sanitized profile data
  return {
    statusCode: 200,
    id: sessionData.adminId,
    email: sessionData.email,
    role: sessionData.role,
    authenticatedAt: sessionData.authenticatedAt,
  }
})