/**
 * server/api/admin/auth/logout.post.ts
 *
 * Terminates the active administrator session and wipes the HTTP-only cookie.
 */
import { getAdminSession } from '../../../../utils/admin-session'

interface LogoutResponse {
  statusCode: number
  message: string
}

export default defineEventHandler(async (event): Promise<LogoutResponse> => {
  // 1. Retrieve the existing session instance
  const session = await getAdminSession(event)

  // 2. Clear all encrypted data and instruct the browser to discard the cookie
  await session.clear()

  // 3. Set explicit HTTP 200 status header
  setResponseStatus(event, 200)

  return {
    statusCode: 200,
    message: 'Logged out successfully',
  }
})