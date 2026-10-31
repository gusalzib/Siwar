<!-- pages/admin/products/index.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { toMajorUnits } from '~~/utils/currency'

definePageMeta({
  middleware: 'admin',
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Active filter states
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedStockStatus = ref('all')
const selectedStatus = ref<'all' | 'active' | 'archived'>('all')
const onlyDiscounted = ref(false)
const onlyMissingTranslations = ref(false)
const isActionLoading = ref<string | null>(null)

// Delete modal state
const deleteModalRef = ref<HTMLDialogElement | null>(null)
const productToDelete = ref<any | null>(null)
const isDeleting = ref(false)

// 1. Fetch available categories for the dropdown filter
const { data: categories } = await useFetch<Array<{ id: string; name: Record<string, string> }>>(
  '/api/admin/categories'
)

// 2. Reactive query parameters for product fetching
const queryParams = computed(() => {
  const q: Record<string, string | undefined> = {
    search: searchQuery.value.trim() || undefined,
    category: selectedCategory.value || undefined,
    stockStatus: selectedStockStatus.value !== 'all' ? selectedStockStatus.value : undefined,
    missingTranslations: onlyMissingTranslations.value ? 'true' : undefined,
  }

  if (selectedStatus.value === 'archived') {
    q.isArchived = 'true'
  } else if (selectedStatus.value === 'active') {
    q.isArchived = 'false'
  }

  if (onlyDiscounted.value) {
    q.hasDiscount = 'true'
  }

  return q
})

// 3. Fetch products with reactive query parameters
const {
  data: products,
  pending: isLoading,
  refresh: refreshProducts,
} = await useFetch<any[]>('/api/admin/products', {
  query: queryParams,
})

// Checks if any filter is actively applied
const hasActiveFilters = computed(() => {
  return Boolean(
    searchQuery.value.trim() ||
    selectedCategory.value ||
    selectedStockStatus.value !== 'all' ||
    selectedStatus.value !== 'all' ||
    onlyDiscounted.value ||
    onlyMissingTranslations.value
  )
})

function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedStockStatus.value = 'all'
  selectedStatus.value = 'all'
  onlyDiscounted.value = false
  onlyMissingTranslations.value = false
}

// 4. Toggle product active / archived status
async function toggleArchive(productId: string) {
  isActionLoading.value = productId
  try {
    await $fetch(`/api/admin/products/${productId}/toggle-active`, {
      method: 'PATCH',
    })
    await refreshProducts()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.message || 'Error updating product')
  } finally {
    isActionLoading.value = null
  }
}

// 5. Open / Close Delete Confirmation Modal
function openDeleteModal(product: any) {
  productToDelete.value = product
  deleteModalRef.value?.showModal()
}

function closeDeleteModal() {
  productToDelete.value = null
  deleteModalRef.value?.close()
}

// 6. Confirm Permanent Product Deletion
async function confirmDeleteProduct() {
  if (!productToDelete.value) return

  isDeleting.value = true
  const id = productToDelete.value.id
  try {
    await $fetch(`/api/admin/products/${id}`, {
      method: 'DELETE' as any,
    })
    closeDeleteModal()
    await refreshProducts()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.message || 'Error deleting product')
  } finally {
    isDeleting.value = false
  }
}

// Helper to resolve localized text safely
function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Helper to retrieve primary image or first available thumbnail
function getPrimaryImage(product: any) {
  if (!product.images || product.images.length === 0) return null
  const primary = product.images.find((img: any) => img.isPrimary)
  return primary || product.images[0]
}

// Determines if discount badge should be shown (active or scheduled only, never expired)
function isDiscountActiveOrScheduled(product: any): boolean {
  if (product.showDiscountBadge !== undefined) {
    return Boolean(product.showDiscountBadge)
  }
  if (!product.discount || product.discount <= 0) return false
  if (product.discountExpiresAt && new Date(product.discountExpiresAt) <= new Date()) {
    return false
  }
  return true
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-4 sm:p-6 md:p-10 pb-24">
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- Header & Add Button -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-base-content">
            {{ t('admin.products.title') }}
          </h1>
          <p class="text-sm text-base-content/70 mt-1">
            {{ t('admin.products.subtitle') }}
          </p>
        </div>
        <NuxtLink
          :to="localePath('/admin/products/new')"
          class="btn btn-primary font-bold shadow-sm rounded-xl gap-2 self-start sm:self-auto text-slate-950 text-white"
        >
          <Icon name="lucide:plus" class="size-4" />
          {{ t('admin.products.addNew') }}
        </NuxtLink>
      </div>

      <!-- Filters Panel Card -->
      <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl p-4 sm:p-6 space-y-4">
        <!-- Row 1: Search, Category, Stock Level & Translations -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Keyword Search -->
          <div class="relative">
            <label class="sr-only" for="search-input">{{ t('admin.products.searchPlaceholder') }}</label>
            <div class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-base-content/50">
              <Icon name="lucide:search" class="size-4" />
            </div>
            <input
              id="search-input"
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.products.searchPlaceholder')"
              class="w-full rounded-xl border-2 border-base-300 dark:border-zinc-700 bg-base-100 dark:bg-zinc-800 ps-9 pe-3 py-2 text-sm text-base-content placeholder-base-content/50 focus:border-brand-500 focus:outline-none transition"
            />
          </div>

          <!-- Category Filter -->
          <div>
            <select
              v-model="selectedCategory"
              class="w-full rounded-xl border-2 border-base-300 dark:border-zinc-700 bg-base-100 dark:bg-zinc-800 px-3 py-2 text-sm text-base-content focus:border-brand-500 focus:outline-none transition cursor-pointer"
            >
              <option value="">{{ t('admin.products.filters.allCategories') }}</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ getLocalizedText(cat.name) }}
              </option>
            </select>
          </div>

          <!-- Stock Level Filter -->
          <div>
            <select
              v-model="selectedStockStatus"
              class="w-full rounded-xl border-2 border-base-300 dark:border-zinc-700 bg-base-100 dark:bg-zinc-800 px-3 py-2 text-sm text-base-content focus:border-brand-500 focus:outline-none transition cursor-pointer"
            >
              <option value="all">{{ t('admin.products.filters.stockLevel.all') }}</option>
              <option value="low">{{ t('admin.products.filters.stockLevel.lowStock') }}</option>
              <option value="out">{{ t('admin.products.filters.stockLevel.outOfStock') }}</option>
            </select>
          </div>

          <!-- Missing Translations Filter -->
          <div class="flex items-center gap-2.5 px-1 py-1">
            <input
              id="missing-translations"
              v-model="onlyMissingTranslations"
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm rounded-lg"
            />
            <label for="missing-translations" class="text-sm font-semibold text-base-content/80 cursor-pointer select-none">
              {{ t('admin.products.filters.translations.missing') }}
            </label>
          </div>
        </div>

        <hr class="border-t-2 border-base-200 dark:border-zinc-800" />

        <!-- Row 2: Status Filter Tabs (AC-1) & Deals Toggle -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <!-- Status Filter Pills -->
            <div class="inline-flex rounded-xl p-1 bg-base-200 dark:bg-zinc-800 border border-base-300 dark:border-zinc-700 gap-1">
              <button
                type="button"
                @click="selectedStatus = 'all'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                :class="selectedStatus === 'all' ? 'bg-brand-600 text-white shadow-xs' : 'text-base-content/70 hover:text-base-content hover:bg-base-100 dark:hover:bg-zinc-700'"
              >
                {{ t('admin.products.filters.status.all') }}
              </button>
              <button
                type="button"
                @click="selectedStatus = 'active'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                :class="selectedStatus === 'active' ? 'bg-brand-600 text-white shadow-xs' : 'text-base-content/70 hover:text-base-content hover:bg-base-100 dark:hover:bg-zinc-700'"
              >
                <span class="size-2 rounded-full bg-emerald-400"></span>
                {{ t('admin.products.filters.status.active') }}
              </button>
              <button
                type="button"
                @click="selectedStatus = 'archived'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                :class="selectedStatus === 'archived' ? 'bg-brand-600 text-white shadow-xs' : 'text-base-content/70 hover:text-base-content hover:bg-base-100 dark:hover:bg-zinc-700'"
              >
                <span class="size-2 rounded-full bg-amber-400"></span>
                {{ t('admin.products.filters.status.archived') }}
              </button>
            </div>

            <!-- Deals Filter Toggle -->
            <button
              type="button"
              @click="onlyDiscounted = !onlyDiscounted"
              class="px-3.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-1.5"
              :class="onlyDiscounted 
                ? 'bg-rose-600 border-rose-600 text-white shadow-xs' 
                : 'bg-base-100 dark:bg-zinc-800 border-base-300 dark:border-zinc-700 text-base-content/80 hover:bg-base-200 dark:hover:bg-zinc-700'"
            >
              <Icon name="lucide:percent" class="size-3.5" :class="onlyDiscounted ? 'text-white' : 'text-rose-500'" />
              {{ t('admin.products.filters.deals.discounted') }}
            </button>
          </div>

          <!-- Reset Filters & Product Count -->
          <div class="flex items-center gap-3">
            <span v-if="products" class="text-xs font-semibold text-base-content/60">
              {{ t('admin.products.cards.showingCount', { count: products.length }) }}
            </span>
            <button
              v-if="hasActiveFilters"
              type="button"
              @click="resetFilters"
              class="btn btn-ghost btn-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              <Icon name="lucide:rotate-ccw" class="size-3" />
              {{ t('admin.products.filters.reset') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Vertically Stacked Wide Product Cards (AC-1) -->
      <div class="space-y-4">
        <!-- Loading State -->
        <div
          v-if="isLoading"
          class="card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 p-12 text-center rounded-2xl shadow-sm"
        >
          <div class="flex flex-col items-center justify-center gap-3">
            <span class="loading loading-spinner loading-md text-brand-600"></span>
            <p class="text-sm font-semibold text-base-content/70">{{ t('admin.products.loading') }}</p>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!products || products.length === 0"
          class="card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 p-12 text-center rounded-2xl shadow-sm"
        >
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-base-200 dark:bg-zinc-800 text-base-content/40 mb-4">
            <Icon name="lucide:package-open" class="size-8" />
          </div>
          <h2 class="text-lg font-bold text-base-content">{{ t('admin.products.empty.title') }}</h2>
          <p class="mt-1 text-sm text-base-content/60 max-w-md mx-auto">{{ t('admin.products.empty.description') }}</p>
          <div class="mt-5 flex justify-center gap-3">
            <button
              v-if="hasActiveFilters"
              type="button"
              @click="resetFilters"
              class="btn btn-outline btn-sm rounded-xl font-bold"
            >
              {{ t('admin.products.filters.reset') }}
            </button>
            <NuxtLink
              :to="localePath('/admin/products/new')"
              class="btn btn-primary btn-sm rounded-xl font-bold text-slate-950 dark:text-slate-950"
            >
              {{ t('admin.products.addNew') }}
            </NuxtLink>
          </div>
        </div>

        <!-- Wide Product Cards (AC-1) -->
        <article
          v-for="product in products"
          :key="product.id"
          class="card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 hover:border-brand-500/50 dark:hover:border-brand-500/50 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl p-4 sm:p-5"
        >
          <div class="flex flex-col lg:flex-row gap-5 items-start lg:items-center justify-between">
            <!-- Left: High-Res Thumbnail with Primary Image Indicator -->
            <div class="relative w-full sm:w-36 h-36 shrink-0 rounded-xl overflow-hidden bg-base-200 dark:bg-zinc-800 border-2 border-base-300 dark:border-zinc-700 flex items-center justify-center p-2">
              <img
                v-if="getPrimaryImage(product)?.url"
                :src="getPrimaryImage(product).url"
                :alt="getLocalizedText(product.name)"
                class="h-full w-full object-contain"
                loading="lazy"
              />
              <div v-else class="flex flex-col items-center justify-center text-base-content/40 gap-1">
                <Icon name="lucide:image" class="size-8" />
                <span class="text-[10px] font-semibold">{{ t('admin.products.cards.noImages') }}</span>
              </div>

              <!-- Primary Image Indicator Badge
              <span
                v-if="getPrimaryImage(product)?.isPrimary"
                class="badge badge-xs bg-slate-900/90 text-amber-400 font-bold border-0 absolute top-2 start-2 gap-1 py-1 px-1.5 shadow-sm"
              >
                <Icon name="lucide:star" class="size-2.5 fill-amber-400" />
                {{ t('admin.products.cards.primaryImage') }}
              </span> -->

              <!-- Active / Archived Status Badge on Image -->
              <span
                :class="product.isActive 
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40' 
                  : 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-400 border-zinc-500/40'"
                class="badge badge-xs font-bold border absolute top-2 end-2 py-1 px-2 shadow-sm"
              >
                {{ product.isActive ? t('admin.products.status.active') : t('admin.products.status.archived') }}
              </span>
            </div>

            <!-- Middle: Titles, Category, Barcode/SKU, Stock Indicators -->
            <div class="flex-1 min-w-0 space-y-3 w-full">
              <!-- Category, Brand, Barcode row -->
              <div class="flex flex-wrap items-center gap-2">
                <span
                  v-if="product.brand"
                  class="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-lg border border-brand-200 dark:border-brand-900"
                >
                  {{ product.brand }}
                </span>
                <span
                  v-if="product.category?.name"
                  class="badge badge-outline badge-sm text-xs font-medium border-base-300 dark:border-zinc-700 text-base-content/80"
                >
                  {{ getLocalizedText(product.category.name) }}
                </span>
                <!-- Barcode / SKU Indicator -->
                <span
                  v-if="product.barcode"
                  class="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-base-content/70 bg-base-200 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-base-300 dark:border-zinc-700"
                >
                  <Icon name="lucide:scan-barcode" class="size-3.5 text-base-content/60" />
                  {{ product.barcode }}
                </span>
              </div>

              <!-- Primary Title -->
              <div>
                <h2 class="text-base sm:text-lg font-extrabold text-base-content leading-tight">
                  {{ getLocalizedText(product.name) }}
                </h2>
              </div>

              <!-- Multilingual completeness indicators -->
              <div class="flex flex-wrap items-center gap-1.5 text-xs">
                <span class="text-base-content/50 font-medium text-[11px] me-1">{{ t('admin.products.cards.languages') }}:</span>
                <span
                  :class="product.name?.ar ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'"
                  class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
                >AR</span>
                <span
                  :class="product.name?.sv ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'"
                  class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
                >SV</span>
                <span
                  :class="product.name?.en ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'"
                  class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
                >EN</span>
              </div>

              <!-- Stock Indicators: Physical, Safety Buffer, Online Available -->
              <div class="flex flex-wrap items-center gap-3 pt-0.5">
                <div class="inline-flex items-center gap-2.5 rounded-xl border-2 border-base-300 dark:border-zinc-700 bg-base-200/60 dark:bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold">
                  <span>{{ t('admin.products.cards.stockPhysical') }}: <strong class="text-base-content font-bold">{{ product.stockQuantity }}</strong></span>
                  <span class="text-base-content/30">•</span>
                  <span>{{ t('admin.products.cards.stockBuffer') }}: <strong class="text-base-content font-bold">{{ product.safetyBuffer }}</strong></span>
                  <span class="text-base-content/30">•</span>
                  <span>
                    {{ t('admin.products.cards.stockOnline') }}:
                    <strong :class="product.availableStock > 0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-rose-600 dark:text-rose-400 font-extrabold'">
                      {{ product.availableStock }}
                    </strong>
                  </span>
                </div>

                <!-- Stock Alert Badges -->
                <span
                  v-if="product.stockQuantity <= 0"
                  class="badge badge-error badge-sm text-white font-bold"
                >
                  {{ t('admin.products.status.outOfStockBadge') }}
                </span>
                <span
                  v-else-if="product.stockQuantity <= product.safetyBuffer"
                  class="badge badge-warning badge-sm text-black font-bold"
                >
                  {{ t('admin.products.status.lowStockBadge') }}
                </span>
              </div>
            </div>

            <!-- Pricing Tier & Actions Group -->
            <div class="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-base-200 dark:border-zinc-800">
              <!-- Pricing Tier (SEK / EUR / USD) & Discount Badge -->
              <div class="flex flex-col items-start lg:items-end gap-1">
                <!-- Discount Badge -->
                <div v-if="isDiscountActiveOrScheduled(product)">
                  <span
                    v-if="product.discountStatus === 'scheduled'"
                    class="badge badge-warning badge-sm text-black font-bold gap-1 shadow-xs"
                  >
                    <Icon name="lucide:clock" class="size-3 text-black" />
                    -{{ product.discount }}% ({{ t('admin.productForm.fields.campaignScheduled', 'Schemalagd') }})
                  </span>
                  <span
                    v-else
                    class="badge badge-error badge-sm text-white font-bold gap-1 shadow-xs"
                  >
                    <Icon name="lucide:percent" class="size-3" />
                    -{{ product.discount }}%
                  </span>
                </div>

                <!-- Currency Prices -->
                <div class="text-lg font-black text-base-content">
                  {{ toMajorUnits(product.price?.SEK || 0) }} SEK
                </div>
                <div class="text-xs font-semibold text-base-content/60">
                  {{ toMajorUnits(product.price?.EUR || 0) }} EUR • {{ toMajorUnits(product.price?.USD || 0) }} USD
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <!-- Edit Button -->
                <NuxtLink
                  :to="localePath(`/admin/products/${product.id}`)"
                  class="btn btn-outline btn-sm rounded-xl font-bold gap-1.5 border-2 border-base-300 dark:border-zinc-700 hover:border-brand-500 hover:bg-brand-500 hover:text-slate-950 transition"
                  :title="t('admin.products.actions.edit')"
                >
                  <Icon name="lucide:pencil" class="size-3.5" />
                  <span class="hidden sm:inline">{{ t('admin.products.actions.edit') }}</span>
                </NuxtLink>

                <!-- Toggle Archive / Active Status -->
                <button
                  type="button"
                  :disabled="isActionLoading === product.id"
                  @click="toggleArchive(product.id)"
                  class="btn btn-ghost btn-sm rounded-xl font-bold gap-1.5 border-2 border-base-300 dark:border-zinc-700 hover:bg-warning/20 hover:border-warning text-base-content disabled:opacity-50 transition"
                  :title="product.isActive ? t('admin.products.actions.archive') : t('admin.products.actions.unarchive')"
                >
                  <span v-if="isActionLoading === product.id" class="loading loading-spinner loading-xs"></span>
                  <Icon
                    v-else
                    :name="product.isActive ? 'lucide:archive' : 'lucide:archive-restore'"
                    class="size-3.5"
                  />
                  <span class="hidden sm:inline">
                    {{ product.isActive ? t('admin.products.actions.archive') : t('admin.products.actions.unarchive') }}
                  </span>
                </button>

                <!-- Delete Product Modal Trigger -->
                <button
                  type="button"
                  :disabled="isActionLoading === product.id"
                  @click="openDeleteModal(product)"
                  class="btn btn-ghost btn-sm rounded-xl font-bold gap-1.5 border-2 border-error/30 text-error hover:bg-error hover:text-white disabled:opacity-50 transition"
                  :title="t('admin.products.actions.delete')"
                >
                  <Icon name="lucide:trash-2" class="size-3.5" />
                  <span class="hidden sm:inline">{{ t('admin.products.actions.delete') }}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <!-- DaisyUI Confirmation Dialog Modal for Product Deletion -->
    <dialog ref="deleteModalRef" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 shadow-2xl rounded-2xl p-6">
        <div class="flex items-center gap-3 text-error mb-4">
          <div class="p-3 bg-error/10 rounded-full">
            <Icon name="lucide:alert-triangle" class="size-6 text-error" />
          </div>
          <div>
            <h3 class="font-extrabold text-lg text-base-content">
              {{ t('admin.products.deleteModal.title') }}
            </h3>
            <p class="text-xs text-base-content/60">ID: {{ productToDelete?.id }}</p>
          </div>
        </div>

        <p class="text-sm text-base-content/80 leading-relaxed mb-6">
          {{ t('admin.products.deleteModal.message', { name: productToDelete ? getLocalizedText(productToDelete.name) : '' }) }}
        </p>

        <div class="modal-action flex justify-end gap-3">
          <button
            type="button"
            :disabled="isDeleting"
            @click="closeDeleteModal"
            class="btn btn-ghost btn-sm rounded-xl font-bold border-2 border-base-300 dark:border-zinc-700"
          >
            {{ t('admin.products.deleteModal.cancel') }}
          </button>
          <button
            type="button"
            :disabled="isDeleting"
            @click="confirmDeleteProduct"
            class="btn btn-error btn-sm rounded-xl font-bold text-white gap-2"
          >
            <span v-if="isDeleting" class="loading loading-spinner loading-xs"></span>
            <Icon v-else name="lucide:trash-2" class="size-4" />
            {{ isDeleting ? t('admin.products.deleteModal.deleting') : t('admin.products.deleteModal.confirm') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeDeleteModal">close</button>
      </form>
    </dialog>
  </div>
</template>