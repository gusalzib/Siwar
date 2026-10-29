<!-- components/admin/settings/GeneralSettingsManager.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  type IDaySchedule,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_LABELS,
  formatWeeklySchedule,
  normalizeSchedule,
} from '~/utils/schedule'
import {
  type ISocialLink,
  type SocialPlatform,
  SOCIAL_PLATFORM_OPTIONS,
  getSocialPlatformIcon,
  getSocialPlatformOption,
  isValidSocialUrl,
} from '~/utils/social'

const { t, locale } = useI18n()

// Fetch general settings from admin API
const { data: settingsData, pending: isLoading, refresh } = await useFetch<any>('/api/admin/settings/general')

const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const syncPickup = ref(true)

interface GeneralForm {
  storeName: { ar: string; sv: string; en: string }
  tagline: { ar: string; sv: string; en: string }
  company: { name: string; orgNumber: string; vatNumber: string }
  contact: { email: string; phone: string }
  address: { street: string; postalCode: string; city: string; country: string }
  schedule: IDaySchedule[]
  socialLinks: ISocialLink[]
}

const form = ref<GeneralForm>({
  storeName: { ar: 'سوار', sv: 'Siwar', en: 'Siwar' },
  tagline: {
    ar: 'متجرك المفضل للمنتجات والمأكولات الشرقية الأصيلة',
    sv: 'Din orientaliska livsmedelsbutik i Halmstad',
    en: 'Your authentic Middle Eastern grocery store',
  },
  company: {
    name: 'Siwar Butik AB',
    orgNumber: '559123-4567',
    vatNumber: 'SE559123456701',
  },
  contact: {
    email: 'order@siwar.se',
    phone: '+46 35 123 456',
  },
  address: {
    street: 'Storgatan 12',
    postalCode: '302 43',
    city: 'Halmstad',
    country: 'Sverige',
  },
  schedule: DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
  socialLinks: [],
})

function populateForm(data: any) {
  if (!data) return
  form.value = {
    storeName: {
      ar: data.storeName?.ar || 'سوار',
      sv: data.storeName?.sv || 'Siwar',
      en: data.storeName?.en || 'Siwar',
    },
    tagline: {
      ar: data.tagline?.ar || '',
      sv: data.tagline?.sv || '',
      en: data.tagline?.en || '',
    },
    company: {
      name: data.company?.name || 'Siwar Butik AB',
      orgNumber: data.company?.orgNumber || '559123-4567',
      vatNumber: data.company?.vatNumber || 'SE559123456701',
    },
    contact: {
      email: data.contact?.email || 'order@siwar.se',
      phone: data.contact?.phone || '+46 35 123 456',
    },
    address: {
      street: data.address?.street || 'Storgatan 12',
      postalCode: data.address?.postalCode || '302 43',
      city: data.address?.city || 'Halmstad',
      country: data.address?.country || 'Sverige',
    },
    schedule: normalizeSchedule(data.schedule),
    socialLinks: Array.isArray(data.socialLinks)
      ? data.socialLinks.map((item: any, idx: number) => ({
          platform: item.platform || 'instagram',
          url: item.url || '',
          isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
          sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
        }))
      : [],
  }
}

watch(
  settingsData,
  (val) => {
    if (val) populateForm(val)
  },
  { immediate: true }
)

// Live formatted schedule preview in active locale
const formattedPreview = computed(() => {
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  return formatWeeklySchedule(form.value.schedule, currentLang)
})

function getDayLabel(dayKey: string) {
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  return (DAY_LABELS[currentLang] as any)?.[dayKey] || DAY_LABELS.sv[dayKey as keyof typeof DAY_LABELS.sv] || dayKey
}

function getPlatformIcon(platform: SocialPlatform): string {
  return getSocialPlatformIcon(platform)
}

function getPlatformPlaceholder(platform: SocialPlatform): string {
  const opt = getSocialPlatformOption(platform)
  return opt ? opt.placeholder : 'https://...'
}

function isValidUrl(url: string): boolean {
  return isValidSocialUrl(url)
}

function addSocialLink(platform: SocialPlatform = 'instagram') {
  form.value.socialLinks.push({
    platform,
    url: '',
    isActive: true,
    sortOrder: form.value.socialLinks.length,
  })
}

function removeSocialLink(index: number) {
  form.value.socialLinks.splice(index, 1)
  form.value.socialLinks.forEach((item, idx) => {
    item.sortOrder = idx
  })
}

function moveSocialLink(index: number, direction: 'up' | 'down') {
  if (direction === 'up' && index > 0) {
    const item = form.value.socialLinks.splice(index, 1)[0]!
    form.value.socialLinks.splice(index - 1, 0, item)
  } else if (direction === 'down' && index < form.value.socialLinks.length - 1) {
    const item = form.value.socialLinks.splice(index, 1)[0]!
    form.value.socialLinks.splice(index + 1, 0, item)
  }
  form.value.socialLinks.forEach((item, idx) => {
    item.sortOrder = idx
  })
}

async function handleSave() {
  // Validate social media link URLs (any non-empty URL must be valid, or empty URLs must be fixed)
  const invalidLink = form.value.socialLinks.find((l) => !isValidSocialUrl(l.url))
  if (invalidLink) {
    errorMessage.value = t('admin.general.social.invalidUrlError', 'Vänligen korrigera ogiltiga webbadresser för sociala medier innan du sparar.')
    openSections.value.social = true
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Normalize sortOrder & trim URLs
    form.value.socialLinks.forEach((item, idx) => {
      item.sortOrder = idx
      item.url = item.url.trim()
    })

    await $fetch('/api/admin/settings/general', {
      method: 'PUT',
      body: {
        ...form.value,
        syncPickup: syncPickup.value,
      },
    })

    successMessage.value = t('admin.general.savedSuccess', 'Inställningarna har sparats!')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('admin.general.saveError', 'Ett fel uppstod vid sparande.')
  } finally {
    isSaving.value = false
  }
}

// Collapsible Sections State (All expanded by default)
const openSections = ref<Record<string, boolean>>({
  company: true,
  contact: true,
  address: true,
  schedule: true,
  identity: true,
  social: true,
})

const allExpanded = computed(() => Object.values(openSections.value).every(Boolean))

function toggleSection(key: string) {
  openSections.value[key] = !openSections.value[key]
}

function toggleAll() {
  const target = !allExpanded.value
  for (const k in openSections.value) {
    openSections.value[k] = target
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Action Button -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="size-11 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 shadow-xs">
            <Icon name="lucide:sliders-horizontal" class="size-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight text-base-content">
              {{ t('admin.general.title', 'Allmänna butiksinställningar') }}
            </h2>
            <p class="text-xs sm:text-sm text-base-content/70 mt-0.5 font-medium">
              {{ t('admin.general.subtitle', 'Hantera företagsinformation, öppettider, kontaktuppgifter och fysisk adress') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          :disabled="isSaving || isLoading"
          class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold border-none rounded-xl gap-2 shadow-xs shrink-0"
          @click="handleSave"
        >
          <span v-if="isSaving" class="loading loading-spinner loading-xs" />
          <Icon v-else name="lucide:save" class="size-4" />
          <span>{{ t('admin.general.saveButton', 'Spara inställningar') }}</span>
        </button>
      </div>

      <!-- Feedback Alerts -->
      <div v-if="successMessage" class="alert alert-success mt-4 rounded-xl text-xs sm:text-sm font-semibold py-2.5">
        <Icon name="lucide:check-circle-2" class="size-4 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
      <div v-if="errorMessage" class="alert alert-error mt-4 rounded-xl text-xs sm:text-sm font-semibold py-2.5 text-white">
        <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <!-- Sections Toolbar (Count & Collapse/Expand All) -->
    <div class="flex items-center justify-between px-1">
      <span class="text-xs text-base-content/60 font-bold uppercase tracking-wider">
        {{ t('admin.general.sectionsCount', '6 sektioner') }}
      </span>
      <button
        type="button"
        class="btn btn-ghost btn-xs text-xs font-bold gap-1.5 text-base-content/70 hover:text-base-content rounded-lg"
        @click="toggleAll"
      >
        <Icon :name="allExpanded ? 'lucide:chevrons-up' : 'lucide:chevrons-down'" class="size-3.5" />
        <span>{{ allExpanded ? t('admin.general.collapseAll', 'Fäll ihop alla') : t('admin.general.expandAll', 'Fäll ut alla') }}</span>
      </button>
    </div>

    <!-- Collapsible Sections (DaisyUI Accordion/Collapse with Vue state) -->
    <div class="space-y-4">
      
      <!-- 1. Company Registration & Legal Compliance (Bokföringslagen) -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.company ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.company"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('company')"
          @keydown.enter.prevent="toggleSection('company')"
          @keydown.space.prevent="toggleSection('company')"
        >
          <div class="size-8 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:building-2" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.company.sectionTitle', 'Företagsinformation & Bokföringslagen') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">{{ t('admin.general.company.badge', 'Org.nr & Moms') }}</span>
          </div>
        </div>
        <div
          v-show="openSections.company"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <p class="text-xs text-base-content/60 leading-relaxed">
            {{ t('admin.general.company.description', 'Lagstadgade företagsuppgifter som visas i butikens sidfot för att uppfylla Bokföringslagen och prisinformationslagen.') }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.company.nameLabel', 'Företagsnamn (Juridiskt)') }} *</span>
              </label>
              <input
                v-model="form.company.name"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold"
                placeholder="Siwar Butik AB"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.company.orgNumberLabel', 'Organisationsnummer (Org.nr)') }} *</span>
              </label>
              <input
                v-model="form.company.orgNumber"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-mono font-bold"
                placeholder="559123-4567"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.company.vatNumberLabel', 'Momsregistreringsnummer (VAT)') }} *</span>
              </label>
              <input
                v-model="form.company.vatNumber"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-mono font-bold"
                placeholder="SE559123456701"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Customer Service & Contact Details -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.contact ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.contact"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('contact')"
          @keydown.enter.prevent="toggleSection('contact')"
          @keydown.space.prevent="toggleSection('contact')"
        >
          <div class="size-8 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:headphones" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.contact.sectionTitle', 'Kundtjänst & Kontaktuppgifter') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">{{ t('admin.general.contact.badge', 'E-post & Telefon') }}</span>
          </div>
        </div>
        <div
          v-show="openSections.contact"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <p class="text-xs text-base-content/60 leading-relaxed">
            {{ t('admin.general.contact.description', 'Kontaktvägar för kunder vid frågor, reklamationer och orderstatus.') }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.contact.emailLabel', 'Kundtjänst E-post') }} *</span>
              </label>
              <div class="relative">
                <input
                  v-model="form.contact.email"
                  type="email"
                  required
                  class="input input-bordered ps-9 h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold w-full"
                  placeholder="order@siwar.se"
                />
                <Icon name="lucide:mail" class="absolute start-3 top-3 size-4 text-base-content/50" />
              </div>
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.contact.phoneLabel', 'Telefonnummer') }} *</span>
              </label>
              <div class="relative">
                <input
                  v-model="form.contact.phone"
                  type="tel"
                  required
                  class="input input-bordered ps-9 h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold w-full font-mono"
                  placeholder="+46 35 123 456"
                />
                <Icon name="lucide:phone" class="absolute start-3 top-3 size-4 text-base-content/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Physical Store Address -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.address ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.address"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('address')"
          @keydown.enter.prevent="toggleSection('address')"
          @keydown.space.prevent="toggleSection('address')"
        >
          <div class="size-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:map-pin" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.address.sectionTitle', 'Fysisk Butiksadress') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">{{ form.address.city || 'Halmstad' }}</span>
          </div>
        </div>
        <div
          v-show="openSections.address"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <p class="text-xs text-base-content/60 leading-relaxed">
            {{ t('admin.general.address.description', 'Adressen till den fysiska butiken där kunder kan besöka oss och hämta ut beställningar.') }}
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="form-control sm:col-span-2">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.address.streetLabel', 'Gatuadress') }} *</span>
              </label>
              <input
                v-model="form.address.street"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold"
                placeholder="Storgatan 12"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.address.postalCodeLabel', 'Postnummer') }} *</span>
              </label>
              <input
                v-model="form.address.postalCode"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold font-mono"
                placeholder="302 43"
              />
            </div>

            <div class="form-control">
              <label class="label py-1">
                <span class="label-text font-bold text-xs">{{ t('admin.general.address.cityLabel', 'Postort') }} *</span>
              </label>
              <input
                v-model="form.address.city"
                type="text"
                required
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-semibold"
                placeholder="Halmstad"
              />
            </div>
          </div>

          <!-- Sync with pickup checkbox -->
          <div class="pt-2">
            <label class="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                v-model="syncPickup"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm rounded-lg"
              />
              <span class="text-xs font-semibold text-base-content/80">
                {{ t('admin.general.address.syncPickupLabel', 'Håll butiksupphämtningsadressen automatiskt synkroniserad med denna adress') }}
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- 4. Weekly Opening Hours (Mon-Sun) -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.schedule ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.schedule"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('schedule')"
          @keydown.enter.prevent="toggleSection('schedule')"
          @keydown.space.prevent="toggleSection('schedule')"
        >
          <div class="size-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:clock" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.schedule.sectionTitle', 'Öppettider (Veckoschema)') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">{{ t('admin.general.schedule.badge', 'Mån–Sön') }}</span>
          </div>
        </div>
        <div
          v-show="openSections.schedule"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <p class="text-xs text-base-content/60 leading-relaxed">
            {{ t('admin.general.schedule.description', 'Definiera butikens öppettider per veckodag. Tiderna formateras automatiskt och visas i sidfoten.') }}
          </p>

          <!-- Live Formatted Preview Callout -->
          <div class="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
            <Icon name="lucide:sparkles" class="size-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-0.5">
                {{ t('admin.general.schedule.previewLabel', 'Förhandsvisning i sidfot:') }}
              </span>
              <p class="text-xs font-semibold text-amber-900 dark:text-amber-100 font-mono break-words">
                {{ formattedPreview }}
              </p>
            </div>
          </div>

          <!-- Schedule Editor Rows -->
          <div class="divide-y divide-slate-100 dark:divide-zinc-800">
            <div
              v-for="item in form.schedule"
              :key="item.day"
              class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <!-- Day name + Open toggle -->
              <div class="flex items-center gap-3 w-40">
                <input
                  v-model="item.isOpen"
                  type="checkbox"
                  class="toggle toggle-sm toggle-success"
                />
                <span class="font-bold text-xs sm:text-sm text-base-content">
                  {{ getDayLabel(item.day) }}
                </span>
              </div>

              <!-- Time inputs when open -->
              <div v-if="item.isOpen" class="flex items-center gap-2">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-base-content/60">{{ t('admin.general.schedule.open', 'Öppnar') }}</span>
                  <input
                    v-model="item.openTime"
                    type="time"
                    class="input input-bordered input-sm h-8 w-28 text-xs font-mono font-bold border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  />
                </div>
                <span class="text-base-content/40 font-bold">-</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-base-content/60">{{ t('admin.general.schedule.close', 'Stänger') }}</span>
                  <input
                    v-model="item.closeTime"
                    type="time"
                    class="input input-bordered input-sm h-8 w-28 text-xs font-mono font-bold border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  />
                </div>
              </div>

              <!-- Closed Badge -->
              <div v-else class="flex items-center">
                <span class="badge badge-sm badge-ghost text-xs text-base-content/50 font-bold">
                  {{ t('admin.general.schedule.closed', 'Stängt hela dagen') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. Multilingual Store Identity & Tagline -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.identity ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.identity"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('identity')"
          @keydown.enter.prevent="toggleSection('identity')"
          @keydown.space.prevent="toggleSection('identity')"
        >
          <div class="size-8 rounded-xl bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:store" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.identity.sectionTitle', 'Butiksidentitet & Slogan (Flerspråkig)') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">AR / SV / EN</span>
          </div>
        </div>
        <div
          v-show="openSections.identity"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <p class="text-xs text-base-content/60 leading-relaxed">
            {{ t('admin.general.identity.description', 'Butikens marknadsföringsnamn och beskrivande slogan som visas i sidfoten och rubriker.') }}
          </p>

          <!-- Store Name (AR, SV, EN) -->
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-base-content/70 block mb-2">
              {{ t('admin.general.identity.storeName', 'Butiksnamn') }}
            </span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">العربية (AR)</span></label>
                <input
                  v-model="form.storeName.ar"
                  dir="rtl"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold w-full"
                />
              </div>
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">Svenska (SV)</span></label>
                <input
                  v-model="form.storeName.sv"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold w-full"
                />
              </div>
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">English (EN)</span></label>
                <input
                  v-model="form.storeName.en"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold w-full"
                />
              </div>
            </div>
          </div>

          <!-- Tagline (AR, SV, EN) -->
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-base-content/70 block mb-2">
              {{ t('admin.general.identity.tagline', 'Slogan / Butiksbeskrivning') }}
            </span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">العربية (AR)</span></label>
                <input
                  v-model="form.tagline.ar"
                  dir="rtl"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium w-full"
                />
              </div>
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">Svenska (SV)</span></label>
                <input
                  v-model="form.tagline.sv"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium w-full"
                />
              </div>
              <div>
                <label class="label py-0.5"><span class="label-text text-xs">English (EN)</span></label>
                <input
                  v-model="form.tagline.en"
                  type="text"
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium w-full"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- 6. Social Media Links & Channels -->
      <div
        class="collapse collapse-arrow bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl shadow-xs transition-colors"
        :class="openSections.social ? 'collapse-open' : 'collapse-close'"
      >
        <div
          role="button"
          tabindex="0"
          :aria-expanded="openSections.social"
          class="collapse-title flex items-center gap-3 font-bold text-base text-base-content px-5 py-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors"
          @click="toggleSection('social')"
          @keydown.enter.prevent="toggleSection('social')"
          @keydown.space.prevent="toggleSection('social')"
        >
          <div class="size-8 rounded-xl bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 flex items-center justify-center shrink-0">
            <Icon name="lucide:share-2" class="size-4.5" />
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
            <span class="truncate">{{ t('admin.general.social.sectionTitle', 'Sociala medier & Kanaler') }}</span>
            <span class="badge badge-sm badge-ghost text-[10px] font-mono font-bold">
              {{ form.socialLinks.length }} {{ form.socialLinks.length === 1 ? 'kanal' : 'kanaler' }}
            </span>
          </div>
        </div>
        <div
          v-show="openSections.social"
          class="collapse-content px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-zinc-800/80 pt-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p class="text-xs text-base-content/60 leading-relaxed max-w-xl">
              {{ t('admin.general.social.description', 'Hantera butikens officiella länkar till sociala medier som visas i sidfoten och på kontaktsidan.') }}
            </p>

            <!-- Dropdown to Add Social Link from in-memory options -->
            <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold btn-sm rounded-xl gap-2 shadow-xs shrink-0">
                <Icon name="lucide:plus" class="size-4" />
                <span>{{ t('admin.general.social.addLink', 'Lägg till social kanal') }}</span>
                <Icon name="lucide:chevron-down" class="size-3.5 opacity-70" />
              </div>
              <ul tabindex="0" class="dropdown-content z-20 menu p-2 shadow-xl bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl w-56 space-y-1 mt-1">
                <li v-for="option in SOCIAL_PLATFORM_OPTIONS" :key="option.platform">
                  <button
                    type="button"
                    class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-700 text-base-content"
                    @click="addSocialLink(option.platform)"
                  >
                    <Icon :name="option.icon" class="size-4.5 shrink-0" />
                    <span>{{ option.label }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Empty state when no links added -->
          <div v-if="form.socialLinks.length === 0" class="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl">
            <div class="size-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-base-content/50 flex items-center justify-center mx-auto mb-3">
              <Icon name="lucide:share-2" class="size-6" />
            </div>
            <p class="text-xs font-medium text-base-content/70 max-w-md mx-auto">
              {{ t('admin.general.social.noLinks', 'Inga sociala medier tillagda än. Klicka ovan för att lägga till din första länk.') }}
            </p>
          </div>

          <!-- List of Social Media Cards -->
          <div v-else class="space-y-3">
            <div
              v-for="(link, index) in form.socialLinks"
              :key="index"
              class="card bg-slate-50 dark:bg-zinc-800/60 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl p-3 sm:p-4 transition-all"
              :class="{ 'opacity-60': !link.isActive }"
            >
              <div class="flex flex-col lg:flex-row lg:items-center gap-3">
                
                <!-- Platform Selector with Icon preview -->
                <div class="w-full lg:w-56 shrink-0">
                  <label class="label py-0.5">
                    <span class="label-text font-bold text-[11px] text-base-content/70">
                      {{ t('admin.general.social.platformLabel', 'Plattform') }}
                    </span>
                  </label>
                  <div class="relative flex items-center">
                    <div class="absolute start-3 pointer-events-none flex items-center justify-center">
                      <Icon :name="getPlatformIcon(link.platform)" class="size-4.5" />
                    </div>
                    <select
                      v-model="link.platform"
                      class="select select-bordered select-sm ps-10 h-10 w-full text-xs font-bold border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-xl"
                    >
                      <option v-for="opt in SOCIAL_PLATFORM_OPTIONS" :key="opt.platform" :value="opt.platform">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- URL Input with Validation Indicator -->
                <div class="flex-1 min-w-0">
                  <label class="label py-0.5 flex justify-between items-center">
                    <span class="label-text font-bold text-[11px] text-base-content/70">
                      {{ t('admin.general.social.urlLabel', 'Webbadress (URL)') }} *
                    </span>
                    <span v-if="link.url && !isValidUrl(link.url)" class="text-[11px] text-error font-semibold flex items-center gap-1">
                      <Icon name="lucide:alert-circle" class="size-3" />
                      {{ t('admin.general.social.invalidUrl', 'Ogiltig URL') }}
                    </span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="link.url"
                      type="url"
                      required
                      :placeholder="getPlatformPlaceholder(link.platform)"
                      class="input input-bordered h-10 w-full text-xs font-mono font-semibold border-2 bg-white dark:bg-zinc-800 text-base-content rounded-xl ps-9"
                      :class="link.url && !isValidUrl(link.url) ? 'border-error focus:border-error' : 'border-slate-300 dark:border-zinc-700'"
                    />
                    <Icon name="lucide:link" class="absolute start-3 top-3 size-4 text-base-content/40" />
                  </div>
                </div>

                <!-- Actions: Toggle isActive, Reorder, Remove -->
                <div class="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-5 border-t lg:border-t-0 border-slate-200 dark:border-zinc-700/60 shrink-0">
                  
                  <!-- Active / Inactive Toggle -->
                  <div class="flex items-center gap-2">
                    <input
                      v-model="link.isActive"
                      type="checkbox"
                      class="toggle toggle-sm toggle-success"
                      :title="link.isActive ? t('admin.general.social.activeLabel', 'Aktiv') : t('admin.general.social.inactiveLabel', 'Inaktiv')"
                    />
                    <span class="text-xs font-bold" :class="link.isActive ? 'text-success' : 'text-base-content/40'">
                      {{ link.isActive ? t('admin.general.social.activeLabel', 'Aktiv') : t('admin.general.social.inactiveLabel', 'Inaktiv') }}
                    </span>
                  </div>

                  <!-- Reorder Controls -->
                  <div class="join border border-slate-300 dark:border-zinc-700 rounded-lg">
                    <button
                      type="button"
                      :disabled="index === 0"
                      class="btn btn-ghost btn-xs join-item px-1.5 text-base-content/70 hover:text-base-content disabled:opacity-30"
                      :title="t('admin.general.social.moveUp', 'Flytta upp')"
                      @click="moveSocialLink(index, 'up')"
                    >
                      <Icon name="lucide:chevron-up" class="size-3.5" />
                    </button>
                    <button
                      type="button"
                      :disabled="index === form.socialLinks.length - 1"
                      class="btn btn-ghost btn-xs join-item px-1.5 text-base-content/70 hover:text-base-content disabled:opacity-30"
                      :title="t('admin.general.social.moveDown', 'Flytta ner')"
                      @click="moveSocialLink(index, 'down')"
                    >
                      <Icon name="lucide:chevron-down" class="size-3.5" />
                    </button>
                  </div>

                  <!-- Remove Button -->
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-error hover:bg-error/10 rounded-xl px-2.5"
                    :title="t('admin.general.social.remove', 'Ta bort')"
                    @click="removeSocialLink(index)"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>
