/**
 * middleware/admin.ts
 *
 * Nuxt 3 route middleware that protects administrative pages on both SSR
 * and client-side navigation. Unauthenticated visits are redirected to /admin/login.
 */

import { defineNuxtRouteMiddleware, navigateTo, useRequestHeaders } from '#app'

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow unauthenticated access to the login screen itself
  if (to.path === '/admin/login') {
    return
  }

  try {
    // Forward incoming request cookies during SSR so Nitro can inspect the session
    const headers = useRequestHeaders(['cookie']) as Record<string, string>

    // Use $fetch directly instead of useFetch inside middleware to prevent lifecycle issues
    const response = await $fetch<{
      statusCode: number
      id: string
      email: string
      role: string
    }>('/api/admin/auth/me', {
      headers,
    })

    if (!response || response.statusCode !== 200) {
      return navigateTo('/admin/login', { replace: true })
    }
  } catch {
    // On network failure or 401 Unauthorized, redirect to login
    return navigateTo('/admin/login', { replace: true })
  }
})