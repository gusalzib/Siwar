<!-- pages/admin/forgot-password.vue -->
<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()

const email = ref('')
const isLoading = ref(false)
const isSuccess = ref(false)
const errorMessage = ref('')

async function handleForgotPassword() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await $fetch('/api/admin/auth/forgot-password', {
      method: 'POST',
      body: {
        email: email.value.trim(),
      },
    })

    isSuccess.value = true
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
          {{ t('admin.passwordReset.forgotTitle') }}
        </h1>
        <p class="mt-2 text-sm text-base-content/70">
          {{ t('admin.passwordReset.forgotSubtitle') }}
        </p>
      </div>

      <!-- Success Alert Banner -->
      <div
        v-if="isSuccess"
        class="mb-6 rounded-lg bg-success/10 p-5 border border-success/20 text-sm text-success space-y-4"
        role="alert"
      >
        <div class="flex items-start gap-3">
          <Icon name="lucide:check-circle-2" class="size-5 shrink-0 mt-0.5" />
          <p class="leading-relaxed">
            {{ t('admin.passwordReset.sentSuccess') }}
          </p>
        </div>
        <div>
          <NuxtLink
            :to="localePath('/admin/login')"
            class="btn btn-sm btn-outline btn-success w-full gap-2"
          >
            <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
            <span>{{ t('admin.passwordReset.backToLogin') }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Form (when not yet sent) -->
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

        <form @submit.prevent="handleForgotPassword" class="space-y-5">
          <div>
            <label for="email" class="block text-sm font-medium text-base-content/80">
              {{ t('admin.passwordReset.emailLabel') }}
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
                :placeholder="t('admin.passwordReset.emailPlaceholder')"
                class="block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 text-base-content placeholder-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              />
            </div>
          </div>

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
            <span>{{ isLoading ? t('admin.passwordReset.sending') : t('admin.passwordReset.sendLink') }}</span>
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

