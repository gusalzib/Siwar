<!-- components/PromotionalDealsSection.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore, type CurrencyCode } from '~/stores/preferences'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const cartStore = useCartStore()
const preferences = usePreferencesStore()

// Active Store Currency
const activeCurrency = computed<CurrencyCode>(() => (preferences.currency || 'SEK') as CurrencyCode)

// Fetch active discounted deal products
const { data: deals } = await useAsyncData<any[]>(
  'promotional-deals',
  () => $fetch<any[]>('/api/products/deals')
)

// Pagination logic: up to 5 products per page
const currentPage = ref(1)
const pageSize = 5

const totalPages = computed(() => {
  if (!deals.value || deals.value.length === 0) return 1
  return Math.ceil(deals.value.length / pageSize)
})

const paginatedDeals = computed(() => {
  if (!deals.value) return []
  const start = (currentPage.value - 1) * pageSize
  return deals.value.slice(start, start + pageSize)
})

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function goToPage(page: number) {
  currentPage.value = page
}

// Helper: Safely resolve localized text across Arabic, Swedish, and English
function getLocalized(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj.sv || obj.en || obj.ar || ''
}

// Price formatter for minor units (öre/cents)
function formatPrice(priceObj?: Record<CurrencyCode, number>): string {
  if (!priceObj) return ''
  const amount = (priceObj[activeCurrency.value] ?? priceObj.SEK ?? 0) / 100
  return `${amount.toFixed(2)} ${activeCurrency.value}`
}

function handleAddToCart(product: any) {
  if (!product.canAddToCart) return

  const primaryImg = product.primaryImage?.url || ''

  cartStore.addItem(
    {
      productId: product.id,
      name: product.name,
      thumbnailUrl: primaryImg,
      price: product.discountedPrice || product.price,
      momsRate: product.momsRate || 12,
      grossWeight: product.grossWeight || 0,
      availableStock: product.availableStock,
    },
    1
  )
}
</script>

<template>
  <!-- AC-3: Gracefully collapse with v-if if no discounted products exist -->
  <section v-if="deals && deals.length > 0" class="max-w-7xl mx-auto px-4 space-y-6">
    <!-- Section Header -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-base-200 pb-4">
      <div>
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error/10 text-error text-xs font-black uppercase tracking-wider mb-2">
          <Icon name="lucide:flame" class="size-4 animate-pulse" />
          <span>{{ t('home.deals.badge', 'Specialerbjudande') }}</span>
        </div>
        <h2 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
          {{ t('home.deals.heading', 'Aktuella Kampanjer & Erbjudanden') }}
        </h2>
        <p class="text-xs sm:text-sm text-base-content/60 mt-1">
          {{ t('home.deals.subheading', 'Upptäck fantastiska prissänkningar på utvalda orientaliska delikatesser.') }}
        </p>
      </div>

      <div class="flex items-center gap-3 self-start sm:self-auto shrink-0 flex-wrap">
        <!-- Pagination Controls in Header (if totalPages > 1) -->
        <div v-if="totalPages > 1" class="flex items-center gap-1.5 bg-base-200/80 p-1 rounded-xl border border-base-300/60 shadow-2xs">
          <button
            type="button"
            :disabled="currentPage <= 1"
            :aria-label="t('catalog.prev', 'Föregående')"
            class="btn btn-ghost btn-xs btn-square rounded-lg disabled:opacity-30 hover:bg-base-100"
            @click="prevPage"
          >
            <Icon name="lucide:chevron-left" class="size-4 rtl:rotate-180" />
          </button>
          <span class="text-xs font-bold px-2 text-base-content/80 select-none">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            :disabled="currentPage >= totalPages"
            :aria-label="t('catalog.next', 'Nästa')"
            class="btn btn-ghost btn-xs btn-square rounded-lg disabled:opacity-30 hover:bg-base-100"
            @click="nextPage"
          >
            <Icon name="lucide:chevron-right" class="size-4 rtl:rotate-180" />
          </button>
        </div>

        <!-- View All Deals Button with discount>0 query filter -->
        <NuxtLink
          :to="localePath({ path: '/catalog', query: { hasDiscount: 'true' } })"
          class="btn btn-sm btn-outline border-error/40 text-error hover:bg-error hover:text-white hover:border-error rounded-xl gap-1.5 font-bold text-xs sm:text-sm transition-all shadow-xs"
        >
          <span>{{ t('home.deals.viewAll', 'Se alla erbjudanden') }}</span>
          <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
        </NuxtLink>
      </div>
    </div>

    <!-- Product Deals Grid: Exactly 5 items per page on desktop -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
      <article
        v-for="product in paginatedDeals"
        :key="product.id"
        class="card bg-base-100 border border-base-200 hover:border-error/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group rounded-2xl"
      >
        <!-- Thumbnail Image & Badges -->
        <figure class="relative h-48 w-full bg-base-200 overflow-hidden">
          <img
            v-if="product.primaryImage?.url"
            :src="product.primaryImage.url"
            :alt="product.primaryImage.altText || getLocalized(product.name)"
            class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-base-content/30">
            <Icon name="lucide:image" class="size-10" />
          </div>

          <!-- Bold Attention-Grabbing Discount Tag (Requirements 3 & 4) -->
          <div class="absolute top-2.5 start-2.5 z-10">
            <span
              class="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 shadow-md shadow-red-500/40 border border-white/20 select-none overflow-hidden tracking-wide"
            >
              <!-- Ambient pulse glow behind -->
              <span class="absolute inset-0 bg-white/15 animate-pulse pointer-events-none" />

              <!-- Animated live radar dot for eye-catching effect (replaces the star emoji) -->
              <span class="relative flex size-2 shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-90" />
                <span class="relative inline-flex rounded-full size-2 bg-amber-400" />
              </span>

              <span class="relative drop-shadow-xs">
                {{ t('home.deals.save', { percent: product.discount }) }}
              </span>
            </span>
          </div>

          <!-- Inventory Status Badge -->
          <div v-if="!product.canAddToCart" class="absolute top-2.5 end-2.5 z-10">
            <span class="badge badge-warning badge-sm shadow font-semibold">
              {{ t('inventory.OUT_OF_STOCK_ONLINE', 'Slut i webblager') }}
            </span>
          </div>
        </figure>

        <!-- Card Body Content -->
        <div class="card-body p-3.5 sm:p-4 flex flex-col justify-between flex-1 space-y-2.5">
          <!-- Top: Brand & Product Title -->
          <div>
            <span class="text-[10px] sm:text-[11px] uppercase tracking-wider text-base-content/50 font-semibold block truncate">
              {{ product.brand }} <span v-if="product.countryOfOrigin">• {{ product.countryOfOrigin }}</span>
            </span>
            <h3 class="font-bold text-xs sm:text-sm text-base-content group-hover:text-primary transition line-clamp-2 mt-1 min-h-[2.5rem]">
              <NuxtLink :to="localePath(`/products/${product.id}`)">
                {{ getLocalized(product.name) }}
              </NuxtLink>
            </h3>
          </div>

          <!-- Middle: Price Strikethrough & Discounted Price -->
          <div class="pt-2 border-t border-base-200/80">
            <div class="flex items-baseline gap-2 flex-wrap">
              <!-- Discounted Active Price -->
              <span class="text-lg sm:text-xl font-black text-error">
                {{ formatPrice(product.discountedPrice) }}
              </span>
              <!-- Strikethrough Original Price -->
              <span class="text-xs font-semibold text-base-content/50 line-through">
                {{ formatPrice(product.price) }}
              </span>
            </div>
            <div v-if="product.netQuantity?.value" class="text-[11px] text-base-content/60 mt-0.5 font-medium">
              {{ product.netQuantity.value }} {{ product.netQuantity.unit }}
            </div>
          </div>

          <!-- Bottom: Action Buttons -->
          <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-base-200/80">
            <!-- View Details Button -->
            <NuxtLink
              :to="localePath(`/products/${product.id}`)"
              class="btn btn-xs sm:btn-sm btn-outline border-base-content/20 text-base-content hover:bg-base-200 hover:border-base-content/30 gap-1 font-semibold transition-all rounded-xl text-xs px-2"
            >
              <Icon name="lucide:eye" class="size-3.5 shrink-0" />
              <span>{{ t('catalog.viewProduct', 'Visa') }}</span>
            </NuxtLink>

            <!-- Add to Cart Button -->
            <button
              type="button"
              :disabled="!product.canAddToCart"
              class="btn btn-xs sm:btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-1 font-bold transition-all shadow-xs rounded-xl disabled:opacity-50 text-xs px-2"
              @click.stop="handleAddToCart(product)"
            >
              <Icon name="lucide:shopping-cart" class="size-3.5 shrink-0" />
              <span>{{ t('cart.add', 'Köp') }}</span>
            </button>
          </div>
        </div>
      </article>
    </div>

    <!-- Bottom Pagination Dots & Arrows (if totalPages > 1) -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        :disabled="currentPage <= 1"
        :aria-label="t('catalog.prev', 'Föregående')"
        class="btn btn-circle btn-xs btn-ghost disabled:opacity-30"
        @click="prevPage"
      >
        <Icon name="lucide:chevron-left" class="size-4 rtl:rotate-180" />
      </button>

      <div class="flex items-center gap-1.5">
        <button
          v-for="page in totalPages"
          :key="page"
          type="button"
          :aria-label="`Page ${page}`"
          :class="[
            'transition-all duration-200 rounded-full cursor-pointer',
            currentPage === page
              ? 'w-7 h-2.5 bg-error shadow-xs'
              : 'w-2.5 h-2.5 bg-base-300 hover:bg-base-content/30'
          ]"
          @click="goToPage(page)"
        />
      </div>

      <button
        type="button"
        :disabled="currentPage >= totalPages"
        :aria-label="t('catalog.next', 'Nästa')"
        class="btn btn-circle btn-xs btn-ghost disabled:opacity-30"
        @click="nextPage"
      >
        <Icon name="lucide:chevron-right" class="size-4 rtl:rotate-180" />
      </button>
    </div>
  </section>
</template>
