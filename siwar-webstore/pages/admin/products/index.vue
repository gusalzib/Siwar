<!-- pages/admin/products/index.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { toMajorUnits } from '~~/utils/currency'

definePageMeta({
  middleware: 'admin',
})

const { t, locale } = useI18n()

// Active filter states
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedStockStatus = ref('all')
const onlyMissingTranslations = ref(false)
const isActionLoading = ref<string | null>(null)

// 1. Fetch available categories for the dropdown filter
const { data: categories } = await useFetch<Array<{ id: string; name: Record<string, string> }>>(
  '/api/admin/categories'
)

// 2. Fetch products with reactive query parameters
const {
  data: products,
  pending: isLoading,
  refresh: refreshProducts,
} = await useFetch<any[]>('/api/admin/products', {
  query: computed(() => ({
    search: searchQuery.value || undefined,
    category: selectedCategory.value || undefined,
    stockStatus: selectedStockStatus.value !== 'all' ? selectedStockStatus.value : undefined,
    missingTranslations: onlyMissingTranslations.value ? 'true' : undefined,
  })),
})

function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedStockStatus.value = 'all'
  onlyMissingTranslations.value = false
}

// 3. Toggle product active / archived status
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

// 4. Delete product permanently
async function deleteProduct(productId: string) {
  if (!confirm(t('admin.products.actions.deleteConfirm'))) {
    return
  }

  isActionLoading.value = productId
  try {
    await $fetch(`/api/admin/products/${productId}`, {
      method: 'DELETE',
    })
    await refreshProducts()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.message || 'Error deleting product')
  } finally {
    isActionLoading.value = null
  }
}

// Helper to resolve localized text safely
function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-6 md:p-10">
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- Header & Add Button -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">
            {{ t('admin.products.title') }}
          </h1>
          <p class="text-sm text-slate-500">
            {{ t('admin.products.subtitle') }}
          </p>
        </div>
        <NuxtLink
          to="/admin/products/new"
          class="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('admin.products.addNew') }}
        </NuxtLink>
      </div>

      <!-- Filters Panel -->
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Keyword Search -->
          <div>
            <label class="sr-only" for="search-input">{{ t('admin.products.searchPlaceholder') }}</label>
            <input
              id="search-input"
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.products.searchPlaceholder')"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <!-- Category Filter -->
          <div>
            <select
              v-model="selectedCategory"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">{{ t('admin.products.filters.stockLevel.all') }}</option>
              <option value="low">{{ t('admin.products.filters.stockLevel.lowStock') }}</option>
              <option value="out">{{ t('admin.products.filters.stockLevel.outOfStock') }}</option>
            </select>
          </div>

          <!-- Missing Translations Filter -->
          <div class="flex items-center gap-2">
            <input
              id="missing-translations"
              v-model="onlyMissingTranslations"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label for="missing-translations" class="text-sm font-medium text-slate-700 cursor-pointer">
              {{ t('admin.products.filters.translations.missing') }}
            </label>
          </div>
        </div>

        <!-- Filter Reset -->
        <div
          v-if="searchQuery || selectedCategory || selectedStockStatus !== 'all' || onlyMissingTranslations"
          class="mt-4 flex justify-end"
        >
          <button
            type="button"
            @click="resetFilters"
            class="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            {{ t('admin.products.filters.reset') }}
          </button>
        </div>
      </div>

      <!-- Data Table -->
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm text-slate-600">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.image') }}</th>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.product') }}</th>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.category') }}</th>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.pricing') }}</th>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.stock') }}</th>
                <th scope="col" class="px-4 py-3.5">{{ t('admin.products.table.status') }}</th>
                <th scope="col" class="px-4 py-3.5 text-right">{{ t('admin.products.table.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <!-- Loading State -->
              <tr v-if="isLoading">
                <td colspan="7" class="px-4 py-12 text-center text-sm text-slate-400">
                  {{ t('admin.products.loading') }}
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="!products || products.length === 0">
                <td colspan="7" class="px-4 py-12 text-center">
                  <p class="font-medium text-slate-800">{{ t('admin.products.empty.title') }}</p>
                  <p class="mt-1 text-sm text-slate-400">{{ t('admin.products.empty.description') }}</p>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr
                v-for="product in products"
                :key="product.id"
                class="hover:bg-slate-50 transition"
              >
                <!-- Thumbnail -->
                <td class="px-4 py-3">
                  <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                    <img
                      v-if="product.images && product.images[0]?.url"
                      :src="product.images[0].url"
                      :alt="getLocalizedText(product.name)"
                      class="h-full w-full object-cover"
                    />
                    <div v-else class="flex h-full w-full items-center justify-center text-slate-300">
                      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </td>

                <!-- Product Name & Language Status -->
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900">
                    {{ getLocalizedText(product.name) }}
                  </div>
                  <div class="text-xs text-slate-400">
                    {{ product.brand }}
                  </div>
                  <!-- Translation Badges -->
                  <div class="mt-1 flex items-center gap-1.5">
                    <span
                      :class="product.name?.ar ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                      class="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                    >AR</span>
                    <span
                      :class="product.name?.sv ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                      class="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                    >SV</span>
                    <span
                      :class="product.name?.en ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                      class="rounded border px-1.5 py-0.5 text-[10px] font-medium"
                    >EN</span>
                  </div>
                </td>

                <!-- Category -->
                <td class="px-4 py-3 text-slate-700">
                  {{ product.category?.name ? getLocalizedText(product.category.name) : '—' }}
                </td>

                <!-- Multi-Currency Pricing -->
                <td class="px-4 py-3">
                  <div class="text-xs space-y-0.5 font-mono text-slate-700">
                    <div>{{ toMajorUnits(product.price?.SEK || 0) }} SEK</div>
                    <div>{{ toMajorUnits(product.price?.EUR || 0) }} EUR</div>
                    <div>{{ toMajorUnits(product.price?.USD || 0) }} USD</div>
                  </div>
                </td>

                <!-- Inventory & Safety Buffer -->
                <td class="px-4 py-3">
                  <div class="text-xs space-y-1">
                    <div class="font-medium text-slate-900">
                      {{ product.stockQuantity }} / {{ product.safetyBuffer }} /
                      <span :class="product.availableStock > 0 ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'">
                        {{ product.availableStock }}
                      </span>
                    </div>
                    <span
                      v-if="product.stockQuantity <= 0"
                      class="inline-block rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800"
                    >
                      {{ t('admin.products.status.outOfStockBadge') }}
                    </span>
                    <span
                      v-else-if="product.stockQuantity <= product.safetyBuffer"
                      class="inline-block rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                    >
                      {{ t('admin.products.status.lowStockBadge') }}
                    </span>
                  </div>
                </td>

                <!-- Active / Archived Status -->
                <td class="px-4 py-3">
                  <span
                    :class="product.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'"
                    class="rounded-full px-2.5 py-1 text-xs font-semibold"
                  >
                    {{ product.isActive ? t('admin.products.status.active') : t('admin.products.status.archived') }}
                  </span>
                </td>

                <!-- Action Buttons -->
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <NuxtLink
                      :to="`/admin/products/${product.id}`"
                      class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      :title="t('admin.products.actions.edit')"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </NuxtLink>

                    <button
                      type="button"
                      :disabled="isActionLoading === product.id"
                      @click="toggleArchive(product.id)"
                      class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                      :title="product.isActive ? t('admin.products.actions.archive') : t('admin.products.actions.unarchive')"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      :disabled="isActionLoading === product.id"
                      @click="deleteProduct(product.id)"
                      class="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      :title="t('admin.products.actions.delete')"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>