/**
 * server/api/admin/auth/me.get.ts
 *
 * Validates the caller's session cookie and returns the authenticated
 * administrator's identity profile. Throws HTTP 401 if unauthenticated.
 */
import { getAdminSession } from '../../../../utils/admin-session'

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event)

  // If no active admin session, return clean 200 with authenticated: false
  if (!session.data?.adminId) {
    return {
      statusCode: 200,
      authenticated: false,
      user: null,
    }
  }

  return {
    statusCode: 200,
    authenticated: true,
    user: {
      id: session.data.adminId,
      email: session.data.email,
      role: session.data.role,
      authenticatedAt: session.data.authenticatedAt,
    },
  }
})