<!-- pages/admin/reset-password.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const token = computed(() => {
  const q = route.query.token
  return typeof q === 'string' ? q.trim() : ''
})

const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

async function handleResetPassword() {
  errorMessage.value = ''

  if (!newPassword.value || newPassword.value.length < 8) {
    errorMessage.value = t('admin.passwordReset.passwordTooShort')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = t('admin.passwordReset.passwordMismatch')
    return
  }

  isLoading.value = true

  try {
    await $fetch('/api/admin/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        newPassword: newPassword.value,
      },
    })

    isSuccess.value = true

    // Gracefully navigate to login page after 2.5 seconds
    setTimeout(async () => {
      await navigateTo(localePath('/admin/login'))
    }, 2500)
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.passwordReset.invalidOrExpiredToken')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12">
    <div class="w-full max-w-md rounded-2xl bg-base-100 p-8 shadow-xl border border-base-300">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-base-content">
          {{ t('admin.passwordReset.resetTitle') }}
        </h1>
        <p class="mt-2 text-sm text-base-content/70">
          {{ t('admin.passwordReset.resetSubtitle') }}
        </p>
      </div>

      <!-- Missing Token Alert -->
      <div
        v-if="!token"
        class="rounded-lg bg-warning/10 p-5 border border-warning/20 text-sm text-warning-content space-y-4"
        role="alert"
      >
        <div class="flex items-start gap-3">
          <Icon name="lucide:alert-triangle" class="size-5 shrink-0 text-warning mt-0.5" />
          <p class="text-base-content/80 leading-relaxed">
            {{ t('admin.passwordReset.invalidOrExpiredToken') }}
          </p>
        </div>
        <div>
          <NuxtLink
            :to="localePath('/admin/forgot-password')"
            class="btn btn-sm btn-primary w-full gap-2"
          >
            <span>{{ t('admin.passwordReset.requestNewLink') }}</span>
            <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
          </NuxtLink>
        </div>
      </div>

      <!-- Success Alert Banner -->
      <div
        v-else-if="isSuccess"
        class="rounded-lg bg-success/10 p-5 border border-success/20 text-sm text-success space-y-4"
        role="alert"
      >
        <div class="flex items-start gap-3">
          <Icon name="lucide:check-circle-2" class="size-5 shrink-0 mt-0.5" />
          <p class="leading-relaxed font-medium">
            {{ t('admin.passwordReset.resetSuccess') }}
          </p>
        </div>
        <div>
          <NuxtLink
            :to="localePath('/admin/login')"
            class="btn btn-sm btn-primary w-full gap-2"
          >
            <span>{{ t('admin.passwordReset.backToLogin') }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Reset Password Form -->
      <template v-else>
        <!-- Error Alert -->
        <div
          v-if="errorMessage"
          class="mb-6 rounded-lg bg-error/10 p-4 border border-error/20 text-sm text-error"
          role="alert"
        >
          <div class="flex items-center gap-2">
            <Icon name="lucide:alert-circle" class="size-5 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
        </div>

        <form @submit.prevent="handleResetPassword" class="space-y-5">
          <!-- New Password -->
          <div>
            <label for="newPassword" class="block text-sm font-medium text-base-content/80">
              {{ t('admin.passwordReset.newPasswordLabel') }}
            </label>
            <div class="relative mt-1">
              <input
                id="newPassword"
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="8"
                :placeholder="t('admin.login.passwordPlaceholder')"
                class="block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 pr-10 text-base-content placeholder-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <button
                type="button"
                @click="showNewPassword = !showNewPassword"
                :aria-label="t('admin.login.togglePassword')"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-base-content/50 hover:text-base-content focus:outline-none"
                tabindex="-1"
              >
                <Icon
                  :name="showNewPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="size-5"
                />
              </button>
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-base-content/80">
              {{ t('admin.passwordReset.confirmPasswordLabel') }}
            </label>
            <div class="relative mt-1">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                minlength="8"
                :placeholder="t('admin.login.passwordPlaceholder')"
                class="block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 pr-10 text-base-content placeholder-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                :aria-label="t('admin.login.togglePassword')"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-base-content/50 hover:text-base-content focus:outline-none"
                tabindex="-1"
              >
                <Icon
                  :name="showConfirmPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="size-5"
                />
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-content shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 size-4 animate-spin"
            />
            <span>{{ isLoading ? t('admin.passwordReset.resetting') : t('admin.passwordReset.resetSubmit') }}</span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <NuxtLink
            :to="localePath('/admin/login')"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/70 hover:text-primary transition"
          >
            <Icon name="lucide:arrow-left" class="size-3.5 rtl:rotate-180" />
            <span>{{ t('admin.passwordReset.backToLogin') }}</span>
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>

