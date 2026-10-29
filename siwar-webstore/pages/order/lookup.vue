<!-- /pages/order/lookup.vue -->
<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  alias: ['/spara-order', '/track-order'],
})

const { t } = useI18n()
const localePath = useLocalePath()

const orderReference = ref('')
const emailOrPhone = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const isRateLimited = ref(false)

useSeoMeta({
  title: () => `${t('orderLookup.title', 'Spåra din beställning')} | Siwar`,
  description: () => t('orderLookup.subtitle', 'Sök och spåra din orderstatus hos Siwar.'),
})

async function handleSearch() {
  errorMessage.value = ''
  isRateLimited.value = false

  const refVal = orderReference.value.trim()
  const credVal = emailOrPhone.value.trim()

  if (!refVal || !credVal) {
    errorMessage.value = t('orderLookup.errorMissingFields', 'Vänligen fyll i både ordernummer och e-post eller mobilnummer.')
    return
  }

  isLoading.value = true

  try {
    const res = await $fetch<{
      success: boolean
      id: string
      orderId: string
      orderReference: string
    }>('/api/orders/lookup', {
      method: 'POST',
      body: {
        orderReference: refVal,
        emailOrPhone: credVal,
      },
    })

    if (res?.success && (res.id || res.orderReference)) {
      // AC-1 & AC-2: Redirect immediately to the order receipt and live status timeline
      await navigateTo(localePath(`/order/confirmation/${res.id || res.orderReference}`))
    } else {
      errorMessage.value = t('orderLookup.errorGeneric', 'Ordern kunde inte hittas med angivna uppgifter.')
    }
  } catch (err: any) {
    const status = err?.statusCode || err?.response?.status || err?.status
    if (status === 429) {
      isRateLimited.value = true
      errorMessage.value =
        err?.data?.statusMessage ||
        t('orderLookup.errorRateLimit', 'För många förfrågningar. Vänligen vänta en stund innan du försöker igen.')
    } else {
      // AC-3: Anti-enumeration generic 404 error
      errorMessage.value = t('orderLookup.errorGeneric', 'Ordern kunde inte hittas med angivna uppgifter.')
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto space-y-8">
      <!-- Breadcrumbs -->
      <nav class="text-sm breadcrumbs mb-8 mt-2 overflow-visible">
        <ul class="!flex flex-col sm:!flex-row flex-wrap gap-2 w-full">
          <li class="w-full sm:w-auto">
            <NuxtLink
              :to="localePath('/')"
              class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium"
            >
              <Icon name="lucide:home" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('nav.home', 'Hem') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded-lg border border-brand-500/20 shadow-sm font-bold">
              <Icon name="lucide:package-search" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('orderLookup.title', 'Spåra beställning') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Main Portal Card -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-md rounded-3xl p-6 sm:p-10 space-y-6">
        <div class="text-center space-y-2">
          <div class="size-16 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 mx-auto flex items-center justify-center shadow-xs">
            <Icon name="lucide:package-search" class="size-8" />
          </div>
          <h1 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
            {{ t('orderLookup.title', 'Spåra din beställning') }}
          </h1>
          <p class="text-sm text-base-content/70 max-w-md mx-auto leading-relaxed">
            {{ t('orderLookup.subtitle', 'Ange ditt ordernummer och den e-postadress eller det mobilnummer du använde vid köpet för att se aktuell orderstatus.') }}
          </p>
        </div>

        <!-- Error Notification Banner -->
        <div
          v-if="errorMessage"
          class="alert alert-error text-white shadow-md rounded-2xl flex items-start gap-3 transition-all"
          :class="{ 'border-2 border-amber-300': isRateLimited }"
        >
          <Icon
            :name="isRateLimited ? 'lucide:hourglass' : 'lucide:alert-circle'"
            class="size-5 shrink-0 mt-0.5 text-white"
          />
          <div class="text-sm font-medium leading-relaxed">
            <span>{{ errorMessage }}</span>
          </div>
        </div>

        <form @submit.prevent="handleSearch" class="space-y-4">
          <!-- Order Reference Input -->
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-xs text-base-content">{{ t('orderLookup.orderNumberLabel', 'Ordernummer') }} *</span>
            </label>
            <div class="relative">
              <input
                v-model="orderReference"
                type="text"
                required
                autocomplete="off"
                autocapitalize="characters"
                :disabled="isLoading"
                class="input input-bordered ps-9 h-11 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-sm font-mono font-bold w-full focus:border-brand-500 focus:outline-none"
                :placeholder="t('orderLookup.orderNumberPlaceholder', 't.ex. ORD-566294')"
              />
              <Icon name="lucide:hash" class="absolute start-3 top-3.5 size-4 text-base-content/50" />
            </div>
          </div>

          <!-- Email or Phone Input -->
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-xs text-base-content">{{ t('orderLookup.emailOrPhoneLabel', 'E-postadress eller mobilnummer') }} *</span>
            </label>
            <div class="relative">
              <input
                v-model="emailOrPhone"
                type="text"
                required
                autocomplete="email tel"
                :disabled="isLoading"
                class="input input-bordered ps-9 h-11 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-sm font-semibold w-full focus:border-brand-500 focus:outline-none"
                :placeholder="t('orderLookup.emailOrPhonePlaceholder', 'din.epost@exempel.se eller 0701234567')"
              />
              <Icon name="lucide:user-check" class="absolute start-3 top-3.5 size-4 text-base-content/50" />
            </div>
          </div>

          <!-- Submit CTA Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="btn bg-brand-600 hover:bg-brand-700 text-white font-bold w-full rounded-xl h-11 border-none shadow-sm gap-2 transition-all disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:text-slate-500 cursor-pointer"
          >
            <span v-if="isLoading" class="loading loading-spinner loading-sm text-white"></span>
            <Icon v-else name="lucide:search" class="size-4" />
            <span>{{ isLoading ? t('orderLookup.searching', 'Söker order...') : t('orderLookup.submitButton', 'Spåra order') }}</span>
          </button>
        </form>

        <!-- Informative Customer Service Callout -->
        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 text-base-content/80 space-y-2">
          <div class="flex items-center gap-2 font-bold text-xs text-base-content">
            <Icon name="lucide:headphones" class="size-4 text-brand-600 dark:text-brand-400 shrink-0" />
            <span>{{ t('orderLookup.noticeTitle', 'Hjälp med din beställning') }}</span>
          </div>
          <p class="text-xs leading-relaxed text-base-content/70">
            {{ t('orderLookup.noticeText', 'Har du frågor om din order eller hittar du inte din bekräftelse? Kontakta vår kundtjänst på order@siwar.se så hjälper vi dig gärna.') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
