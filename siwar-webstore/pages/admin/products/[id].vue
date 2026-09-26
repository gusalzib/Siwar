<!-- pages/admin/products/[id].vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { toMinorUnits, toMajorUnits } from '../../../utils/currency.ts'

definePageMeta({
  middleware: 'admin',
})

const route = useRoute()
const productId = String(route.params.id)
const { t, locale } = useI18n()

// Active tab for multilingual translation fields
const activeLangTab = ref<'ar' | 'sv' | 'en'>('ar')

// Loading & feedback states
const isLoadingProduct = ref(true)
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
  stockQuantity: 0,
  safetyBuffer: 3,
  netQuantity: {
    value: 0,
    unit: 'g' as 'g' | 'kg' | 'ml' | 'l' | 'st',
  },
  grossWeight: 0,
  momsRate: 12 as 12 | 25,
  countryOfOrigin: '',
  barcode: '',
  allergens: [] as string[],
  images: [] as Array<{ url: string; altText: string; isPrimary: boolean }>,
  isActive: true,
})

// Fetch metadata options
const { data: categories } = await useFetch<Array<{ id: string; name: Record<string, string> }>>('/api/admin/categories')
const { data: allergens } = await useFetch<Array<{ id: string; code: string; name: Record<string, string> }>>('/api/admin/allergens')

function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// ---------------------------------------------------------------------------
// Hydrate Existing Product Data
// ---------------------------------------------------------------------------
onMounted(async () => {
  try {
    const existing = await $fetch<any>(`/api/admin/products/${productId}`)

    form.value = {
      name: existing.name || { ar: '', sv: '', en: '' },
      description: existing.description || { ar: '', sv: '', en: '' },
      ingredients: existing.ingredients || { ar: '', sv: '', en: '' },
      brand: existing.brand || '',
      category: existing.category || '',
      prices: {
        // toMajorUnits already returns the decimal string (e.g. 4500 -> "45.00")
        SEK: toMajorUnits(existing.price?.SEK ?? 0),
        EUR: toMajorUnits(existing.price?.EUR ?? 0),
        USD: toMajorUnits(existing.price?.USD ?? 0),
      },
      discount: existing.discount || 0,
      stockQuantity: existing.stockQuantity || 0,
      safetyBuffer: existing.safetyBuffer ?? 3,
      netQuantity: existing.netQuantity || { value: 0, unit: 'g' },
      grossWeight: existing.grossWeight || 0,
      momsRate: existing.momsRate || 12,
      countryOfOrigin: existing.countryOfOrigin || '',
      barcode: existing.barcode || '',
      allergens: existing.allergens || [],
      images: existing.images || [],
      isActive: existing.isActive !== false,
    }
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || 'Failed to load product details'
  } finally {
    isLoadingProduct.value = false
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
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Failed to upload image'
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
      images: form.value.images.filter((img) => img.url.trim() !== ''),
      isActive: form.value.isActive,
    }

    await $fetch(`/api/admin/products/${productId}`, {
      method: 'PUT',
      body: payload,
    })

    await navigateTo('/admin/products')
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.data?.message || 'Failed to update product'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-6 md:p-10">
    <div class="mx-auto max-w-5xl space-y-6">
      <!-- Loading Skeleton -->
      <div v-if="isLoadingProduct" class="flex flex-col items-center justify-center py-20">
        <span class="loading loading-spinner loading-lg text-brand-500"></span>
        <p class="mt-4 text-sm text-base-content/60">Loading product...</p>
      </div>

      <template v-else>
        <!-- Top Bar -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <NuxtLink to="/admin/products" class="btn border-2 border-base-content/20 bg-transparent hover:bg-brand-500 hover:border-brand-500 hover:text-white text-base-content btn-sm gap-2 transition-all">
              <Icon name="lucide:arrow-left" class="size-4" />
              {{ t('admin.productForm.backToList') }}
            </NuxtLink>
            <h1 class="text-2xl font-bold tracking-tight text-base-content mt-2">
              Edit Product: {{ getLocalizedText(form.name) }}
            </h1>
            <p class="text-sm text-base-content/60">
              Update pricing, stock buffers, descriptions, and media.
            </p>
          </div>
        </div>

        <!-- Alerts -->
        <div v-if="errorMessage" class="alert alert-error shadow-sm" role="alert">
          <Icon name="lucide:alert-circle" class="size-5 shrink-0" />
          <span>{{ errorMessage }}</span>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- 1. Multilingual Content Card -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <div class="flex items-center justify-between border-b border-base-200 pb-3">
                <h2 class="card-title text-base font-semibold">
                  {{ t('admin.productForm.sections.general') }}
                </h2>
                <div class="tabs tabs-boxed">
                  <button
                    type="button"
                    @click="activeLangTab = 'ar'"
                    :class="['tab tab-sm font-semibold transition-colors', activeLangTab === 'ar' ? 'tab-active !bg-brand-500 !text-white' : 'hover:text-brand-500']"
                  >
                    {{ t('admin.productForm.tabs.ar') }}
                  </button>
                  <button
                    type="button"
                    @click="activeLangTab = 'sv'"
                    :class="['tab tab-sm font-semibold transition-colors', activeLangTab === 'sv' ? 'tab-active !bg-brand-500 !text-white' : 'hover:text-brand-500']"
                  >
                    {{ t('admin.productForm.tabs.sv') }}
                  </button>
                  <button
                    type="button"
                    @click="activeLangTab = 'en'"
                    :class="['tab tab-sm font-semibold transition-colors', activeLangTab === 'en' ? 'tab-active !bg-brand-500 !text-white' : 'hover:text-brand-500']"
                  >
                    {{ t('admin.productForm.tabs.en') }}
                  </button>
                </div>
              </div>

              <!-- Name -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.name') }} ({{ activeLangTab.toUpperCase() }}) *</span>
                </label>
                <input
                  v-model="form.name[activeLangTab]"
                  type="text"
                  required
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                />
              </div>

              <!-- Description -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.description') }} ({{ activeLangTab.toUpperCase() }}) *</span>
                </label>
                <textarea
                  v-model="form.description[activeLangTab]"
                  rows="3"
                  required
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  class="textarea textarea-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                ></textarea>
              </div>

              <!-- Ingredients -->
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text font-medium">{{ t('admin.productForm.fields.ingredients') }} ({{ activeLangTab.toUpperCase() }})</span>
                </label>
                <textarea
                  v-model="form.ingredients[activeLangTab]"
                  rows="2"
                  :dir="activeLangTab === 'ar' ? 'rtl' : 'ltr'"
                  class="textarea textarea-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
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
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  />
                </div>

                <div class="form-control w-full">
                  <label class="label">
                    <span class="label-text font-medium">{{ t('admin.productForm.fields.category') }} *</span>
                  </label>
                  <select
                    v-model="form.category"
                    required
                    class="select select-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors w-full"
                  >
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                      {{ getLocalizedText(cat.name) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Multi-Currency Pricing -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.pricing') }}
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">SEK *</span></label>
                  <input
                    v-model="form.prices.SEK"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full font-mono"
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">EUR *</span></label>
                  <input
                    v-model="form.prices.EUR"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full font-mono"
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">USD *</span></label>
                  <input
                    v-model="form.prices.USD"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:border-brand-500 transition-colors w-full font-mono"
                  />
                </div>
              </div>
              <div class="form-control max-w-xs">
                <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.discount') }}</span></label>
                <input
                  v-model="form.discount"
                  type="number"
                  min="0"
                  max="100"
                  class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                />
              </div>
            </div>
          </div>

          <!-- 3. Inventory & Safety Buffer -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.inventory') }}
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.stockQuantity') }} *</span></label>
                  <input
                    v-model="form.stockQuantity"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.safetyBuffer') }} *</span></label>
                  <input
                    v-model="form.safetyBuffer"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Specifications -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <h2 class="card-title text-base font-semibold">
                {{ t('admin.productForm.sections.specs') }}
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.netValue') }} *</span></label>
                  <input
                    v-model="form.netQuantity.value"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.netUnit') }} *</span></label>
                  <select v-model="form.netQuantity.unit" required class="select select-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full">
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                    <option value="st">st</option>
                  </select>
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.grossWeight') }} *</span></label>
                  <input
                    v-model="form.grossWeight"
                    type="number"
                    min="0"
                    required
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                  />
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.momsRate') }} *</span></label>
                  <select v-model="form.momsRate" required class="select select-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full">
                    <option :value="12">{{ t('admin.productForm.fields.moms12') }}</option>
                    <option :value="25">{{ t('admin.productForm.fields.moms25') }}</option>
                  </select>
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.countryOfOrigin') }}</span></label>
                  <input
                    v-model="form.countryOfOrigin"
                    type="text"
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full"
                  />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text font-medium">{{ t('admin.productForm.fields.barcode') }}</span></label>
                  <input
                    v-model="form.barcode"
                    type="text"
                    class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 transition-colors w-full font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Allergens -->
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
                    class="checkbox checkbox-primary checkbox-sm"
                  />
                  <span class="label-text text-xs font-medium">{{ getLocalizedText(allergen.name) }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 6. Images (Cloudflare R2 Upload) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body space-y-4">
              <div class="flex items-center justify-between border-b border-base-200 pb-3">
                <h2 class="card-title text-base font-semibold">
                  {{ t('admin.productForm.images.title') }}
                </h2>
                <div>
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
                    class="btn border-2 border-gold-400 bg-transparent text-gold-500 hover:bg-gold-400 hover:border-gold-400 hover:!text-white btn-sm gap-2 transition-all disabled:opacity-50"
                  >
                    <span v-if="isUploadingImage" class="loading loading-spinner loading-xs"></span>
                    <Icon v-else name="lucide:upload" class="size-4" />
                    {{ isUploadingImage ? t('admin.productForm.images.uploading') : t('admin.productForm.images.uploadButton') }}
                  </button>
                </div>
              </div>

              <!-- Uploaded Image Gallery Grid -->
              <div v-if="form.images.length === 0" class="text-sm text-base-content/40 italic py-2">
                {{ t('admin.productForm.images.noImages') }}
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(img, idx) in form.images"
                  :key="img.url"
                  class="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl border border-base-200 bg-base-100 shadow-sm"
                >
                  <div class="relative size-16 shrink-0 rounded-lg overflow-hidden bg-base-200 border border-base-200">
                    <img :src="img.url" :alt="img.altText" class="size-full object-cover" />
                    <span v-if="img.isPrimary" class="absolute top-1 left-1 badge badge-xs badge-primary font-bold shadow">★</span>
                  </div>

                  <div class="flex-1 w-full sm:w-auto">
                    <input
                      v-model="img.altText"
                      type="text"
                      :placeholder="t('admin.productForm.images.altPlaceholder')"
                      class="input input-bordered input-sm w-full text-xs"
                    />
                    <div class="text-[10px] text-base-content/40 font-mono truncate mt-1">{{ img.url }}</div>
                  </div>

                  <label class="label cursor-pointer gap-2 shrink-0">
                    <input
                      type="radio"
                      name="primary_product_photo"
                      :checked="img.isPrimary"
                      @change="setPrimaryImage(idx)"
                      class="radio radio-primary radio-sm"
                    />
                    <span class="label-text text-xs font-medium">{{ t('admin.productForm.images.setAsPrimary') }}</span>
                  </label>

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

          <!-- 7. Publication Status -->
          <div class="card bg-base-100 border border-base-200 shadow-sm">
            <div class="card-body">
              <label class="label cursor-pointer justify-start gap-4">
                <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text font-semibold text-sm">{{ t('admin.productForm.fields.isActive') }}</span>
              </label>
            </div>
          </div>

          <!-- Action Bar -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-base-200">
            <NuxtLink to="/admin/products" class="btn bg-transparent border-none text-base-content/70 hover:bg-error/20 hover:text-error transition-colors gap-2">
              <Icon name="lucide:x" class="size-4" />
              {{ t('admin.productForm.actions.cancel') }}
            </NuxtLink>
            <button
              type="submit"
              :disabled="isSubmitting || isUploadingImage"
              class="btn bg-brand-500 border-none text-white hover:bg-brand-600 shadow-sm gap-2 transition-all"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ isSubmitting ? t('admin.productForm.actions.submitting') : t('admin.productForm.actions.submit') }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>