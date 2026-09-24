/**
 * server/middleware/admin-auth.ts
 *
 * Global Nitro server middleware that intercepts incoming API traffic.
 * Protects all routes under `/api/admin/*` except public authentication entry points.
 */
import { getAdminSession } from '../../utils/admin-session'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 1. Target only administrative API routes
  const isAdminApiRoute = pathname.startsWith('/api/admin')

  // 2. Whitelist unauthenticated auth entry points (such as the login endpoint)
  const isPublicAuthRoute = pathname.startsWith('/api/admin/auth/login')

  if (isAdminApiRoute && !isPublicAuthRoute) {
    // 3. Inspect the session cookie
    const session = await getAdminSession(event)

    if (!session.data?.adminId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Admin session required',
      })
    }
  }
})