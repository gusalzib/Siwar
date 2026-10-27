<!-- components/admin/ProductForm.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { toMinorUnits, toMajorUnits } from '~~/utils/currency'

interface Props {
  mode?: 'create' | 'edit'
  productId?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Active tab for multilingual translation fields
const activeLangTab = ref<'ar' | 'sv' | 'en'>('ar')

// Loading & feedback states
const isLoadingProduct = ref(props.mode === 'edit')
const isSubmitting = ref(false)
const isUploadingImage = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// Form State
const form = ref({
  name: { ar: '', sv: '', en: '' },
  description: { ar: '', sv: '', en: '' },
  ingredients: { ar: '', sv: '', en: '' },
  brand: '',
  category: '',
  prices: {
    SEK: '',
    EUR: '',
    USD: '',
  },
  discount: 0,
  discountStartsAt: '',
  discountExpiresAt: '',
  stockQuantity: 0,
  safetyBuffer: 5, // Default baseline buffer
  netQuantity: {
    value: 0,
    unit: 'g' as 'g' | 'kg' | 'ml' | 'l' | 'st',
  },
  grossWeight: 0,
  momsRate: 12 as 12 | 25,
  countryOfOrigin: '',
  barcode: '',
  allergens: [] as string[],
  nutritionTable: {
    energyKj: '' as string | number,
    energyKcal: '' as string | number,
    fat: '' as string | number,
    saturatedFat: '' as string | number,
    carbohydrates: '' as string | number,
    sugars: '' as string | number,
    protein: '' as string | number,
    salt: '' as string | number,
  },
  images: [] as Array<{ url: string; altText: string; isPrimary: boolean }>,
  isActive: true,
})

// Fetch Categories & Allergens
const { data: categories } = await useFetch<Array<{ id: string; name: Record<string, string> }>>('/api/admin/categories')
const { data: allergens } = await useFetch<Array<{ id: string; code: string; name: Record<string, string> }>>('/api/admin/allergens')

function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

function toDatetimeLocalString(date?: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Hydrate Existing Product Data (Edit Mode)
// ---------------------------------------------------------------------------
onMounted(async () => {
  if (props.mode === 'edit' && props.productId) {
    isLoadingProduct.value = true
    try {
      const existing = await $fetch<any>(`/api/admin/products/${props.productId}`)
      form.value = {
        name: existing.name || { ar: '', sv: '', en: '' },
        description: existing.description || { ar: '', sv: '', en: '' },
        ingredients: existing.ingredients || { ar: '', sv: '', en: '' },
        brand: existing.brand || '',
        category: existing.category || '',
        prices: {
          SEK: toMajorUnits(existing.price?.SEK ?? 0),
          EUR: toMajorUnits(existing.price?.EUR ?? 0),
          USD: toMajorUnits(existing.price?.USD ?? 0),
        },
        discount: existing.discount ?? 0,
        discountStartsAt: toDatetimeLocalString(existing.discountStartsAt),
        discountExpiresAt: toDatetimeLocalString(existing.discountExpiresAt),
        stockQuantity: existing.stockQuantity ?? 0,
        safetyBuffer: existing.safetyBuffer ?? 3,
        netQuantity: existing.netQuantity || { value: 0, unit: 'g' },
        grossWeight: existing.grossWeight ?? 0,
        momsRate: existing.momsRate ?? 12,
        countryOfOrigin: existing.countryOfOrigin || '',
        barcode: existing.barcode || '',
        allergens: existing.allergens || [],
        nutritionTable: {
          energyKj: existing.nutritionTable?.energyKj ?? '',
          energyKcal: existing.nutritionTable?.energyKcal ?? '',
          fat: existing.nutritionTable?.fat ?? '',
          saturatedFat: existing.nutritionTable?.saturatedFat ?? '',
          carbohydrates: existing.nutritionTable?.carbohydrates ?? '',
          sugars: existing.nutritionTable?.sugars ?? '',
          protein: existing.nutritionTable?.protein ?? '',
          salt: existing.nutritionTable?.salt ?? '',
        },
        images: existing.images || [],
        isActive: existing.isActive !== false,
      }
    } catch (err: any) {
      errorMessage.value = err?.data?.statusMessage || err?.message || 'Failed to load product details'
    } finally {
      isLoadingProduct.value = false
    }
  }
})

// ---------------------------------------------------------------------------
// Real-Time Discounted Price Calculation
// ---------------------------------------------------------------------------
const discountedPricePreview = computed(() => {
  const discount = Math.max(0, Math.min(100, Number(form.value.discount) || 0))
  if (discount <= 0) return null

  const calculateDiscounted = (priceStr: string) => {
    const price = parseFloat(priceStr)
    if (isNaN(price) || price <= 0) return '0.00'
    return (price * (1 - discount / 100)).toFixed(2)
  }

  const calculateSavings = (priceStr: string) => {
    const price = parseFloat(priceStr)
    if (isNaN(price) || price <= 0) return '0.00'
    return (price * (discount / 100)).toFixed(2)
  }

  const now = new Date()
  let scheduleStatus: 'active' | 'scheduled' | 'expired' = 'active'
  if (form.value.discountStartsAt) {
    const s = new Date(form.value.discountStartsAt)
    if (!Number.isNaN(s.getTime()) && s > now) {
      scheduleStatus = 'scheduled'
    }
  }
  if (form.value.discountExpiresAt) {
    const e = new Date(form.value.discountExpiresAt)
    if (!Number.isNaN(e.getTime()) && e <= now) {
      scheduleStatus = 'expired'
    }
  }

  return {
    discount,
    scheduleStatus,
    SEK: calculateDiscounted(form.value.prices.SEK),
    EUR: calculateDiscounted(form.value.prices.EUR),
    USD: calculateDiscounted(form.value.prices.USD),
    savingsSEK: calculateSavings(form.value.prices.SEK),
    savingsEUR: calculateSavings(form.value.prices.EUR),
    savingsUSD: calculateSavings(form.value.prices.USD),
  }
})

// ---------------------------------------------------------------------------
// Image Management & Upload Pipeline
// ---------------------------------------------------------------------------
function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploadingImage.value = true
  errorMessage.value = ''

  try {
    const uploadData = new FormData()
    uploadData.append('file', file)

    const response = await $fetch<{ url: string }>('/api/admin/upload', {
      method: 'POST',
      body: uploadData,
    })

    const isFirstImage = form.value.images.length === 0
    form.value.images.push({
      url: response.url,
      altText: form.value.name[locale.value] || form.value.brand || '',
      isPrimary: isFirstImage,
    })
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || t('admin.productForm.images.uploadError')
  } finally {
    isUploadingImage.value = false
    if (target) target.value = ''
  }
}

function removeImageField(index: number) {
  form.value.images.splice(index, 1)
  if (form.value.images.length > 0 && !form.value.images.some((img) => img.isPrimary)) {
    const firstRemaining = form.value.images[0]
    if (firstRemaining) {
      firstRemaining.isPrimary = true
    }
  }
}

function setPrimaryImage(index: number) {
  form.value.images.forEach((img, i) => {
    img.isPrimary = i === index
  })
}

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------
async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    const parseNum = (v: string | number) => (v !== '' && v !== null && !isNaN(Number(v)) ? Number(v) : undefined)

    const hasNutritionData = Object.values(form.value.nutritionTable).some(
      (val) => val !== '' && val !== null && val !== undefined
    )

    const payload = {
      name: form.value.name,
      description: form.value.description,
      ingredients: form.value.ingredients,
      brand: form.value.brand,
      category: form.value.category,
      price: {
        SEK: toMinorUnits(form.value.prices.SEK),
        EUR: toMinorUnits(form.value.prices.EUR),
        USD: toMinorUnits(form.value.prices.USD),
      },
      discount: Number(form.value.discount) || 0,
      discountStartsAt: form.value.discountStartsAt ? new Date(form.value.discountStartsAt).toISOString() : null,
      discountExpiresAt: form.value.discountExpiresAt ? new Date(form.value.discountExpiresAt).toISOString() : null,
      stockQuantity: Number(form.value.stockQuantity),
      safetyBuffer: Number(form.value.safetyBuffer),
      netQuantity: {
        value: Number(form.value.netQuantity.value),
        unit: form.value.netQuantity.unit,
      },
      grossWeight: Number(form.value.grossWeight),
      momsRate: Number(form.value.momsRate),
      countryOfOrigin: form.value.countryOfOrigin,
      barcode: form.value.barcode || undefined,
      allergens: form.value.allergens,
      nutritionTable: hasNutritionData
        ? {
            energyKj: parseNum(form.value.nutritionTable.energyKj),
            energyKcal: parseNum(form.value.nutritionTable.energyKcal),
            fat: parseNum(form.value.nutritionTable.fat),
            saturatedFat: parseNum(form.value.nutritionTable.saturatedFat),
            carbohydrates: parseNum(form.value.nutritionTable.carbohydrates),
            sugars: parseNum(form.value.nutritionTable.sugars),
            protein: parseNum(form.value.nutritionTable.protein),
            salt: parseNum(form.value.nutritionTable.salt),
          }
        : undefined,
      images: form.value.images.filter((img) => img.url.trim() !== ''),
      isActive: form.value.isActive,
    }

    if (props.mode === 'edit' && props.productId) {
      await $fetch(`/api/admin/products/${props.productId}`, {
        method: 'PUT' as any,
        body: payload,
      })
    } else {
      await $fetch('/api/admin/products', {
        method: 'POST',
        body: payload,
      })
    }

    await navigateTo(localePath('/admin/products'))
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.data?.message || t('admin.productForm.feedback.error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-6 md:p-10">
    <div class="mx-auto max-w-5xl space-y-6">
      <!-- Loading Skeleton (Edit Mode) -->
      <div v-if="isLoadingProduct" class="flex flex-col items-center justify-center py-20">
        <span class="loading loading-spinner loading-lg text-brand-500"></span>
        <p class="mt-4 text-sm text-base-content/60">{{ t('admin.productForm.loading', 'Laddar produkt...') }}</p>
      </div>

      <template v-else>
        <!-- Top Bar -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <NuxtLink
              :to="localePath('/admin/products')"
              class="btn border-2 border-base-content/20 bg-transparent hover:bg-brand-500 hover:border-brand-500 hover:text-white text-base-content btn-sm gap-2 transition-all"
            >
              <Icon name="lucide:arrow-left" class="size-4" />
              {{ t('admin.productForm.backToList') }}
            </NuxtLink>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <h1 class="text-2xl font-bold tracking-tight text-base-content">
                <template v-if="mode === 'edit'">
                  {{ t('admin.productForm.editTitle', 'Redigera produkt') }}: {{ getLocalizedText(form.name) }}
                </template>
                <template v-else>
                  {{ t('admin.productForm.newTitle') }}
                </template>
              </h1>
              <span
                v-if="form.discount > 0"
                class="badge badge-error text-white font-bold gap-1 shadow-xs px-2.5 py-1 text-xs"
              >
                <Icon name="lucide:flame" class="size-3.5" />
                -{{ form.discount }}% {{ t('admin.productForm.fields.discountActive') }}
              </span>
            </div>
            <p class="text-sm text-base-content/60">
              {{ mode === 'edit' ? t('admin.productForm.editSubtitle', 'Uppdatera priser, lagerbuffert, beskrivningar och media.') : t('admin.productForm.newSubtitle') }}
            </p>
          </div>
        </div>

        <!-- Alerts -->
        <div v-if="errorMessage" class="alert alert-error shadow-sm" role="alert">
          <Icon name="lucide:alert-circle" class="size-5 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="alert alert-success shadow-sm" role="alert">
          <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
          <span>{{ successMessage }}</span>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- 1. Multilingual Content Card -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between border-b border-base-200 pb-3 gap-3">
                <h2 class="card-title text-base font-semibold">
                  {{ t('admin.productForm.sections.general') }}
                </h2>
                <!-- Language Switch Tabs -->
                <div class="flex flex-wrap items-center gap-1 p-2 bg-base-200/50 rounded-xl border border-base-300 w-full lg:w-auto">
                  <div class="px-2 text-base-content/40 flex items-center justify-center">
                    <Icon name="lucide:languages" class="size-4" />
                  </div>
                  <button
                    type="button"
                    @click="activeLangTab = 'ar'"
                    :class="['btn btn-sm border-none rounded-lg font-medium transition-all shadow-none', activeLangTab === 'ar' ? 'bg-brand-500 p-2 text-white hover:bg-brand-600 !shadow-sm' : 'bg-transparent text-base-content/60 hover:bg-base-200 hover:text-base-content']"
                  >
                    {{ t('admin.productForm.tabs.ar') }}
                  </button>
                  <button
                    type="button"
                    @click="activeLangTab = 'sv'"
                    :class="['btn btn-sm border-none rounded-lg font-medium transition-all shadow-none', activeLangTab === 'sv' ? 'bg-brand-500 p-2 text-white hover:bg-brand-600 !shadow-sm' : 'bg-transparent text-base-content/60 hover:bg-base-200 hover:text-base-content']"
                  >
                    {{ t('admin.productForm.tabs.sv') }}
                  </button>
                  <button
                    type="button"
                    @click="activeLangTab = 'en'"
                    :class="['btn btn-sm border-none rounded-lg font-medium transition-all shadow-none', activeLangTab === 'en' ? 'bg-brand-500 p-2 text-white hover:bg-brand-600 !shadow-sm' : 'bg-transparent text-base-content/60 hover:bg-base-200 hover:text-base-content']"
                  >
                    {{ t('admin.productForm.tabs.en') }}
                  </button>
                </div>
              </div>

              <!-- Name Field -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.name') }} ({{ activeLangTab.toUpperCase() }}) *</span>
                </label>
                <input
                  v-model="form.name[activeLangTab]"
                  type="text"
                  required
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  :placeholder="t('admin.productForm.fields.namePlaceholder')"
                  class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                />
              </div>

              <!-- Description Field -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.description') }} ({{ activeLangTab.toUpperCase() }}) *</span>
                </label>
                <textarea
                  v-model="form.description[activeLangTab]"
                  rows="3"
                  required
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  :placeholder="t('admin.productForm.fields.descriptionPlaceholder')"
                  class="textarea textarea-bordered p-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                ></textarea>
              </div>

              <!-- Ingredients Field -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.ingredients') }} ({{ activeLangTab.toUpperCase() }})</span>
                </label>
                <textarea
                  v-model="form.ingredients[activeLangTab]"
                  rows="2"
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  :placeholder="t('admin.productForm.fields.ingredientsPlaceholder')"
                  class="textarea textarea-bordered p-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                ></textarea>
              </div>

              <!-- Brand & Category -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.brand') }} *</span>
                  </label>
                  <input
                    v-model="form.brand"
                    type="text"
                    required
                    :placeholder="t('admin.productForm.fields.brandPlaceholder')"
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>

                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.category') }} *</span>
                  </label>
                  <select
                    v-model="form.category"
                    required
                    class="select select-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  >
                    <option disabled value="">{{ t('admin.productForm.fields.categorySelect') }}</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                      {{ getLocalizedText(cat.name) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Independent Multi-Currency Pricing (AC-1) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.pricing') }}
              </h2>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <!-- SEK -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.priceSEK') }} *</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.prices.SEK"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="45.00"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-12 font-mono"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">SEK</span>
                  </div>
                </div>

                <!-- EUR -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.priceEUR') }} *</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.prices.EUR"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="4.50"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-12 font-mono"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">EUR</span>
                  </div>
                </div>

                <!-- USD -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.priceUSD') }} *</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.prices.USD"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="5.00"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-12 font-mono"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">USD</span>
                  </div>
                </div>
              </div>

              <!-- Discount Configuration & Real-Time Preview -->
              <div class="pt-4 border-t border-base-200 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 class="font-semibold text-sm text-base-content flex items-center gap-2">
                      <Icon name="lucide:percent" class="size-4 text-error" />
                      {{ t('admin.productForm.fields.discount') }}
                    </h3>
                    <p class="text-xs text-base-content/60 mt-0.5">
                      {{ t('admin.productForm.fields.discountHelp') }}
                    </p>
                  </div>

                  <!-- Quick Percentage Presets -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button
                      v-for="preset in [0, 10, 15, 20, 25, 50]"
                      :key="preset"
                      type="button"
                      @click="form.discount = preset"
                      :class="[
                        'btn btn-xs rounded-lg transition-all h-7 min-h-0 px-2.5 py-1 text-xs font-medium',
                        form.discount === preset
                          ? 'btn-error dark:text-white text-black font-bold shadow-xs'
                          : 'bg-base-200 hover:bg-base-300 border border-base-300 text-base-content hover:text-base-content'
                      ]"
                    >
                      {{ preset === 0 ? t('admin.productForm.fields.discountNone') : `-${preset}%` }}
                    </button>
                  </div>
                </div>

                <!-- Input with percentage suffix -->
                <div class="max-w-xs">
                  <div class="relative">
                    <input
                      v-model.number="form.discount"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="0"
                      class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full pe-10 font-mono font-semibold"
                    />
                    <span class="absolute inset-y-0 end-0 flex items-center pe-3 text-sm font-bold text-base-content/50 pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                <!-- Campaign Scheduling & Deadline Fields (FR-1, FR-6, FR-12) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <!-- Discount Start Date -->
                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-base-content flex items-center justify-between">
                      <span class="flex items-center gap-1.5">
                        <Icon name="lucide:calendar-clock" class="size-3.5 text-primary" />
                        {{ t('admin.productForm.fields.discountStartsAt', 'Kampanj startdatum') }}
                      </span>
                      <button
                        v-if="form.discountStartsAt"
                        type="button"
                        class="text-[11px] text-base-content/50 hover:text-error underline"
                        @click="form.discountStartsAt = ''"
                      >
                        {{ t('admin.productForm.fields.clearDate', 'Rensa') }}
                      </button>
                    </label>
                    <input
                      v-model="form.discountStartsAt"
                      type="datetime-local"
                      class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full text-xs font-mono"
                    />
                    <p class="text-[11px] text-base-content/50">
                      {{ t('admin.productForm.fields.discountStartsAtHelp', 'Lämna tomt för att starta omedelbart') }}
                    </p>
                  </div>

                  <!-- Discount Expiration Deadline -->
                  <div class="space-y-1.5">
                    <label class="block text-xs font-semibold text-base-content flex items-center justify-between">
                      <span class="flex items-center gap-1.5">
                        <Icon name="lucide:timer" class="size-3.5 text-error" />
                        {{ t('admin.productForm.fields.discountExpiresAt', 'Kampanj slutdatum (Deadline)') }}
                      </span>
                      <button
                        v-if="form.discountExpiresAt"
                        type="button"
                        class="text-[11px] text-base-content/50 hover:text-error underline"
                        @click="form.discountExpiresAt = ''"
                      >
                        {{ t('admin.productForm.fields.clearDate', 'Rensa') }}
                      </button>
                    </label>
                    <input
                      v-model="form.discountExpiresAt"
                      type="datetime-local"
                      class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full text-xs font-mono"
                    />
                    <p class="text-[11px] text-base-content/50">
                      {{ t('admin.productForm.fields.discountExpiresAtHelp', 'Lämna tomt för att gälla tillsvidare') }}
                    </p>
                  </div>
                </div>

                <!-- Live Discounted Price Preview Card -->
                <div
                  v-if="discountedPricePreview"
                  class="rounded-xl border border-error/30 bg-error/5 dark:bg-error/10 p-4 space-y-3"
                >
                  <div class="flex items-center justify-between flex-wrap gap-2 border-b border-error/20 pb-2.5">
                    <div class="flex items-center gap-2">
                      <span class="badge badge-error text-white font-black text-xs">
                        -{{ discountedPricePreview.discount }}%
                      </span>
                      <span class="text-xs font-bold uppercase tracking-wider text-error">
                        {{ t('admin.productForm.fields.discountPreviewTitle') }}
                      </span>
                      <!-- Campaign Status Badge -->
                      <span
                        v-if="discountedPricePreview.scheduleStatus === 'active'"
                        class="badge badge-sm badge-success text-white font-bold"
                      >
                        {{ t('admin.productForm.fields.campaignActive', 'Aktiv') }}
                      </span>
                      <span
                        v-else-if="discountedPricePreview.scheduleStatus === 'scheduled'"
                        class="badge badge-sm badge-warning text-black font-bold"
                      >
                        {{ t('admin.productForm.fields.campaignScheduled', 'Schemalagd') }}
                      </span>
                      <span
                        v-else-if="discountedPricePreview.scheduleStatus === 'expired'"
                        class="badge badge-sm badge-neutral font-bold"
                      >
                        {{ t('admin.productForm.fields.campaignExpired', 'Avslutad') }}
                      </span>
                    </div>
                    <span class="text-[11px] text-base-content/60 font-medium">
                      {{ t('admin.productForm.fields.discountPreviewNote') }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <!-- SEK Preview -->
                    <div class="bg-base-100/90 rounded-lg p-3 border border-base-200">
                      <div class="text-[11px] font-medium text-base-content/60">SEK (Sverige)</div>
                      <div class="flex items-baseline gap-2 mt-1">
                        <span class="text-lg font-black font-mono text-error">
                          {{ discountedPricePreview.SEK }}
                        </span>
                        <span class="text-xs font-mono text-base-content/40 line-through">
                          {{ form.prices.SEK || '0.00' }}
                        </span>
                      </div>
                      <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        {{ t('admin.productForm.fields.customerSaves') }}: {{ discountedPricePreview.savingsSEK }} SEK
                      </div>
                    </div>

                    <!-- EUR Preview -->
                    <div class="bg-base-100/90 rounded-lg p-3 border border-base-200">
                      <div class="text-[11px] font-medium text-base-content/60">EUR (Europa)</div>
                      <div class="flex items-baseline gap-2 mt-1">
                        <span class="text-lg font-black font-mono text-error">
                          {{ discountedPricePreview.EUR }}
                        </span>
                        <span class="text-xs font-mono text-base-content/40 line-through">
                          {{ form.prices.EUR || '0.00' }}
                        </span>
                      </div>
                      <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        {{ t('admin.productForm.fields.customerSaves') }}: {{ discountedPricePreview.savingsEUR }} EUR
                      </div>
                    </div>

                    <!-- USD Preview -->
                    <div class="bg-base-100/90 rounded-lg p-3 border border-base-200">
                      <div class="text-[11px] font-medium text-base-content/60">USD (Global)</div>
                      <div class="flex items-baseline gap-2 mt-1">
                        <span class="text-lg font-black font-mono text-error">
                          {{ discountedPricePreview.USD }}
                        </span>
                        <span class="text-xs font-mono text-base-content/40 line-through">
                          {{ form.prices.USD || '0.00' }}
                        </span>
                      </div>
                      <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        {{ t('admin.productForm.fields.customerSaves') }}: {{ discountedPricePreview.savingsUSD }} USD
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="text-xs text-base-content/50 italic flex items-center gap-1.5">
                  <Icon name="lucide:info" class="size-3.5" />
                  {{ t('admin.productForm.fields.noDiscountNotice') }}
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Inventory & Omnichannel Safety Buffer (AC-3) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.inventory') }}
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Physical Stock -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.stockQuantity') }} *</span>
                  </label>
                  <input
                    v-model="form.stockQuantity"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>

                <!-- Safety Buffer Override -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.safetyBuffer') }} *</span>
                  </label>
                  <input
                    v-model="form.safetyBuffer"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                  <label class="label">
                    <span class="label-text-alt text-base-content/60 block whitespace-normal break-words">{{ t('admin.productForm.fields.safetyBufferHelp') }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Specifications & Legal Tax Classification -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.specs') }}
              </h2>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <!-- Net Quantity Value -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.netValue') }} *</span>
                  </label>
                  <input
                    v-model="form.netQuantity.value"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="500"
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>

                <!-- Unit -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.netUnit') }} *</span>
                  </label>
                  <select v-model="form.netQuantity.unit" required class="select select-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full">
                    <option value="g">g (gram)</option>
                    <option value="kg">kg (kilogram)</option>
                    <option value="ml">ml (milliliter)</option>
                    <option value="l">l (liter)</option>
                    <option value="st">st (pieces)</option>
                  </select>
                </div>

                <!-- Gross Shipping Weight -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.grossWeight') }} *</span>
                  </label>
                  <input
                    v-model="form.grossWeight"
                    type="number"
                    min="0"
                    required
                    placeholder="550"
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <!-- Moms Rate -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.momsRate') }} *</span>
                  </label>
                  <select v-model="form.momsRate" required class="select select-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full">
                    <option :value="12">{{ t('admin.productForm.fields.moms12') }}</option>
                    <option :value="25">{{ t('admin.productForm.fields.moms25') }}</option>
                  </select>
                </div>

                <!-- Country of Origin -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.countryOfOrigin') }}</span>
                  </label>
                  <input
                    v-model="form.countryOfOrigin"
                    type="text"
                    :placeholder="t('admin.productForm.fields.countryPlaceholder')"
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>

                <!-- Barcode -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.barcode') }}</span>
                  </label>
                  <input
                    v-model="form.barcode"
                    type="text"
                    :placeholder="t('admin.productForm.fields.barcodePlaceholder')"
                    class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Allergens Declarations -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-3">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.allergens') }}
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                <label
                  v-for="allergen in allergens"
                  :key="allergen.id"
                  class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-200 p-2.5 hover:bg-base-200/40"
                >
                  <input
                    v-model="form.allergens"
                    type="checkbox"
                    :value="allergen.id"
                    class="checkbox checkbox-primary checkbox-sm border-2 border-base-content/40"
                  />
                  <span class="label-text text-xs font-medium">
                    {{ getLocalizedText(allergen.name) }}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- 6. Nutritional Table per 100g/ml (Optional) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <div class="flex items-center justify-between border-b border-base-200 pb-3">
                <div>
                  <h2 class="card-title text-base font-semibold">
                    {{ t('admin.productForm.sections.nutrition', 'Näringsdeklaration per 100g / 100ml (Valfritt)') }}
                  </h2>
                  <p class="text-xs text-base-content/60 mt-0.5">
                    {{ t('admin.productForm.fields.nutritionHelp', 'Fylls i för livsmedel. Lämna tomt om näringsvärden visas direkt på förpackningsbilden.') }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- Energy kJ -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.energyKj', 'Energi (kJ)') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.energyKj"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="1850"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-10 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">kJ</span>
                  </div>
                </div>

                <!-- Energy kcal -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.energyKcal', 'Energi (kcal)') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.energyKcal"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="440"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-12 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">kcal</span>
                  </div>
                </div>

                <!-- Fat -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.fat', 'Fett') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.fat"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="18.5"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>

                <!-- Saturated Fat -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.saturatedFat', 'varav mättat fett') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.saturatedFat"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="2.1"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>

                <!-- Carbohydrates -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.carbohydrates', 'Kolhydrater') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.carbohydrates"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="58.0"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>

                <!-- Sugars -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.sugars', 'varav sockerarter') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.sugars"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="32.0"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>

                <!-- Protein -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.protein', 'Protein') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.protein"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="8.5"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>

                <!-- Salt -->
                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium text-xs">{{ t('admin.products.nutrition.salt', 'Salt') }}</span>
                  </label>
                  <div class="relative">
                    <input
                      v-model="form.nutritionTable.salt"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.05"
                      class="input input-bordered px-4 border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full pr-8 font-mono text-sm"
                    />
                    <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-base-content/40">g</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 7. Product Photography (Direct R2 Upload Pipeline) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <div class="flex items-center justify-between border-b border-base-200 pb-3">
                <h2 class="card-title text-base font-semibold">
                  {{ t('admin.productForm.images.title') }}
                </h2>
                <div>
                  <!-- Hidden Native File Input -->
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    class="hidden"
                    @change="handleFileUpload"
                  />
                  <button
                    type="button"
                    :disabled="isUploadingImage"
                    @click="triggerFileInput"
                    class="btn border-2 border-gold-400 bg-transparent text-gold-500 hover:bg-gold-400 hover:border-gold-400 hover:!text-white btn-sm px-4 py-7 gap-2 transition-all disabled:opacity-50"
                  >
                    <span v-if="isUploadingImage" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else name="lucide:upload" class="size-4" />
                    {{ isUploadingImage ? t('admin.productForm.images.uploading') : t('admin.productForm.images.uploadButton') }}
                  </button>
                </div>
              </div>

              <!-- Empty State Dropzone -->
              <div
                v-if="form.images.length === 0"
                @click="triggerFileInput"
                class="border-2 border-dashed border-base-content/20 hover:border-brand-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-base-200/20"
              >
                <div class="flex flex-col items-center justify-center gap-2">
                  <div class="p-3 bg-base-100 rounded-full shadow-sm text-base-content/60">
                    <Icon name="lucide:image-plus" class="size-6" />
                  </div>
                  <p class="text-sm font-medium text-base-content">
                    {{ t('admin.productForm.images.dropzone') }}
                  </p>
                  <p class="text-xs text-base-content/50">
                    {{ t('admin.productForm.images.noImages') }}
                  </p>
                </div>
              </div>

              <!-- Uploaded Image Gallery Grid -->
              <div v-else class="space-y-3">
                <div
                  v-for="(img, idx) in form.images"
                  :key="img.url"
                  class="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl border border-base-200 bg-base-100 shadow-sm"
                >
                  <!-- Thumbnail Preview -->
                  <div class="relative size-16 shrink-0 rounded-lg overflow-hidden bg-base-200 border border-base-200">
                    <img :src="img.url" :alt="img.altText" class="size-full object-cover" />
                    <span
                      v-if="img.isPrimary"
                      class="absolute top-1 left-1 badge badge-xs badge-primary font-bold shadow"
                    >
                      ★
                    </span>
                  </div>

                  <!-- Alt Text Input -->
                  <div class="flex-1 w-full sm:w-auto">
                    <label class="sr-only">Alt Text</label>
                    <input
                      v-model="img.altText"
                      type="text"
                      :placeholder="t('admin.productForm.images.altPlaceholder')"
                      class="input input-bordered px-4 input-sm w-full text-xs"
                    />
                    <div class="text-[10px] text-base-content/40 font-mono truncate mt-1">
                      {{ img.url }}
                    </div>
                  </div>

                  <!-- Primary Radio Selector -->
                  <label class="label cursor-pointer gap-2 shrink-0">
                    <input
                      type="radio"
                      name="primary_product_photo"
                      :checked="img.isPrimary"
                      @change="setPrimaryImage(idx)"
                      class="radio radio-primary radio-sm"
                    />
                    <span class="label-text text-xs font-medium">
                      {{ t('admin.productForm.images.setAsPrimary') }}
                    </span>
                  </label>

                  <!-- Delete Image Button -->
                  <button
                    type="button"
                    @click="removeImageField(idx)"
                    class="btn btn-ghost btn-sm text-error shrink-0"
                    :title="t('admin.productForm.images.remove')"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 8. Publication Status -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body">
              <label class="label cursor-pointer justify-start gap-4">
                <input
                  v-model="form.isActive"
                  type="checkbox"
                  class="checkbox checkbox-primary border-2 border-base-content/40"
                />
                <span class="label-text font-semibold text-sm">
                  {{ t('admin.productForm.fields.isActive') }}
                </span>
              </label>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-base-200">
            <NuxtLink :to="localePath('/admin/products')" class="btn bg-transparent border-none text-base-content/70 hover:bg-error/20 hover:text-error transition-colors gap-2 px-6">
              <Icon name="lucide:x" class="size-4" />
              {{ t('admin.productForm.actions.cancel') }}
            </NuxtLink>
            <button
              type="submit"
              :disabled="isSubmitting || isUploadingImage"
              class="btn bg-brand-500 border-none text-white hover:bg-brand-600 shadow-sm gap-2 px-8 transition-all"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ isSubmitting ? t('admin.productForm.actions.submitting') : (mode === 'edit' ? t('admin.productForm.actions.save', t('admin.productForm.actions.submit')) : t('admin.productForm.actions.submit')) }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
