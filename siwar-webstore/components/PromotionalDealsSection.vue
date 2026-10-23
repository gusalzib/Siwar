<!-- components/PromotionalDealsSection.vue -->
<script setup lang="ts">
import { computed } from 'vue'
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

      <NuxtLink
        :to="localePath('/catalog')"
        class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:underline self-start sm:self-auto shrink-0"
      >
        <span>{{ t('home.deals.viewAll', 'Se alla erbjudanden') }}</span>
        <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
      </NuxtLink>
    </div>

    <!-- Product Deals Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <article
        v-for="product in deals"
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

          <!-- Bold Discount Tag (AC-2) -->
          <div class="absolute top-3 start-3 z-10">
            <span class="badge badge-error text-white font-black text-xs px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1">
              <Icon name="lucide:sparkles" class="size-3" />
              <span>{{ t('home.deals.save', { percent: product.discount }) }}</span>
            </span>
          </div>

          <!-- Inventory Status Badge -->
          <div v-if="!product.canAddToCart" class="absolute top-3 end-3 z-10">
            <span class="badge badge-warning badge-sm shadow font-semibold">
              {{ t('inventory.OUT_OF_STOCK_ONLINE', 'Slut i webblager') }}
            </span>
          </div>
        </figure>

        <!-- Card Body Content -->
        <div class="card-body p-4 flex flex-col justify-between flex-1 space-y-3">
          <!-- Top: Brand & Product Title -->
          <div>
            <span class="text-[11px] uppercase tracking-wider text-base-content/50 font-semibold block">
              {{ product.brand }} <span v-if="product.countryOfOrigin">• {{ product.countryOfOrigin }}</span>
            </span>
            <h3 class="font-bold text-sm sm:text-base text-base-content group-hover:text-primary transition line-clamp-2 mt-1">
              <NuxtLink :to="localePath(`/products/${product.id}`)">
                {{ getLocalized(product.name) }}
              </NuxtLink>
            </h3>
          </div>

          <!-- Middle: Price Strikethrough & Discounted Price (AC-2) -->
          <div class="pt-2 border-t border-base-200/80">
            <div class="flex items-baseline gap-2 flex-wrap">
              <!-- Discounted Active Price -->
              <span class="text-xl font-black text-error">
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
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-base-200/80">
            <!-- View Details Button -->
            <NuxtLink
              :to="localePath(`/products/${product.id}`)"
              class="btn btn-sm btn-outline h-9 border-base-content/20 text-base-content hover:bg-base-200 hover:border-base-content/30 gap-1.5 font-semibold transition-all rounded-xl text-xs"
            >
              <Icon name="lucide:eye" class="size-3.5" />
              <span>{{ t('catalog.viewProduct', 'Visa') }}</span>
            </NuxtLink>

            <!-- Add to Cart Button -->
            <button
              type="button"
              :disabled="!product.canAddToCart"
              class="btn btn-sm h-9 bg-emerald-600 hover:bg-emerald-700 text-white border-none gap-1.5 font-bold transition-all shadow-xs rounded-xl disabled:opacity-50 text-xs"
              @click.stop="handleAddToCart(product)"
            >
              <Icon name="lucide:shopping-cart" class="size-3.5 shrink-0" />
              <span>{{ t('cart.add', 'Köp') }}</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
