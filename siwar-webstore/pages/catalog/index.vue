<!-- pages/catalog/index.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const localePath = useLocalePath() 
const cartStore = useCartStore()
const preferences = usePreferencesStore()

// Active Store Currency
const activeCurrency = computed(() => preferences.currency || 'SEK')

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
const onlyDeals = ref(route.query.hasDiscount === 'true' || route.query.discount === 'true')

// Sync deals filter if route query changes
watch(
  () => [route.query.hasDiscount, route.query.discount],
  ([newHasDiscount, newDiscount]) => {
    onlyDeals.value = newHasDiscount === 'true' || newDiscount === 'true'
  }
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
        hasDiscount: route.query.hasDiscount || route.query.discount || (onlyDeals.value ? 'true' : undefined),
      },
    }),
  {
    watch: [() => route.query],
  }
)

function handleAddToCart(product: any) {
  if (!product.canAddToCart) return

  const primaryImg = product.primaryImage?.url || product.images?.[0]?.url || ''
  const resolvedDiscountPrice = product.discountedPrice || product.discountPrice
  const effectivePrice = (product.discount && product.discount > 0 && resolvedDiscountPrice)
    ? resolvedDiscountPrice
    : product.price

  cartStore.addItem(
    {
      productId: product.id || product._id,
      name: product.name,
      thumbnailUrl: primaryImg,
      price: effectivePrice,
      momsRate: product.momsRate || 12,
      grossWeight: product.grossWeight || 0,
      availableStock: product.availableStock,
    },
    1 // Add single quantity from catalog view
  )

  // Open the drawer immediately
  // cartStore.toggleDrawer(true)
  // commented out because I do not want the cart to open every time a customer adds something to it. 
}

// 4. Clean URL Sync for Deep-Linking
function applyFiltersToUrl(overrides: Record<string, any> = {}) {
  const query: Record<string, string | undefined> = {
    q: searchQuery.value.trim() || undefined,
    category: selectedCategory.value || undefined,
    sort: selectedSort.value !== 'newest' ? selectedSort.value : undefined,
    brand: selectedBrands.value.length ? selectedBrands.value.join(',') : undefined,
    origin: selectedOrigins.value.length ? selectedOrigins.value.join(',') : undefined,
    excludeAllergens: excludedAllergens.value.length ? excludedAllergens.value.join(',') : undefined,
    hasDiscount: onlyDeals.value ? 'true' : undefined,
    page: currentPage.value > 1 ? String(currentPage.value) : undefined,
    ...overrides,
  }

  Object.keys(query).forEach((key) => query[key] === undefined && delete query[key])
  router.push({ query })
}

function toggleOnlyDeals() {
  onlyDeals.value = !onlyDeals.value
  currentPage.value = 1
  applyFiltersToUrl({ page: undefined })
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
  onlyDeals.value = false
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
  <div class="min-h-screen container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 pb-16">
    <!-- Top Filter & Search Controls Header -->
    <div class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl">
      <div class="card-body p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <!-- Multilingual Search Input (AC-1) -->
        <div class="join w-full md:max-w-md shadow-xs">
          <span class="join-item btn btn-sm h-11 no-animation !bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700 !text-white px-3.5">
            <Icon name="lucide:search" class="size-5" />
          </span>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('catalog.searchPlaceholder')"
            class="input input-sm h-11 input-bordered border-2 border-base-300 dark:border-zinc-700 focus:border-emerald-500 join-item w-full focus:outline-none bg-base-100 dark:bg-zinc-800 text-base-content text-sm font-medium"
            @input="onSearchInput"
          />
        </div>

        <div class="flex items-center gap-3">
          <!-- Mobile Filter Toggle -->
          <button
            type="button"
            class="btn btn-outline btn-sm h-11 lg:hidden gap-2 border-2 border-base-300 dark:border-zinc-700 text-base-content dark:text-zinc-200 hover:border-emerald-500 rounded-xl cursor-pointer"
            @click="isMobileDrawerOpen = !isMobileDrawerOpen"
          >
            <Icon name="lucide:sliders-horizontal" class="size-4" />
            <span>{{ t('catalog.filtersTitle') }}</span>
            <span
              v-if="selectedBrands.length + selectedOrigins.length + excludedAllergens.length + (selectedCategory ? 1 : 0) + (onlyDeals ? 1 : 0) > 0"
              class="badge !bg-emerald-600 !text-white badge-xs"
            >
              {{ selectedBrands.length + selectedOrigins.length + excludedAllergens.length + (selectedCategory ? 1 : 0) + (onlyDeals ? 1 : 0) }}
            </span>
          </button>

          <!-- Sort Select -->
          <select
            v-model="selectedSort"
            class="select select-bordered select-sm h-11 border-2 border-base-300 dark:border-zinc-700 bg-base-100 dark:bg-zinc-800 text-base-content font-bold shadow-xs cursor-pointer w-auto ps-4 pe-10 transition-all rounded-xl focus:border-emerald-500 focus:outline-none"
            @change="applyFiltersToUrl()"
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
        <div class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl">
          <div class="card-body p-5 sm:p-6 space-y-6">
            <!-- Sidebar Header -->
            <div class="flex items-center justify-between border-b-2 border-base-300 dark:border-zinc-700 pb-3.5">
              <h2 class="font-bold text-base flex items-center gap-2">
                <Icon name="lucide:filter" class="size-4.5 text-emerald-600" />
                <span>{{ t('catalog.filtersTitle') }}</span>
              </h2>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-emerald-600 hover:text-emerald-700 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg px-2 cursor-pointer"
                @click="resetAllFilters"
              >
                {{ t('catalog.resetFilters') }}
              </button>
            </div>

            <!-- Only Deals Filter Toggle -->
            <div class="rounded-xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/30 p-3.5 flex items-center justify-between gap-2 shadow-2xs">
              <label class="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-rose-700 dark:text-rose-300">
                <span class="relative flex size-2 shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80" />
                  <span class="relative inline-flex rounded-full size-2 bg-rose-500" />
                </span>
                <span>{{ t('catalog.onlyDeals') }}</span>
              </label>
              <input
                type="checkbox"
                :checked="onlyDeals"
                class="toggle toggle-error toggle-sm cursor-pointer"
                @change="toggleOnlyDeals"
              />
            </div>

            <!-- 4px Thick Section Divider -->
            <hr class="h-1 border-0 border-t-[4px] border-slate-300 dark:border-zinc-600 bg-slate-300 dark:bg-zinc-600 my-5 rounded-full" />

            <!-- Categories -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/70 dark:text-zinc-300 mb-2.5 cursor-pointer list-none select-none hover:text-emerald-600 transition-colors [&::-webkit-details-marker]:hidden">
                <span class="flex items-center gap-1.5">
                  <Icon name="lucide:layout-grid" class="size-4 text-emerald-600" />
                  <span>{{ t('catalog.categories') }}</span>
                </span>
                <Icon name="lucide:chevron-down" class="size-4 transition-transform duration-200 group-open:-rotate-180" />
              </summary>
              <ul class="space-y-2 mt-2.5">
                <li
                  v-for="cat in facetOptions?.categories"
                  :key="cat.id"
                >
                  <button
                    type="button"
                    @click="toggleCategory(cat)"
                    :class="[
                      'w-full text-start flex items-center justify-between px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer select-none border-2',
                      isCategorySelected(cat)
                        ? '!bg-emerald-600 !text-white !border-emerald-600 shadow-sm font-bold'
                        : 'bg-base-200/60 dark:bg-zinc-800/60 text-base-content border-base-200 dark:border-zinc-700/60 hover:border-emerald-500/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 hover:shadow-2xs'
                    ]"
                  >
                    <span>{{ getLocalized(cat.name) }}</span>
                    <Icon 
                      v-if="isCategorySelected(cat)" 
                      name="lucide:check" 
                      class="size-4 text-white shrink-0 stroke-[2.5]" 
                    />
                  </button>
                </li>
              </ul>
            </details>

            <!-- 4px Thick Section Divider -->
            <hr class="h-1 border-0 border-t-[4px] border-slate-300 dark:border-zinc-600 bg-slate-300 dark:bg-zinc-600 my-5 rounded-full" />

            <!-- Allergen Exclusion (AC-2) -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2.5 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                <div class="flex items-center gap-1.5">
                  <Icon name="lucide:shield-ban" class="size-4 text-rose-600 dark:text-rose-400" />
                  <span>{{ t('catalog.allergenExclusionTitle') }}</span>
                </div>
                <Icon name="lucide:chevron-down" class="size-4 transition-transform duration-200 group-open:-rotate-180" />
              </summary>
              <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="allergen in facetOptions?.allergens"
                  :key="allergen.id"
                  class="flex items-center gap-2.5 text-sm py-1 px-1.5 rounded-lg hover:bg-base-200/70 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="excludedAllergens.includes(allergen.code || allergen.id)"
                    class="checkbox checkbox-error checkbox-sm border-2 border-base-300 dark:border-zinc-500 cursor-pointer"
                    @change="toggleAllergenExclusion(allergen.code || allergen.id)"
                  />
                  <span>{{ getLocalized(allergen.name) }}</span>
                </label>
              </div>
            </details>

            <!-- 4px Thick Section Divider -->
            <hr class="h-1 border-0 border-t-[4px] border-slate-300 dark:border-zinc-600 bg-slate-300 dark:bg-zinc-600 my-5 rounded-full" />

            <!-- Brands -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/70 dark:text-zinc-300 mb-2.5 cursor-pointer list-none select-none hover:text-emerald-600 transition-colors [&::-webkit-details-marker]:hidden">
                <span class="flex items-center gap-1.5">
                  <Icon name="lucide:award" class="size-4 text-emerald-600" />
                  <span>{{ t('catalog.brands') }}</span>
                </span>
                <Icon name="lucide:chevron-down" class="size-4 transition-transform duration-200 group-open:-rotate-180" />
              </summary>
              <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="brand in facetOptions?.brands"
                  :key="brand"
                  class="flex items-center gap-2.5 text-sm py-1 px-1.5 rounded-lg hover:bg-base-200/70 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="selectedBrands.includes(brand)"
                    class="checkbox checkbox-primary checkbox-sm border-2 border-base-300 dark:border-zinc-500 cursor-pointer"
                    @change="toggleBrand(brand)"
                  />
                  <span>{{ brand }}</span>
                </label>
              </div>
            </details>

            <!-- 4px Thick Section Divider -->
            <hr class="h-1 border-0 border-t-[4px] border-slate-300 dark:border-zinc-600 bg-slate-300 dark:bg-zinc-600 my-5 rounded-full" />

            <!-- Country of Origin -->
            <details class="group" open>
              <summary class="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-base-content/70 dark:text-zinc-300 mb-2.5 cursor-pointer list-none select-none hover:text-emerald-600 transition-colors [&::-webkit-details-marker]:hidden">
                <span class="flex items-center gap-1.5">
                  <Icon name="lucide:globe" class="size-4 text-emerald-600" />
                  <span>{{ t('catalog.origin') }}</span>
                </span>
                <Icon name="lucide:chevron-down" class="size-4 transition-transform duration-200 group-open:-rotate-180" />
              </summary>
              <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1 mt-1">
                <label
                  v-for="origin in facetOptions?.origins"
                  :key="origin"
                  class="flex items-center gap-2.5 text-sm py-1 px-1.5 rounded-lg hover:bg-base-200/70 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="selectedOrigins.includes(origin)"
                    class="checkbox checkbox-primary checkbox-sm border-2 border-base-300 dark:border-zinc-500 cursor-pointer"
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
          <div v-for="n in 6" :key="n" class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 shadow-sm rounded-2xl overflow-hidden animate-pulse">
            <div class="h-52 bg-base-200 dark:bg-zinc-800 w-full" />
            <div class="card-body p-4 space-y-3">
              <div class="h-3 bg-base-300 dark:bg-zinc-700 rounded w-1/3" />
              <div class="h-4 bg-base-300 dark:bg-zinc-700 rounded w-3/4" />
              <div class="h-8 bg-base-200 dark:bg-zinc-800 rounded-xl w-1/2 mt-2" />
              <div class="grid grid-cols-2 gap-2 pt-2">
                <div class="h-9 bg-base-200 dark:bg-zinc-800 rounded-xl" />
                <div class="h-9 bg-base-200 dark:bg-zinc-800 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty Results State -->
        <div
          v-else-if="!catalogData?.products || catalogData.products.length === 0"
          class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl text-center p-12"
        >
          <div class="flex flex-col items-center space-y-3">
            <Icon name="lucide:package-open" class="size-12 text-base-content/30" />
            <p class="font-semibold text-base-content">{{ t('catalog.noResults') }}</p>
            <button
              type="button"
              class="btn btn-sm h-11 border-none !bg-emerald-600 hover:!bg-emerald-700 px-5 !text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              @click="resetAllFilters"
            >
              {{ t('catalog.clearSearch') }}
            </button>
          </div>
        </div>

        <!-- AC-3: SSR Hydrated Product Cards -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <ProductCard
            v-for="product in catalogData.products"
            :key="product.id"
            :product="product"
          />
        </div>

        <!-- Pagination Controls -->
        <div
          v-if="catalogData && catalogData.pagination.totalPages > 1"
          class="flex justify-center items-center gap-2 mt-12"
        >
          <button
            type="button"
            :disabled="currentPage <= 1"
            class="btn btn-outline btn-sm h-9 border-base-300 dark:border-zinc-700 text-base-content hover:bg-base-200 dark:hover:bg-zinc-800 font-bold rounded-xl"
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
            class="btn btn-outline btn-sm h-9 border-base-300 dark:border-zinc-700 text-base-content hover:bg-base-200 dark:hover:bg-zinc-800 font-bold rounded-xl"
            @click="changePage(currentPage + 1)"
          >
            {{ t('catalog.next') }}
          </button>
        </div>
      </main>
    </div>
  </div>
</template>