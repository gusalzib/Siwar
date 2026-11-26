/**
 * middleware/admin.ts
 *
 * Nuxt 3 route middleware that protects administrative pages on both SSR
 * and client-side navigation. Unauthenticated visits are redirected to /admin/login.
 */

export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()
  // Allow unauthenticated access to login and password recovery screens
  const publicAdminRoutes = [
    '/admin/login',
    '/admin/forgot-password',
    '/admin/reset-password',
  ]
  if (publicAdminRoutes.some((route) => to.path.endsWith(route))) {
    return
  }

  try {
    // Forward incoming request cookies during SSR so Nitro can inspect the session
    const headers = (typeof useRequestHeaders === 'function' ? useRequestHeaders(['cookie']) : {}) as Record<string, string>

    // Use $fetch directly instead of useFetch inside middleware to prevent lifecycle issues
    const response = await $fetch<{
      statusCode: number
      authenticated?: boolean
      user?: {
        id: string
        email: string
        role: string
      } | null
    }>('/api/admin/auth/me', {
      headers,
    })

    if (!response || response.statusCode !== 200 || !response.authenticated) {
      return navigateTo(localePath('/admin/login'), { replace: true })
    }
  } catch {
    // On network failure or 401 Unauthorized, redirect to login
    return navigateTo(localePath('/admin/login'), { replace: true })
  }
})