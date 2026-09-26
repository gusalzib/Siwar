<!-- pages/catalog/index.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

// Active Store Currency
const activeCurrency = useState<'SEK' | 'EUR' | 'USD'>('activeCurrency', () => 'SEK')

// 1. Reactive filter state derived from URL Query Parameters
const searchQuery = ref(String(route.query.q || route.query.search || ''))
const selectedCategory = ref(String(route.query.category || ''))
const selectedSort = ref(String(route.query.sort || 'newest'))
const currentPage = ref(Number(route.query.page) || 1)

const selectedBrands = ref<string[]>(
  route.query.brand ? (Array.isArray(route.query.brand) ? route.query.brand as string[] : String(route.query.brand).split(',')) : []
)
const selectedOrigins = ref<string[]>(
  route.query.origin ? (Array.isArray(route.query.origin) ? route.query.origin as string[] : String(route.query.origin).split(',')) : []
)
const excludedAllergens = ref<string[]>(
  route.query.excludeAllergens
    ? (Array.isArray(route.query.excludeAllergens) ? route.query.excludeAllergens as string[] : String(route.query.excludeAllergens).split(','))
    : []
)

// Mobile filter drawer state
const isMobileDrawerOpen = ref(false)

// 2. Fetch Facet Options (Categories, Brands, Origins, Allergens)
const { data: facetOptions } = await useAsyncData('catalog-facets', () =>
  $fetch('/api/catalog/filters')
)

// 3. AC-3: SSR Product Query with reactive route watch
const { data: catalogData, pending: isLoading } = await useAsyncData(
  'catalog-products',
  () =>
    $fetch<any>('/api/catalog', {
      params: {
        page: route.query.page || 1,
        limit: 12,
        search: route.query.q || undefined,
        category: route.query.category || undefined,
        sort: route.query.sort || undefined,
        brand: route.query.brand || undefined,
        origin: route.query.origin || undefined,
        excludeAllergens: route.query.excludeAllergens || undefined,
      },
    }),
  {
    watch: [() => route.query],
  }
)

// 4. Clean URL Sync for Deep-Linking
function applyFiltersToUrl(overrides: Record<string, any> = {}) {
  const query: Record<string, string | undefined> = {
    q: searchQuery.value.trim() || undefined,
    category: selectedCategory.value || undefined,
    sort: selectedSort.value !== 'newest' ? selectedSort.value : undefined,
    brand: selectedBrands.value.length ? selectedBrands.value.join(',') : undefined,
    origin: selectedOrigins.value.length ? selectedOrigins.value.join(',') : undefined,
    excludeAllergens: excludedAllergens.value.length ? excludedAllergens.value.join(',') : undefined,
    page: currentPage.value > 1 ? String(currentPage.value) : undefined,
    ...overrides,
  }

  Object.keys(query).forEach((key) => query[key] === undefined && delete query[key])
  router.push({ query })
}

// Multilingual search debounce
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    applyFiltersToUrl({ page: undefined })
  }, 250)
}


// Helper: Checks if category is active by ID or any of its multilingual slugs
function isCategorySelected(cat: any): boolean {
  if (!selectedCategory.value) return false
  if (selectedCategory.value === cat.id) return true
  if (cat.slug && Object.values(cat.slug).includes(selectedCategory.value)) return true
  return false
}

// Toggle category using the localized slug matching current UI language
function toggleCategory(cat: any) {
  if (isCategorySelected(cat)) {
    selectedCategory.value = ''
  } else {
    // Uses the active locale slug (e.g., 'spices', 'kryddor', or 'بهارات'), falling back to ID
    selectedCategory.value = cat.slug?.[locale.value] || cat.id
  }
  currentPage.value = 1
  applyFiltersToUrl({ page: undefined })
}



function toggleBrand(brand: string) {
  const idx = selectedBrands.value.indexOf(brand)
  if (idx >= 0) selectedBrands.value.splice(idx, 1)
  else selectedBrands.value.push(brand)
  currentPage.value = 1
  applyFiltersToUrl({ page: undefined })
}

function toggleOrigin(origin: string) {
  const idx = selectedOrigins.value.indexOf(origin)
  if (idx >= 0) selectedOrigins.value.splice(idx, 1)
  else selectedOrigins.value.push(origin)
  currentPage.value = 1
  applyFiltersToUrl({ page: undefined })
}

// Helper checks if either the semantic code OR the MongoDB ObjectId is in the array
function isAllergenExcluded(allergen: { id: string; code?: string }): boolean {
  const code = allergen.code || allergen.id
  return excludedAllergens.value.includes(code) || excludedAllergens.value.includes(allergen.id)
}

function toggleAllergenExclusion(identifier: string) {
  const idx = excludedAllergens.value.indexOf(identifier)
  if (idx >= 0) {
    excludedAllergens.value.splice(idx, 1)
  } else {
    excludedAllergens.value.push(identifier)
  }
  currentPage.value = 1
  applyFiltersToUrl({ page: undefined })
}

function changePage(newPage: number) {
  currentPage.value = newPage
  applyFiltersToUrl({ page: newPage > 1 ? String(newPage) : undefined })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetAllFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedBrands.value = []
  selectedOrigins.value = []
  excludedAllergens.value = []
  selectedSort.value = 'newest'
  currentPage.value = 1
  router.push({ query: {} })
}

// 5. Jämförpris Formatter
function calculateComparisonPrice(priceMinor: number, netQuantity?: { value: number; unit: string }): string {
  if (!netQuantity || !netQuantity.value || netQuantity.value <= 0) return ''
  const majorPrice = priceMinor / 100
  let standardUnits = netQuantity.value
  let targetUnit = netQuantity.unit

  if (netQuantity.unit === 'g') {
    standardUnits = netQuantity.value / 1000
    targetUnit = 'kg'
  } else if (netQuantity.unit === 'ml') {
    standardUnits = netQuantity.value / 1000
    targetUnit = 'l'
  }

  const unitPrice = (majorPrice / standardUnits).toFixed(2)
  return `${unitPrice} ${activeCurrency.value}/${targetUnit}`
}

function getLocalized(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Top Filter & Search Controls Header -->
    <div class="card bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 shadow-sm">
      <div class="card-body p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <!-- Multilingual Search Input (AC-1) -->
        <div class="join w-full md:max-w-md shadow-sm">
          <span class="join-item btn no-animation !bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700 !text-white">
            <Icon name="lucide:search" class="size-5" />
          </span>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('catalog.searchPlaceholder')"
            class="input input-bordered border-emerald-200 focus:border-emerald-500 join-item w-full focus:outline-none"
            @input="onSearchInput"
          />
        </div>

        <div class="flex items-center gap-3">
          <!-- Mobile Filter Toggle -->
          <button
            type="button"
            class="btn btn-outline btn-sm md:hidden gap-2 !border-emerald-300 !text-base-content dark:!text-emerald-200"
            @click="isMobileDrawerOpen = !isMobileDrawerOpen"
          >
            <Icon name="lucide:sliders-horizontal" class="size-4" />
            <span>{{ t('catalog.filtersTitle') }}</span>
            <span
              v-if="selectedBrands.length + selectedOrigins.length + excludedAllergens.length + (selectedCategory ? 1 : 0) > 0"
              class="badge !bg-emerald-600 !text-white badge-xs"
            >
              {{ selectedBrands.length + selectedOrigins.length + excludedAllergens.length + (selectedCategory ? 1 : 0) }}
            </span>
          </button>

          <!-- Sort Select -->
          <select
            v-model="selectedSort"
            class="select select-bordered select-sm border border-emerald-400/70 bg-base-100 text-base-content font-bold shadow-sm cursor-pointer w-auto ps-4 pe-10 transition-all duration-200 dark:border-emerald-400 dark:bg-base-200 dark:shadow-[0_0_0_1px_rgba(52,211,153,0.3)] hover:border-accent hover:bg-accent hover:text-accent-content focus:border-accent focus:outline-none"            @change="applyFiltersToUrl()"
          >
            <option value="newest">{{ t('catalog.sort.newest') }}</option>
            <option value="price_asc">{{ t('catalog.sort.priceAsc') }}</option>
            <option value="price_desc">{{ t('catalog.sort.priceDesc') }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Layout: Facet Sidebar + Product Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Faceted Filter Sidebar -->
      <aside :class="['space-y-6', isMobileDrawerOpen ? 'block' : 'hidden lg:block']">
        <div class="card bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div class="card-body p-5 space-y-6">
            <!-- Sidebar Header -->
            <div class="flex items-center justify-between border-b border-base-200 pb-3">
              <h2 class="font-bold text-base flex items-center gap-2">
                <Icon name="lucide:filter" class="size-4 text-primary" />
                <span>{{ t('catalog.filtersTitle') }}</span>
              </h2>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-primary font-semibold"
                @click="resetAllFilters"
              >
                {{ t('catalog.resetFilters') }}
              </button>
            </div>

            <!-- Categories -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {{ t('catalog.categories') }}
                <Icon name="lucide:chevron-down" class="size-4 transition-transform group-open:-rotate-180" />
              </summary>
              <ul class="menu menu-compact bg-base-50 rounded-box p-0 space-y-1 mt-1">
                  <li
                      v-for="cat in facetOptions?.categories"
                      :key="cat.id"
                      @click="toggleCategory(cat)"
                  >
                      <a
                          :class="[
                              'rounded-lg border border-transparent text-base-content transition-all hover:bg-transparent hover:border-emerald-600 hover:text-base-content focus:text-base-content',
                              { 'active font-bold !bg-emerald-600 !text-white': isCategorySelected(cat) }
                          ]"
                          >
                          {{ getLocalized(cat.name) }}
                      </a>
                  </li>
              </ul>
            </details>

            <hr class="border-t-[4px] border-emerald-200 dark:border-emerald-800/60 my-4" />

            <!-- Allergen Exclusion (AC-2) -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-error/80 mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:shield-ban" class="size-4" />
                  <span>{{ t('catalog.allergenExclusionTitle') }}</span>
                </div>
                <Icon name="lucide:chevron-down" class="size-4 transition-transform group-open:-rotate-180" />
              </summary>
              <div class="space-y-2 max-h-48 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="allergen in facetOptions?.allergens"
                  :key="allergen.id"
                  class="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                >
                    <input
                        type="checkbox"
                        :checked="excludedAllergens.includes(allergen.code || allergen.id)"
                        class="checkbox checkbox-error checkbox-xs border-2 !border-black"
                        @change="toggleAllergenExclusion(allergen.code || allergen.id)"
                    />
                  <span>{{ getLocalized(allergen.name) }}</span>
                </label>
              </div>
            </details>

            <hr class="border-t-[4px] border-emerald-200 dark:border-emerald-800/60 my-4" />

            <!-- Brands -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {{ t('catalog.brands') }}
                <Icon name="lucide:chevron-down" class="size-4 transition-transform group-open:-rotate-180" />
              </summary>
              <div class="space-y-2 max-h-44 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="brand in facetOptions?.brands"
                  :key="brand"
                  class="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="selectedBrands.includes(brand)"
                    class="checkbox checkbox-primary checkbox-xs border-2 !border-black"
                    @change="toggleBrand(brand)"
                  />
                  <span>{{ brand }}</span>
                </label>
              </div>
            </details>

            <hr class="border-t-[4px] border-emerald-200 dark:border-emerald-800/60 my-4" />

            <!-- Country of Origin -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/50 mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {{ t('catalog.origin') }}
                <Icon name="lucide:chevron-down" class="size-4 transition-transform group-open:-rotate-180" />
              </summary>
              <div class="space-y-2 max-h-40 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="origin in facetOptions?.origins"
                  :key="origin"
                  class="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="selectedOrigins.includes(origin)"
                    class="checkbox checkbox-primary checkbox-xs border-2 !border-black"
                    @change="toggleOrigin(origin)"
                  />
                  <span>{{ origin }}</span>
                </label>
              </div>
            </details>
          </div>
        </div>
      </aside>

      <!-- Main Product Grid -->
      <main class="lg:col-span-3">
        <!-- Loading Pulse State -->
        <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="n in 6" :key="n" class="card bg-base-100 border border-base-200 animate-pulse">
            <div class="h-48 bg-base-300 w-full" />
            <div class="card-body p-4 space-y-2">
              <div class="h-4 bg-base-300 rounded w-3/4" />
              <div class="h-4 bg-base-300 rounded w-1/2" />
            </div>
          </div>
        </div>

        <!-- Empty Results State -->
        <div
          v-else-if="!catalogData?.products || catalogData.products.length === 0"
          class="card bg-base-100 border border-base-200 text-center p-12"
        >
          <div class="flex flex-col items-center space-y-3">
            <Icon name="lucide:package-open" class="size-12 text-base-content/30" />
            <p class="font-semibold text-base-content">{{ t('catalog.noResults') }}</p>
            <button
              type="button"
              class="btn btn-sm border-none bg-brand-500 px-3 text-white hover:bg-brand-700 shadow-sm transition-all duration-200"
              @click="resetAllFilters"
            >
              {{ t('catalog.clearSearch') }}
            </button>
          </div>
        </div>

        <!-- AC-3: SSR Hydrated Product Cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <article
            v-for="product in catalogData.products"
            :key="product.id"
            class="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
        >
            <!-- Thumbnail Image & Badges -->
            <figure class="relative h-48 w-full bg-base-200 overflow-hidden">
            <img
                v-if="product.primaryImage?.url"
                :src="product.primaryImage.url"
                :alt="product.primaryImage.altText || getLocalized(product.name)"
                class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
            />
            <div v-else class="flex h-full w-full items-center justify-center text-base-content/30">
                <Icon name="lucide:image" class="size-10" />
            </div>

            <!-- Inventory Status Badge -->
            <span
                v-if="product.statusCode === 'OUT_OF_STOCK_ONLINE'"
                class="badge badge-warning badge-sm absolute top-3 right-3 shadow font-semibold"
            >
                {{ t('inventory.OUT_OF_STOCK_ONLINE') }}
            </span>
            <span
                v-else-if="product.statusCode === 'OUT_OF_STOCK'"
                class="badge badge-error badge-sm text-white absolute top-3 right-3 shadow font-semibold"
            >
                {{ t('inventory.OUT_OF_STOCK') }}
            </span>
            </figure>

            <!-- Card Content -->
            <div class="card-body p-4 flex flex-col justify-between flex-1">
                <!-- Top: Brand, Origin & Product Title -->
                <div>
                    <span class="text-xs uppercase tracking-wider text-base-content/50 font-semibold">
                        {{ product.brand }} <span v-if="product.countryOfOrigin">• {{ product.countryOfOrigin }}</span>
                    </span>
                    <h4 class="font-bold text-base text-base-content group-hover:text-primary transition line-clamp-2 mt-1">
                    <NuxtLink :to="`/products/${product.id}`">
                        {{ getLocalized(product.name) }}
                    </NuxtLink>
                    </h4>
                </div>

                <!-- Middle: Price & Jämförpris -->
                <div class="pt-3 border-t border-base-200 mt-4">
                    <div class="text-lg font-black text-base-content">
                        {{ (product.price[activeCurrency] / 100).toFixed(2) }} {{ activeCurrency }}
                    </div>
                    <div class="text-[11px] text-base-content/60">
                        {{ calculateComparisonPrice(product.price[activeCurrency], product.netQuantity) }}
                    </div>
                </div>

                <!-- Bottom: Dual Action Row -->
                <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-base-200">
                    <!-- View Product (Semantic NuxtLink Button) -->
                    <NuxtLink
                        :to="`/products/${product.id}`"
                        class="btn btn-sm btn-outline h-auto min-h-8 py-1.5 leading-tight border-base-content/20 text-base-content hover:bg-base-200 hover:border-base-content/30 gap-1.5 font-semibold transition-all"
                    >
                    <Icon name="lucide:eye" class="size-4" />
                    <span>{{ t('catalog.viewProduct') }}</span>
                    </NuxtLink>

                    <!-- Add to Cart -->
                    <button
                        type="button"
                        :disabled="!product.canAddToCart"
                        class="btn btn-sm !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-none gap-1.5 h-auto min-h-8 py-1.5 px-1 leading-tight font-bold hover:scale-[1.02] transition-all shadow-sm disabled:opacity-50 disabled:hover:scale-100"
                    >
                    <Icon name="lucide:shopping-cart" class="size-4" />
                    <span>{{ t('cart.add') }}</span>
                    </button>
                </div>
            </div>
        </article>
        </div>

        <!-- Pagination Controls -->
        <div
          v-if="catalogData && catalogData.pagination.totalPages > 1"
          class="flex justify-center items-center gap-2 mt-12"
        >
          <button
            type="button"
            :disabled="currentPage <= 1"
            class="btn btn-outline btn-sm"
            @click="changePage(currentPage - 1)"
          >
            {{ t('catalog.prev') }}
          </button>
          <span class="px-4 text-sm font-semibold text-base-content/70">
            {{ currentPage }} / {{ catalogData.pagination.totalPages }}
          </span>
          <button
            type="button"
            :disabled="currentPage >= catalogData.pagination.totalPages"
            class="btn btn-outline btn-sm"
            @click="changePage(currentPage + 1)"
          >
            {{ t('catalog.next') }}
          </button>
        </div>
      </main>
    </div>
  </div>
</template>