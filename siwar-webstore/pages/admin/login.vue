<!-- pages/admin/login.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: false,
})

const { t } = useI18n()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

// Check if an active session already exists; if so, navigate to admin catalog
onMounted(async () => {
  try {
    const session = await $fetch<{ statusCode: number }>('/api/admin/auth/me')
    if (session?.statusCode === 200) {
      await navigateTo('/admin/products')
    }
  } catch {
    // Unauthenticated: remain on the login form
  }
})

async function handleLogin() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await $fetch('/api/admin/auth/login', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        password: password.value,
      },
    })

    await navigateTo('/admin/products')
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.login.invalidCredentials')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">
          {{ t('admin.login.title') }}
        </h1>
        <p class="mt-2 text-sm text-slate-500">
          {{ t('admin.login.subtitle') }}
        </p>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700"
        role="alert"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label for="email" class="block text-sm font-medium text-slate-700">
            {{ t('admin.login.emailLabel') }}
          </label>
          <div class="mt-1">
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              :placeholder="t('admin.login.emailPlaceholder')"
              class="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-slate-700">
            {{ t('admin.login.passwordLabel') }}
          </label>
          <div class="relative mt-1">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :placeholder="t('admin.login.passwordPlaceholder')"
              class="block w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              :aria-label="t('admin.login.togglePassword')"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabindex="-1"
            >
              <!-- Eye open -->
              <svg v-if="!showPassword" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <!-- Eye closed -->
              <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-400"
        >
          <svg
            v-if="isLoading"
            class="mr-2 h-4 w-4 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ isLoading ? t('admin.login.submitting') : t('admin.login.submit') }}</span>
        </button>
      </form>
    </div>
  </div>
</template>