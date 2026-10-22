<!-- components/admin/settings/BannerManager.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const emit = defineEmits<{
  (e: 'update:count', count: number): void
}>()

const { t, locale } = useI18n()

// Fetch existing banners
const { data: banners, pending: isLoading, refresh } = await useFetch<any[]>('/api/admin/settings/banners')

// Watch count to notify parent
watch(
  banners,
  (newVal) => {
    emit('update:count', newVal?.length || 0)
  },
  { immediate: true }
)

const modalRef = ref<HTMLDialogElement | null>(null)
const isSubmitting = ref(false)
const isUploading = ref(false)
const uploadError = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const searchQuery = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const fieldErrors = ref<Record<string, string>>({})

function clearFieldError(field: string) {
  if (fieldErrors.value[field]) {
    delete fieldErrors.value[field]
  }
}

interface BannerForm {
  id?: string
  _id?: string
  title: { ar: string; sv: string; en: string }
  subtitle: { ar: string; sv: string; en: string }
  badge: { ar: string; sv: string; en: string }
  imageUrl: string
  mobileImageUrl: string
  linkUrl: string
  sortOrder: number
  isActive: boolean
  startsAt: string // ISO or YYYY-MM-DDTHH:mm for datetime-local
  expiresAt: string
}

const initialForm: BannerForm = {
  title: { ar: '', sv: '', en: '' },
  subtitle: { ar: '', sv: '', en: '' },
  badge: { ar: '', sv: '', en: '' },
  imageUrl: '',
  mobileImageUrl: '',
  linkUrl: '/catalog',
  sortOrder: 0,
  isActive: true,
  startsAt: '',
  expiresAt: '',
}

const form = ref<BannerForm>(JSON.parse(JSON.stringify(initialForm)))
const isEditing = computed(() => !!form.value.id || !!form.value._id)

// Localized text helper
function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Convert Date to YYYY-MM-DDTHH:mm format for datetime-local input
function formatForInput(dateVal?: string | Date | null): string {
  if (!dateVal) return ''
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

// Banner scheduling status helper
function getBannerStatus(banner: any): { label: string; class: string; icon: string } {
  if (banner.isActive === false) {
    return {
      label: t('admin.banners.status.inactive', 'Inaktiv'),
      class: 'badge-ghost opacity-75',
      icon: 'lucide:pause-circle',
    }
  }

  const now = new Date()
  if (banner.startsAt && new Date(banner.startsAt) > now) {
    return {
      label: t('admin.banners.status.scheduled', 'Schemalagd'),
      class: 'badge-info',
      icon: 'lucide:clock',
    }
  }

  if (banner.expiresAt && new Date(banner.expiresAt) <= now) {
    return {
      label: t('admin.banners.status.expired', 'Utgången'),
      class: 'badge-warning',
      icon: 'lucide:alert-triangle',
    }
  }

  return {
    label: t('admin.banners.status.active', 'Aktiv'),
    class: 'badge-success font-bold',
    icon: 'lucide:check-circle-2',
  }
}

// Filtered banners
const filteredBanners = computed(() => {
  if (!banners.value) return []
  if (!searchQuery.value.trim()) return banners.value
  const query = searchQuery.value.toLowerCase().trim()
  return banners.value.filter((b) => {
    const svTitle = (b.title?.sv || '').toLowerCase()
    const enTitle = (b.title?.en || '').toLowerCase()
    const arTitle = (b.title?.ar || '').toLowerCase()
    const link = (b.linkUrl || '').toLowerCase()
    return (
      svTitle.includes(query) ||
      enTitle.includes(query) ||
      arTitle.includes(query) ||
      link.includes(query)
    )
  })
})

function openModal(banner: any = null) {
  fieldErrors.value = {}
  if (banner && !(banner instanceof Event)) {
    form.value = {
      id: banner.id || banner._id,
      _id: banner._id || banner.id,
      title: { ar: banner.title?.ar || '', sv: banner.title?.sv || '', en: banner.title?.en || '' },
      subtitle: { ar: banner.subtitle?.ar || '', sv: banner.subtitle?.sv || '', en: banner.subtitle?.en || '' },
      badge: { ar: banner.badge?.ar || '', sv: banner.badge?.sv || '', en: banner.badge?.en || '' },
      imageUrl: banner.imageUrl || '',
      mobileImageUrl: banner.mobileImageUrl || '',
      linkUrl: banner.linkUrl || '/catalog',
      sortOrder: typeof banner.sortOrder === 'number' ? banner.sortOrder : 0,
      isActive: banner.isActive !== false,
      startsAt: formatForInput(banner.startsAt),
      expiresAt: formatForInput(banner.expiresAt),
    }
  } else {
    form.value = {
      ...JSON.parse(JSON.stringify(initialForm)),
      sortOrder: (banners.value?.length || 0),
    }
  }
  errorMessage.value = ''
  uploadError.value = ''
  modalRef.value?.showModal()
}

function closeModal() {
  modalRef.value?.close()
  form.value = JSON.parse(JSON.stringify(initialForm))
  fieldErrors.value = {}
  uploadError.value = ''
  errorMessage.value = ''
}

// File Upload Handler calling POST /api/admin/upload
async function handleFileUpload(e: Event, isMobile = false) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await $fetch<{ statusCode: number; url: string; fileName: string }>('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    if (res?.url) {
      if (isMobile) {
        form.value.mobileImageUrl = res.url
      } else {
        form.value.imageUrl = res.url
        clearFieldError('imageUrl')
      }
    }
  } catch (err: any) {
    uploadError.value =
      err?.data?.statusMessage ||
      err?.message ||
      t('admin.products.uploadError', 'Kunde inte ladda upp bilden.')
  } finally {
    isUploading.value = false
    target.value = ''
  }
}

// Frontend validation check before sending payload to backend
function validateForm(): boolean {
  fieldErrors.value = {}
  let hasError = false

  // Image validation
  if (!form.value.imageUrl?.trim()) {
    fieldErrors.value['imageUrl'] = t('admin.banners.validation.imageRequired', 'Bannerbild för desktop krävs.')
    hasError = true
  }

  // Link URL validation
  if (!form.value.linkUrl?.trim()) {
    fieldErrors.value['linkUrl'] = t('admin.banners.validation.linkRequired', 'Mål-URL krävs.')
    hasError = true
  }

  // Title validations (All 3 languages required)
  if (!form.value.title?.en?.trim()) {
    fieldErrors.value['title.en'] = t('admin.banners.validation.titleEnRequired', 'Titel på engelska krävs.')
    hasError = true
  }
  if (!form.value.title?.sv?.trim()) {
    fieldErrors.value['title.sv'] = t('admin.banners.validation.titleSvRequired', 'Titel på svenska krävs.')
    hasError = true
  }
  if (!form.value.title?.ar?.trim()) {
    fieldErrors.value['title.ar'] = t('admin.banners.validation.titleArRequired', 'العنوان باللغة العربية مطلوب.')
    hasError = true
  }

  // Subtitle validations (All 3 languages required)
  if (!form.value.subtitle?.en?.trim()) {
    fieldErrors.value['subtitle.en'] = t('admin.banners.validation.subtitleEnRequired', 'Underrubrik på engelska krävs.')
    hasError = true
  }
  if (!form.value.subtitle?.sv?.trim()) {
    fieldErrors.value['subtitle.sv'] = t('admin.banners.validation.subtitleSvRequired', 'Underrubrik på svenska krävs.')
    hasError = true
  }
  if (!form.value.subtitle?.ar?.trim()) {
    fieldErrors.value['subtitle.ar'] = t('admin.banners.validation.subtitleArRequired', 'العنوان الفرعي باللغة العربية مطلوب.')
    hasError = true
  }

  // Scheduling validation
  if (form.value.startsAt && form.value.expiresAt) {
    const start = new Date(form.value.startsAt).getTime()
    const expiry = new Date(form.value.expiresAt).getTime()
    if (!isNaN(start) && !isNaN(expiry) && expiry <= start) {
      fieldErrors.value['expiresAt'] = t('admin.banners.validation.expiryAfterStart', 'Sluttiden måste vara efter starttiden.')
      hasError = true
    }
  }

  if (hasError) {
    errorMessage.value = t('admin.banners.validation.fixErrors', 'Vänligen fyll i alla obligatoriska fält markerade med *.')
    return false
  }

  return true
}

// Helper to sanitize any existing banners in the array so missing fields on other banners don't cause backend Mongoose failure
function sanitizeBannerList(list: any[]): any[] {
  return list.map((item, idx) => ({
    _id: item._id || item.id || undefined,
    id: item.id || item._id || undefined,
    title: {
      ar: (item.title?.ar || '').trim() || (item.title?.sv || '').trim() || (item.title?.en || '').trim() || `Banner ${idx + 1}`,
      sv: (item.title?.sv || '').trim() || (item.title?.en || '').trim() || (item.title?.ar || '').trim() || `Banner ${idx + 1}`,
      en: (item.title?.en || '').trim() || (item.title?.sv || '').trim() || (item.title?.ar || '').trim() || `Banner ${idx + 1}`,
    },
    subtitle: {
      ar: (item.subtitle?.ar || '').trim() || (item.subtitle?.sv || '').trim() || (item.subtitle?.en || '').trim() || '-',
      sv: (item.subtitle?.sv || '').trim() || (item.subtitle?.en || '').trim() || (item.subtitle?.ar || '').trim() || '-',
      en: (item.subtitle?.en || '').trim() || (item.subtitle?.sv || '').trim() || (item.subtitle?.ar || '').trim() || '-',
    },
    badge: {
      ar: (item.badge?.ar || '').trim(),
      sv: (item.badge?.sv || '').trim(),
      en: (item.badge?.en || '').trim(),
    },
    imageUrl: (item.imageUrl || '').trim(),
    mobileImageUrl: (item.mobileImageUrl || '').trim(),
    linkUrl: (item.linkUrl || '').trim() || '/catalog',
    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : idx,
    isActive: item.isActive !== false,
    startsAt: item.startsAt ? new Date(item.startsAt).toISOString() : null,
    expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : null,
  }))
}

// Save or Update Banner
async function handleSubmit() {
  errorMessage.value = ''

  // Validate on the frontend BEFORE making any backend request
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    const currentList = Array.isArray(banners.value) ? [...banners.value] : []
    const updatedBannerPayload = {
      id: form.value.id || form.value._id || undefined,
      _id: form.value._id || form.value.id || undefined,
      title: {
        ar: form.value.title.ar.trim(),
        sv: form.value.title.sv.trim(),
        en: form.value.title.en.trim(),
      },
      subtitle: {
        ar: form.value.subtitle.ar.trim(),
        sv: form.value.subtitle.sv.trim(),
        en: form.value.subtitle.en.trim(),
      },
      badge: {
        ar: (form.value.badge?.ar || '').trim(),
        sv: (form.value.badge?.sv || '').trim(),
        en: (form.value.badge?.en || '').trim(),
      },
      imageUrl: form.value.imageUrl.trim(),
      mobileImageUrl: (form.value.mobileImageUrl || '').trim(),
      linkUrl: form.value.linkUrl.trim() || '/catalog',
      sortOrder: Number(form.value.sortOrder) || 0,
      isActive: form.value.isActive !== false,
      startsAt: form.value.startsAt ? new Date(form.value.startsAt).toISOString() : null,
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null,
    }

    let newList: any[]
    if (isEditing.value) {
      const editId = form.value.id || form.value._id
      newList = currentList.map((item) => {
        if ((item.id && item.id === editId) || (item._id && item._id === editId)) {
          return updatedBannerPayload
        }
        return item
      })
    } else {
      newList = [...currentList, updatedBannerPayload]
    }

    // Sort by sortOrder before PUT
    newList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const sanitizedList = sanitizeBannerList(newList)

    await $fetch('/api/admin/settings/banners', {
      method: 'PUT',
      body: { banners: sanitizedList },
    })

    successMessage.value = t('admin.banners.success', 'Banners har sparats!')
    closeModal()
    await refresh()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.banners.error', 'Kunde inte spara banners.')
  } finally {
    isSubmitting.value = false
  }
}

// Delete Banner
async function handleDelete(banner: any) {
  if (!confirm(t('admin.banners.confirmDelete', 'Är du säker på att du vill ta bort denna banner?'))) return

  isSubmitting.value = true
  try {
    const targetId = banner.id || banner._id
    const currentList = Array.isArray(banners.value) ? [...banners.value] : []
    const newList = currentList.filter((b) => (b.id && b.id !== targetId) && (b._id && b._id !== targetId))
    const sanitizedList = sanitizeBannerList(newList)

    await $fetch('/api/admin/settings/banners', {
      method: 'PUT',
      body: { banners: sanitizedList },
    })

    successMessage.value = t('admin.banners.success', 'Banners har sparats!')
    await refresh()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.data?.message || t('admin.banners.error', 'Kunde inte ta bort banner.'))
  } finally {
    isSubmitting.value = false
  }
}

// Reorder Move Up / Move Down
async function moveBanner(index: number, direction: 'up' | 'down') {
  if (!banners.value) return
  const currentList = [...banners.value]
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= currentList.length) return

  // Swap elements
  const temp = currentList[index]
  currentList[index] = currentList[targetIndex]
  currentList[targetIndex] = temp

  // Re-assign sequential sort orders
  currentList.forEach((b, idx) => {
    b.sortOrder = idx
  })

  const sanitizedList = sanitizeBannerList(currentList)

  try {
    await $fetch('/api/admin/settings/banners', {
      method: 'PUT',
      body: { banners: sanitizedList },
    })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.statusMessage || 'Kunde inte ändra ordning.')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Section Toolbar & Title -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl">
      <div class="card-body p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <div class="size-9 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                <Icon name="lucide:image" class="size-5" />
              </div>
              <h2 class="text-xl font-bold tracking-tight text-base-content">
                {{ t('admin.banners.title', 'Kampanjbanners') }}
              </h2>
            </div>
            <p class="text-sm text-base-content/75 mt-1 font-medium">
              {{ t('admin.banners.subtitle', 'Hantera förstasidans kampanjbanners, grafik och länkar') }}
            </p>
          </div>

          <button
            type="button"
            class="btn bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm rounded-xl font-bold gap-2 text-sm shrink-0 transition-colors"
            @click="openModal()"
          >
            <Icon name="lucide:plus" class="size-4" />
            {{ t('admin.banners.add', 'Lägg till banner') }}
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
          <div class="relative w-full sm:max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.banners.searchPlaceholder', 'Filtrera banners efter titel eller länk...')"
              class="input w-full pl-9 pr-8 h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs"
            />
            <Icon
              name="lucide:search"
              class="absolute left-3 top-3 size-4 text-base-content/60 rtl:left-auto rtl:right-3"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-2.5 size-5 flex items-center justify-center text-base-content/50 hover:text-base-content rtl:right-auto rtl:left-2.5"
              @click="searchQuery = ''"
            >
              <Icon name="lucide:x" class="size-3.5" />
            </button>
          </div>

          <div v-if="searchQuery" class="text-xs font-semibold text-base-content/70">
            {{ filteredBanners.length }} / {{ banners?.length || 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Alerts -->
    <div
      v-if="successMessage"
      class="alert alert-success shadow-sm rounded-xl border border-success/30 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
        <span class="font-medium text-sm">{{ successMessage }}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-xs btn-circle" @click="successMessage = ''">
        <Icon name="lucide:x" class="size-4" />
      </button>
    </div>

    <!-- Data Display Card -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-16">
        <span class="loading loading-spinner loading-md text-brand-500"></span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!filteredBanners || filteredBanners.length === 0"
        class="text-center py-16 text-base-content/70"
      >
        <Icon name="lucide:image-off" class="size-12 mx-auto mb-3 opacity-40 text-base-content" />
        <p class="font-bold text-base">{{ t('admin.banners.empty', 'Inga kampanjbanners konfigurerade ännu.') }}</p>
        <p class="text-xs text-base-content/60 mt-1">
          {{ t('admin.banners.subtitle', 'Skapa en banner för att lyfta fram erbjudanden på förstasidan') }}
        </p>
      </div>

      <template v-else>
        <!-- Desktop Table View (>= lg) -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr class="text-xs font-bold uppercase tracking-wider text-base-content/70 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700/80">
                <th class="py-3 px-4 w-20 text-center">{{ t('admin.banners.table.order', 'Ordning') }}</th>
                <th class="py-3 px-4 w-32">{{ t('admin.banners.table.preview', 'Bild') }}</th>
                <th class="py-3 px-4">{{ t('admin.banners.table.title', 'Titel & Innehåll') }}</th>
                <th class="py-3 px-4">{{ t('admin.banners.table.link', 'Länk') }}</th>
                <th class="py-3 px-4">{{ t('admin.banners.table.status', 'Status') }}</th>
                <th class="py-3 px-4 text-right rtl:text-left">{{ t('admin.banners.table.actions', 'Åtgärder') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
              <tr
                v-for="(banner, idx) in filteredBanners"
                :key="banner.id || banner._id || idx"
                class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <!-- Order controls -->
                <td class="py-3.5 px-4 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <span class="font-mono text-xs font-bold w-5">{{ banner.sortOrder ?? idx }}</span>
                    <div class="flex flex-col">
                      <button
                        type="button"
                        :disabled="idx === 0"
                        class="btn btn-ghost btn-xs btn-square h-4 min-h-0 disabled:opacity-30"
                        @click="moveBanner(idx, 'up')"
                      >
                        <Icon name="lucide:chevron-up" class="size-3" />
                      </button>
                      <button
                        type="button"
                        :disabled="idx === filteredBanners.length - 1"
                        class="btn btn-ghost btn-xs btn-square h-4 min-h-0 disabled:opacity-30"
                        @click="moveBanner(idx, 'down')"
                      >
                        <Icon name="lucide:chevron-down" class="size-3" />
                      </button>
                    </div>
                  </div>
                </td>

                <!-- Thumbnail -->
                <td class="py-3.5 px-4">
                  <div class="w-24 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 shadow-xs relative">
                    <img
                      :src="banner.imageUrl"
                      :alt="getLocalizedText(banner.title)"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </td>

                <!-- Title & Subtitle across languages -->
                <td class="py-3.5 px-4">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span v-if="getLocalizedText(banner.badge)" class="badge badge-xs badge-primary font-bold">
                        {{ getLocalizedText(banner.badge) }}
                      </span>
                      <span class="font-bold text-sm text-base-content">
                        {{ getLocalizedText(banner.title) }}
                      </span>
                    </div>
                    <p class="text-xs text-base-content/70 line-clamp-1">
                      {{ getLocalizedText(banner.subtitle) || '—' }}
                    </p>
                    <div class="flex items-center gap-1.5 text-[10px] text-base-content/60 font-medium">
                      <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                        SV: {{ banner.title?.sv || '—' }}
                      </span>
                      <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                        EN: {{ banner.title?.en || '—' }}
                      </span>
                      <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                        AR: {{ banner.title?.ar || '—' }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Destination Link -->
                <td class="py-3.5 px-4">
                  <div class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg text-xs font-mono text-base-content/80">
                    <Icon name="lucide:link" class="size-3 opacity-60" />
                    <span>{{ banner.linkUrl || '/catalog' }}</span>
                  </div>
                </td>

                <!-- Status Badge -->
                <td class="py-3.5 px-4">
                  <div class="flex flex-col gap-1 items-start">
                    <span
                      class="badge badge-sm gap-1 text-[11px]"
                      :class="getBannerStatus(banner).class"
                    >
                      <Icon :name="getBannerStatus(banner).icon" class="size-3" />
                      {{ getBannerStatus(banner).label }}
                    </span>
                    <span v-if="banner.startsAt || banner.expiresAt" class="text-[10px] text-base-content/60 font-mono">
                      {{ banner.startsAt ? new Date(banner.startsAt).toLocaleDateString() : '∞' }} → {{ banner.expiresAt ? new Date(banner.expiresAt).toLocaleDateString() : '∞' }}
                    </span>
                  </div>
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right rtl:text-left space-x-1 rtl:space-x-reverse">
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg"
                    :title="t('admin.banners.edit', 'Redigera')"
                    @click="openModal(banner)"
                  >
                    <Icon name="lucide:pencil" class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-lg"
                    :title="t('admin.banners.delete', 'Ta bort')"
                    @click="handleDelete(banner)"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile & Tablet Card View (< lg): Decluttered responsive layout -->
        <div class="block lg:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          <div
            v-for="(banner, idx) in filteredBanners"
            :key="banner.id || banner._id || idx"
            class="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/20"
          >
            <!-- Banner Graphic Preview with Status Badge -->
            <div class="w-full sm:w-56 shrink-0 aspect-[21/9] sm:aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/80 relative shadow-xs">
              <img
                :src="banner.imageUrl"
                :alt="getLocalizedText(banner.title)"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div class="absolute top-2 right-2 rtl:right-auto rtl:left-2">
                <span
                  class="badge badge-sm gap-1 text-[11px] font-semibold backdrop-blur-md shadow-xs"
                  :class="getBannerStatus(banner).class"
                >
                  <Icon :name="getBannerStatus(banner).icon" class="size-3" />
                  {{ getBannerStatus(banner).label }}
                </span>
              </div>
            </div>

            <!-- Content & Metadata Details -->
            <div class="flex-1 w-full min-w-0 flex flex-col justify-between gap-3">
              <div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span v-if="getLocalizedText(banner.badge)" class="badge badge-xs badge-primary font-bold">
                    {{ getLocalizedText(banner.badge) }}
                  </span>
                  <h3 class="font-bold text-base text-base-content truncate">
                    {{ getLocalizedText(banner.title) }}
                  </h3>
                </div>
                <p class="text-xs text-base-content/70 mt-1 line-clamp-2">
                  {{ getLocalizedText(banner.subtitle) || '—' }}
                </p>

                <!-- Link & Scheduling Meta -->
                <div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <div class="inline-flex items-center gap-1 font-mono text-base-content/75 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md max-w-full truncate">
                    <Icon name="lucide:link" class="size-3 shrink-0 opacity-60" />
                    <span class="truncate">{{ banner.linkUrl || '/catalog' }}</span>
                  </div>
                  <div v-if="banner.startsAt || banner.expiresAt" class="inline-flex items-center gap-1 font-mono text-[11px] text-base-content/65 bg-slate-100/70 dark:bg-zinc-800/70 px-2 py-0.5 rounded-md">
                    <Icon name="lucide:calendar" class="size-3 shrink-0 opacity-60" />
                    <span>{{ banner.startsAt ? new Date(banner.startsAt).toLocaleDateString() : '∞' }} → {{ banner.expiresAt ? new Date(banner.expiresAt).toLocaleDateString() : '∞' }}</span>
                  </div>
                </div>

                <!-- Language Translations preview -->
                <div class="mt-2 flex flex-wrap gap-1 text-[10px] text-base-content/60 font-medium">
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                    SV: {{ banner.title?.sv || '—' }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                    EN: {{ banner.title?.en || '—' }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                    AR: {{ banner.title?.ar || '—' }}
                  </span>
                </div>
              </div>

              <!-- Actions & Ordering Toolbar -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 w-full">
                <!-- Order controls -->
                <div class="flex items-center gap-1">
                  <span class="text-xs font-mono text-base-content/60 font-bold mr-1">#{{ banner.sortOrder ?? idx }}</span>
                  <button
                    type="button"
                    :disabled="idx === 0"
                    class="btn btn-ghost btn-xs btn-square border border-slate-200 dark:border-zinc-700 disabled:opacity-30"
                    @click="moveBanner(idx, 'up')"
                  >
                    <Icon name="lucide:arrow-up" class="size-3.5" />
                  </button>
                  <button
                    type="button"
                    :disabled="idx === filteredBanners.length - 1"
                    class="btn btn-ghost btn-xs btn-square border border-slate-200 dark:border-zinc-700 disabled:opacity-30"
                    @click="moveBanner(idx, 'down')"
                  >
                    <Icon name="lucide:arrow-down" class="size-3.5" />
                  </button>
                </div>

                <!-- Compact Action Buttons -->
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 font-bold gap-1.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/40"
                    :title="t('admin.banners.edit', 'Redigera')"
                    @click="openModal(banner)"
                  >
                    <Icon name="lucide:pencil" class="size-3.5" />
                    <span>{{ t('admin.banners.edit', 'Redigera') }}</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-error font-bold gap-1.5 rounded-xl hover:bg-error/10"
                    :title="t('admin.banners.delete', 'Ta bort')"
                    @click="handleDelete(banner)"
                  >
                    <Icon name="lucide:trash-2" class="size-3.5" />
                    <span>{{ t('admin.banners.delete', 'Ta bort') }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Edit/Add Modal -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box p-6 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-2xl rounded-2xl max-w-3xl text-base-content max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div class="flex items-center gap-2">
            <div class="size-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Icon :name="isEditing ? 'lucide:pencil' : 'lucide:plus'" class="size-4" />
            </div>
            <h3 class="font-bold text-lg text-base-content">
              {{ isEditing ? t('admin.banners.editTitle', 'Redigera kampanjbanner') : t('admin.banners.addTitle', 'Skapa kampanjbanner') }}
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
            @click="closeModal"
          >
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4 mt-4">
          <!-- Error Feedback -->
          <div v-if="errorMessage" class="alert alert-error text-sm shadow-sm py-2 rounded-xl">
            <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Upload Dropzone Section -->
          <div
            class="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border-2 space-y-3 transition-colors"
            :class="fieldErrors['imageUrl'] ? 'border-error bg-error/5 dark:bg-error/10' : 'border-slate-200 dark:border-zinc-700/60'"
          >
            <label class="label py-0">
              <span class="label-text font-bold text-xs">
                {{ t('admin.banners.form.desktopImage', 'Bannerbild för desktop (WebP)') }} *
              </span>
            </label>

            <!-- Image Preview if available -->
            <div v-if="form.imageUrl" class="relative w-full h-36 rounded-xl overflow-hidden bg-slate-900 border-2 border-brand-500/50 group">
              <img :src="form.imageUrl" alt="Preview" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  class="btn btn-sm btn-error text-white font-bold gap-1 rounded-xl shadow-md"
                  @click="form.imageUrl = ''"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                  {{ t('admin.products.remove', 'Ta bort bild') }}
                </button>
              </div>
            </div>

            <!-- Upload dropzone input -->
            <div
              v-else
              class="border-2 border-dashed rounded-xl p-6 text-center hover:border-brand-500 transition-colors bg-white dark:bg-zinc-800/80 cursor-pointer"
              :class="fieldErrors['imageUrl'] ? 'border-error' : 'border-slate-300 dark:border-zinc-600'"
              @click="fileInputRef?.click()"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                class="hidden"
                @change="handleFileUpload($event, false)"
              />
              <div v-if="isUploading" class="flex flex-col items-center justify-center gap-2">
                <span class="loading loading-spinner loading-md text-brand-500"></span>
                <span class="text-xs font-semibold text-brand-600 dark:text-brand-400">
                  {{ t('admin.banners.form.uploading', 'Laddar upp bild...') }}
                </span>
              </div>
              <div v-else class="flex flex-col items-center justify-center gap-2">
                <div class="size-10 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center text-base-content/70">
                  <Icon name="lucide:upload-cloud" class="size-5" />
                </div>
                <div class="text-sm font-bold text-base-content">
                  {{ t('admin.banners.form.uploadBtn', 'Klicka för att ladda upp bannerbild') }}
                </div>
                <p class="text-xs text-base-content/60">
                  {{ t('admin.banners.form.uploadHint', 'Rekommenderat bildförhållande 21:9 eller 16:9 (Max 10MB)') }}
                </p>
              </div>
            </div>

            <!-- Optional manual URL input fallback -->
            <div class="flex items-center gap-2 pt-1">
              <span class="text-[11px] font-semibold text-base-content/60">URL:</span>
              <input
                v-model="form.imageUrl"
                type="url"
                placeholder="https://pub-xxx.r2.dev/products/..."
                class="input input-xs input-bordered h-7 border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base-content rounded-lg font-mono text-[11px] flex-1"
                :class="{ '!border-error': fieldErrors['imageUrl'] }"
                @input="clearFieldError('imageUrl')"
              />
            </div>

            <div v-if="uploadError" class="text-xs font-semibold text-error">
              {{ uploadError }}
            </div>
            <div v-if="fieldErrors['imageUrl']" class="text-xs font-semibold text-error mt-1">
              {{ fieldErrors['imageUrl'] }}
            </div>
          </div>

          <!-- Multilingual Copy Sections (Stacked clean grid) -->
          <div class="space-y-3">
            <!-- English -->
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60 space-y-2">
              <div class="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-blue-500"></span>
                English Content
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div class="form-control md:col-span-2">
                  <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.titleEn', 'Titel (engelska)') }} *</span></label>
                  <input
                    v-model="form.title.en"
                    type="text"
                    required
                    placeholder="e.g. Authentic Spices & Pantry"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                    :class="{ '!border-error !ring-1 !ring-error': fieldErrors['title.en'] }"
                    @input="clearFieldError('title.en')"
                  />
                  <span v-if="fieldErrors['title.en']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['title.en'] }}</span>
                </div>
                <div class="form-control">
                  <label class="label py-0.5"><span class="label-text font-semibold text-[11px]">{{ t('admin.banners.form.badgeEn', 'Badge (valfritt)') }}</span></label>
                  <input
                    v-model="form.badge.en"
                    type="text"
                    placeholder="e.g. Special Deals"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full"
                  />
                </div>
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.subtitleEn', 'Underrubrik (engelska)') }} *</span></label>
                <input
                  v-model="form.subtitle.en"
                  type="text"
                  required
                  placeholder="e.g. Discover our hand-picked selection of premium Middle Eastern goods."
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                  :class="{ '!border-error !ring-1 !ring-error': fieldErrors['subtitle.en'] }"
                  @input="clearFieldError('subtitle.en')"
                />
                <span v-if="fieldErrors['subtitle.en']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['subtitle.en'] }}</span>
              </div>
            </div>

            <!-- Swedish -->
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60 space-y-2">
              <div class="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-amber-500"></span>
                Svenskt innehåll
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div class="form-control md:col-span-2">
                  <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.titleSv', 'Titel (svenska)') }} *</span></label>
                  <input
                    v-model="form.title.sv"
                    type="text"
                    required
                    placeholder="t.ex. Autentiska kryddor & orientaliskt skafferi"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                    :class="{ '!border-error !ring-1 !ring-error': fieldErrors['title.sv'] }"
                    @input="clearFieldError('title.sv')"
                  />
                  <span v-if="fieldErrors['title.sv']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['title.sv'] }}</span>
                </div>
                <div class="form-control">
                  <label class="label py-0.5"><span class="label-text font-semibold text-[11px]">{{ t('admin.banners.form.badgeSv', 'Badge (valfritt)') }}</span></label>
                  <input
                    v-model="form.badge.sv"
                    type="text"
                    placeholder="t.ex. Kampanj"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full"
                  />
                </div>
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.subtitleSv', 'Underrubrik (svenska)') }} *</span></label>
                <input
                  v-model="form.subtitle.sv"
                  type="text"
                  required
                  placeholder="t.ex. Upptäck vårt handplockade sortiment av baljväxter och kryddor."
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                  :class="{ '!border-error !ring-1 !ring-error': fieldErrors['subtitle.sv'] }"
                  @input="clearFieldError('subtitle.sv')"
                />
                <span v-if="fieldErrors['subtitle.sv']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['subtitle.sv'] }}</span>
              </div>
            </div>

            <!-- Arabic -->
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60 space-y-2">
              <div class="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-emerald-500"></span>
                المحتوى باللغة العربية
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div class="form-control md:col-span-2">
                  <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.titleAr', 'العنوان (بالعربية)') }} *</span></label>
                  <input
                    v-model="form.title.ar"
                    dir="rtl"
                    type="text"
                    required
                    placeholder="مثال: أجود منتجات المونة والبهارات الشرقية"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                    :class="{ '!border-error !ring-1 !ring-error': fieldErrors['title.ar'] }"
                    @input="clearFieldError('title.ar')"
                  />
                  <span v-if="fieldErrors['title.ar']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['title.ar'] }}</span>
                </div>
                <div class="form-control">
                  <label class="label py-0.5"><span class="label-text font-semibold text-[11px]">{{ t('admin.banners.form.badgeAr', 'الشارة (اختياري)') }}</span></label>
                  <input
                    v-model="form.badge.ar"
                    dir="rtl"
                    type="text"
                    placeholder="مثال: عروض حصرية"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full"
                  />
                </div>
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text font-bold text-[11px]">{{ t('admin.banners.form.subtitleAr', 'العنوان الفرعي (بالعربية)') }} *</span></label>
                <input
                  v-model="form.subtitle.ar"
                  dir="rtl"
                  type="text"
                  required
                  placeholder="مثال: اكتشف تشكيلة واسعة من البقوليات والزيوت المعصورة على البارد."
                  class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                  :class="{ '!border-error !ring-1 !ring-error': fieldErrors['subtitle.ar'] }"
                  @input="clearFieldError('subtitle.ar')"
                />
                <span v-if="fieldErrors['subtitle.ar']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['subtitle.ar'] }}</span>
              </div>
            </div>
          </div>

          <!-- Configuration: Link destination & Sort Order & Publishing -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
            <div class="form-control md:col-span-2">
              <label class="label py-0.5"><span class="label-text font-bold text-xs">{{ t('admin.banners.form.linkUrl', 'Mål-URL') }} *</span></label>
              <div class="relative">
                <input
                  v-model="form.linkUrl"
                  type="text"
                  required
                  placeholder="/catalog?category=sweets"
                  class="input input-bordered pl-8 h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-mono w-full transition-colors"
                  :class="{ '!border-error !ring-1 !ring-error': fieldErrors['linkUrl'] }"
                  @input="clearFieldError('linkUrl')"
                />
                <Icon name="lucide:link" class="absolute left-2.5 top-2.5 size-3.5 text-base-content/50" />
              </div>
              <span v-if="fieldErrors['linkUrl']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['linkUrl'] }}</span>
            </div>

            <div class="form-control">
              <label class="label py-0.5"><span class="label-text font-bold text-xs">{{ t('admin.banners.form.sortOrder', 'Sorteringsordning') }}</span></label>
              <input
                v-model.number="form.sortOrder"
                type="number"
                min="0"
                class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs font-mono w-full"
              />
            </div>
          </div>

          <!-- Scheduling & Active Toggle -->
          <div class="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-base-content">{{ t('admin.banners.form.isActive', 'Publicera banner i butiken') }}</span>
                <p class="text-[11px] text-base-content/60">Styr om bannern visas live för kunder</p>
              </div>
              <input
                v-model="form.isActive"
                type="checkbox"
                class="checkbox checkbox-primary rounded-lg"
              />
            </div>

            <div class="pt-2 border-t border-slate-200 dark:border-zinc-700/60">
              <span class="text-[11px] font-bold text-base-content/70 uppercase tracking-wider block mb-2">
                {{ t('admin.banners.form.scheduling', 'Schemaläggning (valfritt)') }}
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="form-control">
                  <label class="label py-0.5"><span class="label-text text-[11px] font-semibold">{{ t('admin.banners.form.startsAt', 'Starttid') }}</span></label>
                  <input
                    v-model="form.startsAt"
                    type="datetime-local"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full"
                    @input="clearFieldError('expiresAt')"
                  />
                </div>
                <div class="form-control">
                  <label class="label py-0.5"><span class="label-text text-[11px] font-semibold">{{ t('admin.banners.form.expiresAt', 'Sluttid') }}</span></label>
                  <input
                    v-model="form.expiresAt"
                    type="datetime-local"
                    class="input input-bordered h-9 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl text-xs w-full transition-colors"
                    :class="{ '!border-error !ring-1 !ring-error': fieldErrors['expiresAt'] }"
                    @input="clearFieldError('expiresAt')"
                  />
                  <span v-if="fieldErrors['expiresAt']" class="text-error text-[11px] font-semibold mt-0.5 block">{{ fieldErrors['expiresAt'] }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-action pt-4 border-t border-slate-200 dark:border-zinc-800 mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="btn btn-ghost font-bold rounded-xl text-base-content/75 hover:text-base-content"
              @click="closeModal"
            >
              {{ t('admin.banners.form.cancel', 'Avbryt') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold border-none shadow-sm rounded-xl gap-2 px-6"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ t('admin.banners.form.save', 'Spara banner') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Backdrop click to close -->
      <form method="dialog" class="modal-backdrop bg-neutral/40 backdrop-blur-xs" @submit="closeModal">
        <button class="sr-only">close</button>
      </form>
    </dialog>
  </div>
</template>
