/**
 * server/utils/admin-session.ts
 *
 * Centralized session helper for admin authentication.
 * Nuxt 3 auto-imports utilities located in `server/utils/` across all Nitro handlers.
 */
import { type H3Event, useSession, createError } from 'h3'

export interface AdminSessionData {
  adminId: string
  email: string
  role: 'admin' | 'staff'
  authenticatedAt?: number
}

// H3/Nitro encrypted sessions require a secret password with at least 32 characters
const SESSION_SECRET =
  process.env.ADMIN_JWT_SECRET ||
  'siwar-store-admin-session-u_u1U-VHpV}y_{7Y[|7D9I@D4+uhjm4?nP&!RR@3=]n'

export const ADMIN_SESSION_CONFIG = {
  password: SESSION_SECRET,
  name: 'siwar_admin_session',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: '/',
  },
}

/**
 * Retrieves the current encrypted session instance for the incoming request.
 */
export function getAdminSession(event: H3Event) {
  return useSession<AdminSessionData>(event, ADMIN_SESSION_CONFIG)
}

/**
 * Guard utility for server routes that mandates an active admin session.
 * Throws HTTP 401 if unauthenticated.
 */
export async function requireAdminSession(event: H3Event): Promise<AdminSessionData> {
  const session = await getAdminSession(event)
  if (!session.data?.adminId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Admin session required',
    })
  }
  return session.data
}