<!-- /pages/order/lookup.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const { t } = useI18n()
const localePath = useLocalePath()

const orderNumber = ref('')
const email = ref('')
const hasSearched = ref(false)

useSeoMeta({
  title: () => `${t('orderLookup.title', 'Spåra din beställning')} | Siwar`,
  description: () => t('orderLookup.subtitle', 'Sök och spåra din orderstatus hos Siwar.'),
})

function handleSearch() {
  if (!orderNumber.value.trim() || !email.value.trim()) return
  hasSearched.value = true
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
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:search" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('orderLookup.title', 'Spåra beställning') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Main Card -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-md rounded-3xl p-6 sm:p-10 space-y-6">
        <div class="text-center space-y-2">
          <div class="size-14 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 mx-auto flex items-center justify-center shadow-xs">
            <Icon name="lucide:package-search" class="size-7" />
          </div>
          <h1 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
            {{ t('orderLookup.title', 'Spåra din beställning') }}
          </h1>
          <p class="text-sm text-base-content/70 max-w-md mx-auto">
            {{ t('orderLookup.subtitle', 'Ange ditt ordernummer och den e-postadress du använde vid köpet för att se aktuell orderstatus.') }}
          </p>
        </div>

        <form @submit.prevent="handleSearch" class="space-y-4">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">{{ t('orderLookup.orderNumberLabel', 'Ordernummer') }} *</span>
            </label>
            <div class="relative">
              <input
                v-model="orderNumber"
                type="text"
                required
                class="input input-bordered ps-9 h-11 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-sm font-mono font-bold w-full"
                :placeholder="t('orderLookup.orderNumberPlaceholder', 't.ex. SIW-1049')"
              />
              <Icon name="lucide:hash" class="absolute start-3 top-3.5 size-4 text-base-content/50" />
            </div>
          </div>

          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">{{ t('orderLookup.emailLabel', 'E-postadress') }} *</span>
            </label>
            <div class="relative">
              <input
                v-model="email"
                type="email"
                required
                class="input input-bordered ps-9 h-11 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-sm font-semibold w-full"
                :placeholder="t('orderLookup.emailPlaceholder', 'din.epost@exempel.se')"
              />
              <Icon name="lucide:mail" class="absolute start-3 top-3.5 size-4 text-base-content/50" />
            </div>
          </div>

          <button
            type="submit"
            class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold w-full rounded-xl h-11 border-none shadow-sm gap-2"
          >
            <Icon name="lucide:search" class="size-4" />
            <span>{{ t('orderLookup.submitButton', 'Sök order') }}</span>
          </button>
        </form>

        <!-- Under Construction Callout -->
        <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-2">
          <div class="flex items-center gap-2 font-bold text-xs">
            <Icon name="lucide:info" class="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{{ t('orderLookup.noticeTitle', 'Fullständig självbetjäning lanseras inom kort') }}</span>
          </div>
          <p class="text-xs leading-relaxed opacity-90">
            {{ t('orderLookup.noticeText', 'Vår digitala orderspårning är under implementering. Har du frågor om en lagd order? Kontakta vår kundtjänst på order@siwar.se så hjälper vi dig omedelbart.') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
