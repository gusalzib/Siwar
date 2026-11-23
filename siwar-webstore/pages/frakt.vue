<!-- /pages/frakt.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic StoreSettings
const { data: settings } = await useAsyncData(
    'frakt-page-settings', 
    () => $fetch<any>('/api/settings'),
    {
        getCachedData: () => undefined 
    })

const storeName = computed(() => {
  const name = settings.value?.storeName
  if (!name) return 'Siwar'
  return typeof name === 'object' ? (name[locale.value] || name.sv || name.en || name.ar || 'Siwar') : name
})

const companyName = computed(() => settings.value?.company?.name || settings.value?.companyName || 'Siwar Butik AB')
const contactEmail = computed(() => settings.value?.contact?.email || settings.value?.contactEmail || 'order@siwar.se')
const contactPhone = computed(() => settings.value?.contact?.phone || settings.value?.contactPhone || '+46 729 228 251')

// Shipping settings
const shipping = computed(() => settings.value?.shipping || {})
const deliveryMin = computed(() => shipping.value?.deliveryDays?.min ?? 1)
const deliveryMax = computed(() => shipping.value?.deliveryDays?.max ?? 3)

const freeShippingThresholdSEK = computed(() => {
  const minor = shipping.value?.freeShippingThresholdMinorSEK ?? 89900
  return Math.round(minor / 100)
})

const campaignItemFreeShipping = computed(() => Boolean(shipping.value?.freeShippingItemGrantsEntireOrder))

const tiers = computed(() => {
  const rawTiers = shipping.value?.tiers || []
  return [...rawTiers].sort((a: any, b: any) => a.maxWeightGrams - b.maxWeightGrams)
})

// Pickup settings
const pickup = computed(() => settings.value?.pickup || {})
const pickupEnabled = computed(() => pickup.value?.enabled !== false)
const pickupStreet = computed(() => pickup.value?.address?.street || 'Åttingsstigen 41')
const pickupPostal = computed(() => pickup.value?.address?.postalCode || '302 54')
const pickupCity = computed(() => pickup.value?.address?.city || 'Halmstad')
const pickupAddress = computed(() => `${pickupStreet.value}, ${pickupPostal.value} ${pickupCity.value}`)

const pickupHours = computed(() => {
  const hours = pickup.value?.pickupHours
  if (!hours) return ''
  return typeof hours === 'object' ? (hours[locale.value] || hours.sv || hours.en || hours.ar || '') : hours
})

const pickupInstructions = computed(() => {
  const instr = pickup.value?.instructions
  if (!instr) return ''
  return typeof instr === 'object' ? (instr[locale.value] || instr.sv || instr.en || instr.ar || '') : instr
})

function formatWeight(grams: number): string {
  if (grams >= 10000000) return t('shippingPage.unlimitedWeight', '> 7 kg')
  if (grams >= 1000) {
    const kg = (grams / 1000).toLocaleString(locale.value, { maximumFractionDigits: 1 })
    return `${kg} kg`
  }
  return `${grams} g`
}

function calculateMoms25(feeMinor: number): string {
  const tax = Math.round((feeMinor * 25) / 125)
  return (tax / 100).toFixed(2)
}

useSeoMeta({
  title: () => `${t('shippingPage.metaTitle')} | ${storeName.value}`,
  description: () => t('shippingPage.metaDesc', { min: deliveryMin.value, max: deliveryMax.value }),
})
</script>

<template>
  <div class="min-h-screen bg-base-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Breadcrumbs -->
      <nav class="text-sm breadcrumbs mb-8 mt-2 overflow-visible">
        <ul class="!flex flex-col sm:!flex-row flex-wrap gap-2 w-full">
          <li class="w-full sm:w-auto">
            <NuxtLink
              :to="localePath('/')"
              class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium"
            >
              <Icon name="lucide:home" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('nav.home') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <NuxtLink
              :to="localePath('/villkor')"
              class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium"
            >
              <Icon name="lucide:file-text" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('legal.terms.title') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:truck" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('shippingPage.title') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Header -->
      <div class="border-b border-base-200 pb-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
          <Icon name="lucide:clock" class="size-3.5" />
          <span>{{ t('shippingPage.deliveryEstimateBadge', { min: deliveryMin, max: deliveryMax }) }}</span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight">
          {{ t('shippingPage.title') }}
        </h1>
        <p class="text-sm text-base-content/70 mt-2">
          {{ t('shippingPage.subtitle') }}
        </p>

        <!-- Customer Service Bar -->
        <div class="mt-4 inline-flex flex-wrap items-center gap-4 text-xs font-medium text-base-content/80 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2">
          <span class="font-bold text-base-content">{{ companyName }} ({{ storeName }})</span>
          <span class="hidden sm:inline text-base-content/30">•</span>
          <span class="flex items-center gap-1.5">
            <Icon name="lucide:mail" class="size-3.5 text-brand-600 dark:text-brand-400" />
            <a :href="`mailto:${contactEmail}`" class="hover:underline font-semibold">{{ contactEmail }}</a>
          </span>
          <span class="hidden sm:inline text-base-content/30">•</span>
          <span class="flex items-center gap-1.5">
            <Icon name="lucide:phone" class="size-3.5 text-brand-600 dark:text-brand-400" />
            <a :href="`tel:${contactPhone}`" class="hover:underline font-mono">{{ contactPhone }}</a>
          </span>
        </div>
      </div>

      <!-- Highlights Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
        <div class="card bg-base-100 border border-base-300 p-5 rounded-2xl shadow-xs space-y-2">
          <div class="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Icon name="lucide:clock" class="size-5" />
          </div>
          <h3 class="font-bold text-sm text-base-content">{{ t('shippingPage.transitTitle') }}</h3>
          <p class="text-xs text-base-content/70 leading-relaxed">
            {{ t('shippingPage.transitDesc', { min: deliveryMin, max: deliveryMax }) }}
          </p>
        </div>

        <div class="card bg-base-100 border border-base-300 p-5 rounded-2xl shadow-xs space-y-2">
          <div class="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Icon name="lucide:gift" class="size-5" />
          </div>
          <h3 class="font-bold text-sm text-base-content">{{ t('shippingPage.freeThresholdTitle') }}</h3>
          <p class="text-xs text-base-content/70 leading-relaxed">
            {{ t('shippingPage.freeThresholdDesc', { threshold: freeShippingThresholdSEK }) }}
          </p>
        </div>

        <div class="card bg-base-100 border border-base-300 p-5 rounded-2xl shadow-xs space-y-2">
          <div class="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Icon name="lucide:store" class="size-5" />
          </div>
          <h3 class="font-bold text-sm text-base-content">{{ t('shippingPage.pickupOptionTitle') }}</h3>
          <p class="text-xs text-base-content/70 leading-relaxed">
            {{ t('shippingPage.pickupOptionDesc') }}
          </p>
        </div>
      </div>

      <!-- Section: Weight-based Shipping Tiers Table -->
      <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div class="card-body p-6 space-y-4">
          <div class="border-b border-base-200 pb-3">
            <h2 class="text-base sm:text-lg font-extrabold text-base-content flex items-center gap-2">
              <Icon name="lucide:scale" class="size-5 text-primary" />
              {{ t('shippingPage.tableHeading') }}
            </h2>
            <p class="text-xs sm:text-sm text-base-content/60 mt-0.5">
              {{ t('shippingPage.tableSubheading') }}
            </p>
          </div>

          <div class="overflow-x-auto">
            <table class="table table-sm sm:table-md w-full">
              <thead>
                <tr class="text-xs font-bold uppercase tracking-wider text-base-content/70 border-b border-base-300">
                  <th class="w-12 text-center">#</th>
                  <th>{{ t('shippingPage.colWeight') }}</th>
                  <th>{{ t('shippingPage.colPrice') }}</th>
                  <th>{{ t('shippingPage.colVat') }}</th>
                  <th class="text-end">{{ t('shippingPage.colCondition') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tier, idx) in tiers"
                  :key="idx"
                  class="border-b border-base-200 hover:bg-base-200/40 transition-colors"
                >
                  <td class="text-center font-mono text-xs text-base-content/60">{{ idx + 1 }}</td>
                  <td class="font-semibold text-sm text-base-content">
                    {{ formatWeight(tier.maxWeightGrams) }}
                  </td>
                  <td class="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {{ (tier.feeMinorSEK / 100).toFixed(0) }} SEK
                  </td>
                  <td class="text-xs text-base-content/70 font-mono">
                    {{ calculateMoms25(tier.feeMinorSEK) }} SEK (25%)
                  </td>
                  <td class="text-end text-xs text-base-content/60">
                    {{ t('shippingPage.underThresholdCondition', { threshold: freeShippingThresholdSEK }) }}
                  </td>
                </tr>
                <!-- Free Shipping Row -->
                <tr class="bg-emerald-50/50 dark:bg-emerald-950/20 font-medium">
                  <td class="text-center font-mono text-xs text-emerald-600 font-bold">✓</td>
                  <td class="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                    {{ t('shippingPage.anyWeight') }}
                  </td>
                  <td class="font-mono font-black text-emerald-700 dark:text-emerald-400">
                    0 SEK
                  </td>
                  <td class="text-xs text-emerald-700 dark:text-emerald-400 font-mono">0.00 SEK</td>
                  <td class="text-end text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    ≥ {{ freeShippingThresholdSEK }} SEK
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Campaign Free Item Callout if Enabled -->
      <div
        v-if="campaignItemFreeShipping"
        class="rounded-2xl border-2 border-primary/40 bg-primary/5 dark:bg-primary/10 p-5 space-y-2 text-xs leading-relaxed"
      >
        <div class="flex items-center gap-2 font-bold text-primary text-sm">
          <Icon name="lucide:sparkles" class="size-4.5 shrink-0 text-amber-500" />
          <span>{{ t('shippingPage.campaignNoticeTitle') }}</span>
        </div>
        <p class="text-base-content/80">
          {{ t('shippingPage.campaignNoticeBody') }}
        </p>
      </div>

      <!-- In-Store Pickup Section -->
      <div v-if="pickupEnabled" class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div class="card-body p-6 space-y-4">
          <div class="border-b border-base-200 pb-3">
            <h2 class="text-base sm:text-lg font-extrabold text-base-content flex items-center gap-2">
              <Icon name="lucide:map-pin" class="size-5 text-primary" />
              {{ t('shippingPage.pickupSectionTitle') }}
            </h2>
            <p class="text-xs sm:text-sm text-base-content/60 mt-0.5">
              {{ t('shippingPage.pickupSectionSub') }}
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div class="p-3.5 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
              <span class="font-bold text-base-content/60 block">{{ t('shippingPage.pickupAddressLabel') }}</span>
              <p class="font-semibold text-sm text-base-content">{{ pickupAddress }}</p>
            </div>

            <div class="p-3.5 rounded-xl bg-base-200/50 border border-base-200 space-y-1">
              <span class="font-bold text-base-content/60 block">{{ t('shippingPage.pickupHoursLabel') }}</span>
              <p class="font-medium text-base-content/80 leading-normal">{{ pickupHours }}</p>
            </div>
          </div>

          <div v-if="pickupInstructions" class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <Icon name="lucide:info" class="size-4 shrink-0" />
              <span>{{ t('shippingPage.pickupInstructionsLabel') }}</span>
            </div>
            <p>{{ pickupInstructions }}</p>
          </div>
        </div>
      </div>

      <!-- Footer Navigation Links -->
      <div class="pt-6 border-t border-base-200 flex flex-wrap gap-4 items-center justify-between">
        <NuxtLink :to="localePath('/kassa')" class="btn btn-primary btn-sm text-white">
          <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
          {{ t('legal.backToCheckout') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/villkor')" class="btn btn-ghost btn-sm">
          {{ t('legal.readTerms') }}
          <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>