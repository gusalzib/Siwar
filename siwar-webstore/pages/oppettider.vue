<!-- pages/oppettider.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  DEFAULT_GENERAL_CONFIG,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_LABELS,
  formatWeeklySchedule,
  normalizeSchedule,
  calculateStoreStatus,
  getDayOfWeekFromDate,
  type IDaySchedule,
  type DayOfWeek,
} from '~/utils/schedule'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic general settings from public endpoint
const { data: storeInfo, pending } = await useFetch<any>('/api/settings', {
  lazy: true,
})

// Current store schedule normalized (Monday to Sunday)
const schedule = computed<IDaySchedule[]>(() => {
  if (storeInfo.value?.schedule && Array.isArray(storeInfo.value.schedule)) {
    return normalizeSchedule(storeInfo.value.schedule)
  }
  return DEFAULT_WEEKLY_SCHEDULE
})

// Formatted opening hours summary string for current locale
const formattedHoursSummary = computed(() => {
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  if (storeInfo.value?.openingHours?.[currentLang]) {
    return storeInfo.value.openingHours[currentLang]
  }
  return formatWeeklySchedule(schedule.value, currentLang)
})

// Store address & contact info
const storeAddress = computed(() => {
  const addr = storeInfo.value?.address || DEFAULT_GENERAL_CONFIG.address
  return {
    street: addr.street || 'Storgatan 12',
    postalCode: addr.postalCode || '302 43',
    city: addr.city || 'Halmstad',
    country: addr.country || 'Sverige',
  }
})

const storeContact = computed(() => {
  return {
    phone: storeInfo.value?.contact?.phone || DEFAULT_GENERAL_CONFIG.contact.phone,
    email: storeInfo.value?.contact?.email || DEFAULT_GENERAL_CONFIG.contact.email,
  }
})

// Google Maps directions search query link
const mapsUrl = computed(() => {
  const query = `${storeAddress.value.street}, ${storeAddress.value.postalCode} ${storeAddress.value.city}, ${storeAddress.value.country}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
})

// Live Time & Store Status (Hydration Safe - initialized on client mount)
const isMounted = ref(false)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  isMounted.value = true
  now.value = new Date()
  // Update time every 30 seconds for live status accuracy
  timer = setInterval(() => {
    now.value = new Date()
  }, 30000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// Live status computation
const storeLiveStatus = computed(() => {
  return calculateStoreStatus(schedule.value, now.value)
})

const currentDayKey = computed<DayOfWeek>(() => {
  return getDayOfWeekFromDate(now.value)
})

function getLocalizedDayName(day: DayOfWeek): string {
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  return DAY_LABELS[currentLang]?.[day] || DAY_LABELS.sv[day]
}

// SEO Meta
useSeoMeta({
  title: () => `${t('openingHoursPage.metaTitle')} | Siwar`,
  description: () => t('openingHoursPage.metaDesc'),
})
</script>

<template>
  <div class="min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
    
    <!-- Breadcrumbs -->
    <nav class="text-sm breadcrumbs mb-4 overflow-visible">
      <ul class="flex flex-wrap gap-2">
        <li>
          <NuxtLink
            :to="localePath('/')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-xs transition-all font-medium text-xs sm:text-sm"
          >
            <Icon name="lucide:home" class="size-4 shrink-0" />
            <span>{{ t('nav.home') }}</span>
          </NuxtLink>
        </li>
        <li>
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-xs font-bold text-xs sm:text-sm">
            <Icon name="lucide:clock" class="size-4 shrink-0" />
            <span>{{ t('openingHoursPage.breadcrumb') }}</span>
          </div>
        </li>
      </ul>
    </nav>

    <!-- Page Header Card (Clean DaisyUI Card matching the site's design system) -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-start gap-4">
          <div class="size-13 sm:size-14 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-700 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Icon name="lucide:clock" class="size-6 sm:size-7" />
          </div>
          <div class="space-y-1.5 min-w-0">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 text-brand-700 dark:text-brand-700 text-[11px] font-bold uppercase tracking-wider">
              <Icon name="lucide:store" class="size-3 shrink-0" />
              <span>{{ t('openingHoursPage.badge') }}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
              {{ t('openingHoursPage.title') }}
            </h1>
            <p class="text-xs sm:text-sm text-base-content/70 leading-relaxed max-w-2xl font-medium">
              {{ t('openingHoursPage.subtitle') }}
            </p>
          </div>
        </div>

        <!-- Real-Time Live Status Pill -->
        <div class="shrink-0 self-start md:self-center">
          <div
            class="px-4 py-3 rounded-2xl border-2 flex items-center gap-3 shadow-xs"
            :class="isMounted && storeLiveStatus.isOpenNow
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-100'
              : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200'"
          >
            <!-- Pulsing indicator dot -->
            <span class="relative flex size-3 shrink-0">
              <span
                v-if="isMounted && storeLiveStatus.isOpenNow"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              />
              <span
                class="relative inline-flex rounded-full size-3"
                :class="isMounted && storeLiveStatus.isOpenNow ? 'bg-emerald-500' : 'bg-rose-500'"
              />
            </span>

            <div class="flex flex-col text-xs leading-snug">
              <span class="font-black uppercase tracking-wider text-[11px]">
                {{ isMounted ? (storeLiveStatus.isOpenNow ? t('openingHoursPage.status.openNow') : t('openingHoursPage.status.closedNow')) : t('openingHoursPage.badge') }}
              </span>
              <span v-if="isMounted" class="font-medium opacity-80 text-[11px]">
                <template v-if="storeLiveStatus.isOpenNow">
                  {{ t('openingHoursPage.status.closesAt', { time: storeLiveStatus.targetTime }) }}
                </template>
                <template v-else-if="storeLiveStatus.detailMessageKey === 'opensAt'">
                  {{ t('openingHoursPage.status.opensAt', { time: storeLiveStatus.targetTime }) }}
                </template>
                <template v-else-if="storeLiveStatus.detailMessageKey === 'welcomeBack'">
                  {{ t('openingHoursPage.status.welcomeBack', { time: storeLiveStatus.targetTime }) }}
                </template>
                <template v-else-if="storeLiveStatus.detailMessageKey === 'opensNext' && storeLiveStatus.targetDay">
                  {{ t('openingHoursPage.status.opensNext', { day: getLocalizedDayName(storeLiveStatus.targetDay), time: storeLiveStatus.targetTime }) }}
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Grid: Schedule Table (Left/Center) + Visit Details & Map (Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- Column 1: Weekly Schedule Table (8 cols on lg) -->
      <div class="lg:col-span-7 space-y-6">
        <div class="card bg-base-100 border-2 border-base-200 dark:border-base-300 shadow-sm rounded-3xl overflow-hidden">
          <div class="p-5 sm:p-7 border-b border-base-200 dark:border-base-300 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Icon name="lucide:calendar-days" class="size-5" />
              </div>
              <div>
                <h2 class="text-lg sm:text-xl font-bold tracking-tight text-base-content">
                  {{ t('openingHoursPage.weeklySchedule.title') }}
                </h2>
                <p class="text-xs text-base-content/60 font-medium">
                  {{ t('openingHoursPage.weeklySchedule.description') }}
                </p>
              </div>
            </div>

            <span class="badge badge-sm badge-ghost font-mono text-[11px] font-bold shrink-0">
              Mån–Sön
            </span>
          </div>

          <!-- Schedule Day Rows -->
          <div class="divide-y divide-base-200 dark:divide-base-300/60">
            <div
              v-for="item in schedule"
              :key="item.day"
              class="p-4 sm:px-7 sm:py-4.5 flex items-center justify-between gap-3 transition-colors"
              :class="isMounted && currentDayKey === item.day ? 'bg-amber-500/10 dark:bg-amber-500/5 font-bold' : 'hover:bg-base-200/40'"
            >
              <!-- Day Name & Today Indicator -->
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="size-2 rounded-full shrink-0"
                  :class="isMounted && currentDayKey === item.day ? 'bg-amber-500 ring-4 ring-amber-500/20' : 'bg-base-300'"
                />
                <span class="text-sm sm:text-base text-base-content font-bold">
                  {{ getLocalizedDayName(item.day) }}
                </span>
                <span
                  v-if="isMounted && currentDayKey === item.day"
                  class="badge badge-xs bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider py-1 px-1.5"
                >
                  {{ t('openingHoursPage.status.today') }}
                </span>
              </div>

              <!-- Opening Hours / Closed Status -->
              <div class="flex items-center gap-2.5 shrink-0">
                <template v-if="item.isOpen">
                  <span class="font-mono text-xs sm:text-sm font-bold text-base-content bg-base-200/80 px-2.5 py-1 rounded-lg">
                    {{ item.openTime }} – {{ item.closeTime }}
                  </span>
                  <span class="badge badge-sm badge-success text-[10px] font-bold text-white hidden sm:inline-flex">
                    {{ t('openingHoursPage.weeklySchedule.openStatus') }}
                  </span>
                </template>
                <template v-else>
                  <span class="badge badge-sm badge-ghost text-xs text-base-content/50 font-bold px-2.5 py-1">
                    {{ t('openingHoursPage.weeklySchedule.closedStatus') }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Schedule Summary Callout -->
          <div class="p-4 sm:p-5 bg-base-200/50 border-t border-base-200 dark:border-base-300 flex items-start gap-3">
            <Icon name="lucide:info" class="size-4.5 text-primary shrink-0 mt-0.5" />
            <div class="text-xs leading-relaxed text-base-content/80">
              <span class="font-bold text-base-content block mb-0.5">
                {{ t('openingHoursPage.weeklySchedule.summaryLabel') }}
              </span>
              <p class="font-mono text-[11px] sm:text-xs">
                {{ formattedHoursSummary }}
              </p>
            </div>
          </div>
        </div>

        <!-- Swedish Public Holidays Alert -->
        <div class="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3.5">
          <Icon name="lucide:sparkles" class="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div class="space-y-1">
            <h3 class="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
              {{ t('openingHoursPage.holidayNotice.title') }}
            </h3>
            <p class="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed font-medium">
              {{ t('openingHoursPage.holidayNotice.text') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Column 2: Store Location, Directions & Contact (5 cols on lg) -->
      <div class="lg:col-span-5 space-y-6">
        
        <!-- Physical Location & Directions Card -->
        <div class="card bg-base-100 border-2 border-base-200 dark:border-base-300 shadow-sm rounded-3xl p-6 sm:p-7 space-y-5">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Icon name="lucide:map-pin" class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight text-base-content">
                {{ t('openingHoursPage.location.title') }}
              </h2>
              <p class="text-xs text-base-content/60 font-medium">
                {{ t('openingHoursPage.location.description') }}
              </p>
            </div>
          </div>

          <!-- Address box -->
          <div class="p-4 rounded-2xl bg-base-200/60 border border-base-200 space-y-2">
            <span class="text-[11px] uppercase tracking-wider font-bold text-base-content/60 block">
              {{ t('openingHoursPage.location.addressLabel') }}
            </span>
            <address class="not-italic text-sm font-bold text-base-content leading-relaxed">
              <span>{{ storeAddress.street }}</span><br />
              <span>{{ storeAddress.postalCode }} {{ storeAddress.city }}</span><br />
              <span class="text-xs font-normal text-base-content/70">{{ storeAddress.country }}</span>
            </address>
          </div>

          <!-- Open in Google Maps Button -->
          <a
            :href="mapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn bg-brand-500 hover:bg-brand-600 border-none !text-white w-full rounded-xl gap-2 font-bold shadow-xs text-xs sm:text-sm hover:brightness-105 transition-all"
          >
            <Icon name="lucide:navigation" class="size-4 !text-white shrink-0" />
            <span class="!text-white">{{ t('openingHoursPage.location.openInMaps') }}</span>
            <Icon name="lucide:external-link" class="size-3.5 !text-white/80 shrink-0" />
          </a>

          <!-- In-Store Pickup Callout -->
          <div class="pt-4 border-t border-base-200 dark:border-base-300 space-y-2">
            <div class="flex items-center gap-2 text-xs font-bold text-primary">
              <Icon name="lucide:package-check" class="size-4" />
              <span>{{ t('openingHoursPage.location.pickupTitle') }}</span>
            </div>
            <p class="text-xs text-base-content/70 leading-relaxed">
              {{ t('openingHoursPage.location.pickupDescription') }}
            </p>
          </div>
        </div>

        <!-- Customer Service & Contact Card -->
        <div class="card bg-base-100 border-2 border-base-200 dark:border-base-300 shadow-sm rounded-3xl p-6 sm:p-7 space-y-5">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Icon name="lucide:headphones" class="size-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight text-base-content">
                {{ t('openingHoursPage.contact.title') }}
              </h2>
              <p class="text-xs text-base-content/60 font-medium">
                {{ t('openingHoursPage.contact.description') }}
              </p>
            </div>
          </div>

          <div class="space-y-3">
            <!-- Telephone -->
            <a
              :href="`tel:${storeContact.phone}`"
              class="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 hover:bg-base-200 text-base-content transition-colors group"
            >
              <div class="flex items-center gap-3">
                <Icon name="lucide:phone" class="size-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                <span class="text-xs font-bold font-mono">{{ storeContact.phone }}</span>
              </div>
              <span class="text-[11px] font-semibold text-base-content/60">{{ t('openingHoursPage.contact.phoneLabel') }}</span>
            </a>

            <!-- Email -->
            <a
              :href="`mailto:${storeContact.email}`"
              class="flex items-center justify-between p-3.5 rounded-xl bg-base-200/50 hover:bg-base-200 text-base-content transition-colors group"
            >
              <div class="flex items-center gap-3">
                <Icon name="lucide:mail" class="size-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                <span class="text-xs font-bold font-mono">{{ storeContact.email }}</span>
              </div>
              <span class="text-[11px] font-semibold text-base-content/60">{{ t('openingHoursPage.contact.emailLabel') }}</span>
            </a>
          </div>

          <p class="text-[11px] text-base-content/50 leading-relaxed text-center font-medium">
            {{ t('openingHoursPage.contact.responseTime') }}
          </p>
        </div>

      </div>
    </div>

  </div>
</template>
