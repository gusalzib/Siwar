<!-- components/ProductCard.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFavoritesStore } from '~/stores/favorites'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore, type CurrencyCode } from '~/stores/preferences'

interface ProductProps {
  id: string
  name: Record<string, any>
  brand?: string
  countryOfOrigin?: string
  primaryImage?: { url: string; altText?: string } | null
  images?: Array<{ url: string; altText?: string }>
  price: Record<string, any>
  discount?: number
  discountStartsAt?: Date | string | null
  discountExpiresAt?: Date | string | null
  discountedPrice?: Record<string, any> | null
  statusCode?: string
  canAddToCart?: boolean
  netQuantity?: { value: number; unit: string }
  grossWeight?: number
  momsRate?: number
  availableStock?: number
  [key: string]: any
}

const props = defineProps<{
  product: ProductProps
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const favoritesStore = useFavoritesStore()
const cartStore = useCartStore()
const preferences = usePreferencesStore()

// Active Store Currency
const activeCurrency = computed<CurrencyCode>(() => (preferences.currency || 'SEK') as CurrencyCode)

// Campaign Urgency (Deadline <= 48 hours)
const isExpiringSoon = computed<boolean>(() => {
  if (!props.product.discount || props.product.discount <= 0 || !props.product.discountExpiresAt) {
    return false
  }
  const expiry = new Date(props.product.discountExpiresAt)
  if (Number.isNaN(expiry.getTime())) return false
  const diffMs = expiry.getTime() - Date.now()
  return diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000
})

// Micro-animation trigger for favorite toggle
const isAnimating = ref(false)

const productId = computed(() => String(props.product.id || (props.product as any)._id || ''))

const isFav = computed(() => favoritesStore.isFavorite(productId.value))

function handleToggleFavorite() {
  if (!productId.value) return
  isAnimating.value = true
  favoritesStore.toggleFavorite(productId.value)
  setTimeout(() => {
    isAnimating.value = false
  }, 400)
}

function handleAddToCart() {
  if (!props.product.canAddToCart || !productId.value) return

  const primaryImg = props.product.primaryImage?.url || props.product.images?.[0]?.url || ''
  const resolvedDiscountPrice = props.product.discountedPrice || (props.product as any).discountPrice
  const effectivePrice = (props.product.discount && props.product.discount > 0 && resolvedDiscountPrice)
    ? resolvedDiscountPrice
    : props.product.price

  cartStore.addItem(
    {
      productId: productId.value,
      name: props.product.name,
      thumbnailUrl: primaryImg,
      price: effectivePrice as any,
      momsRate: (props.product.momsRate || 12) as 12 | 25,
      grossWeight: props.product.grossWeight || 0,
      availableStock: props.product.availableStock ?? 0,
    },
    1
  )
}

function getLocalized(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj.sv || obj.en || obj.ar || ''
}

function calculateComparisonPrice(
  priceMinor: number,
  netQuantity?: { value: number; unit: string }
): string {
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
</script>

<template>
  <article
    class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 hover:border-emerald-600/70 dark:hover:border-emerald-500 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group rounded-2xl"
  >
    <!-- Thumbnail Image & Badges with Uniform Aspect Ratio & Neutral Backdrop -->
    <figure class="relative h-52 w-full bg-neutral-50 dark:bg-zinc-900/60 overflow-hidden flex items-center justify-center p-3 border-b border-base-200 dark:border-zinc-800">
      <NuxtLink :to="localePath(`/products/${product.id}`)" class="block h-full w-full">
        <img
          v-if="product.primaryImage?.url"
          :src="product.primaryImage.url"
          :alt="product.primaryImage.altText || getLocalized(product.name)"
          class="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
          loading="lazy"
        />
        <div v-else class="flex h-full w-full items-center justify-center text-base-content/30">
          <Icon name="lucide:image" class="size-10" />
        </div>
      </NuxtLink>

      <!-- Distinctive Discount Tag & Urgent Expiry Badge -->
      <div v-if="product.discount && product.discount > 0" class="absolute top-2.5 start-2.5 z-10 pointer-events-none flex flex-col items-start gap-1">
        <span
          class="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 shadow-md shadow-red-500/40 border border-white/20 select-none overflow-hidden tracking-wide"
        >
          <span class="absolute inset-0 bg-white/15 animate-pulse pointer-events-none" />
          <span class="relative flex size-2 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-90" />
            <span class="relative inline-flex rounded-full size-2 bg-amber-400" />
          </span>
          <span class="relative drop-shadow-xs">
            -{{ product.discount }}%
          </span>
        </span>

        <!-- Urgent Expiry Badge (Impending Deadline <= 48h) -->
        <span
          v-if="isExpiringSoon"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-black bg-amber-400 dark:bg-amber-400 shadow-sm border border-amber-500/30 select-none tracking-tight"
        >
          <Icon name="lucide:clock" class="size-3 shrink-0 text-black" />
          <span>{{ t('deals.endsSoon', 'Slutar snart') }}</span>
        </span>
      </div>

      <!-- Favorite Toggle Button (AC-1) -->
      <button
        type="button"
        :aria-label="isFav ? t('favorites.remove', 'Ta bort från favoriter') : t('favorites.add', 'Lägg till i favoriter')"
        :title="isFav ? t('favorites.remove', 'Ta bort från favoriter') : t('favorites.add', 'Lägg till i favoriter')"
        class="absolute top-2.5 end-2.5 z-20 btn btn-circle btn-sm bg-base-100 hover:bg-base-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-base-300/80 dark:border-zinc-700 shadow-md transition-all duration-200 active:scale-90"
        @click.stop.prevent="handleToggleFavorite"
      >
        <Icon
          name="lucide:heart"
          class="size-4 transition-all duration-300"
          :class="[
            isFav
              ? 'text-rose-500 fill-rose-500'
              : 'text-base-content/60 hover:text-rose-500',
            isAnimating ? 'scale-125' : 'scale-100'
          ]"
        />
      </button>
    </figure>

    <!-- Card Content -->
    <div class="card-body p-4 flex flex-col justify-between flex-1">
      <!-- Top: Brand, Origin & Product Title -->
      <div>
        <span class="text-xs uppercase tracking-wider text-base-content/50 font-semibold block truncate">
          {{ product.brand }} <span v-if="product.countryOfOrigin">• {{ product.countryOfOrigin }}</span>
        </span>
        <h4 class="font-bold text-base text-base-content group-hover:text-primary transition line-clamp-2 mt-1">
          <NuxtLink :to="localePath(`/products/${product.id}`)">
            {{ getLocalized(product.name) }}
          </NuxtLink>
        </h4>
      </div>

      <!-- Middle: Rounded Price Pill & Jämförpris -->
      <div class="pt-3 border-t border-base-200 dark:border-zinc-800 mt-3 space-y-1.5">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Rounded Price Pill with High-Contrast Currency Display -->
          <div class="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
            <template v-if="product.discount && product.discount > 0 && (product.discountedPrice || (product as any).discountPrice)">
              <span class="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {{ (((product.discountedPrice || (product as any).discountPrice)[activeCurrency] ?? (product.discountedPrice || (product as any).discountPrice).SEK ?? 0) / 100).toFixed(2) }}
              </span>
              <span class="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-tight">
                {{ activeCurrency }}
              </span>
              <span class="text-xs font-semibold text-base-content/40 dark:text-zinc-500 line-through ms-1">
                {{ ((product.price[activeCurrency] ?? product.price.SEK ?? 0) / 100).toFixed(2) }}
              </span>
            </template>
            <template v-else>
              <span class="text-base sm:text-lg font-black text-base-content dark:text-emerald-300 tracking-tight">
                {{ ((product.price[activeCurrency] ?? product.price.SEK ?? 0) / 100).toFixed(2) }}
              </span>
              <span class="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">
                {{ activeCurrency }}
              </span>
            </template>
          </div>

          <!-- Stock Status Badge if Out of Stock -->
          <div v-if="product.statusCode === 'OUT_OF_STOCK_ONLINE'">
            <span class="badge badge-warning badge-sm shadow-xs font-semibold">
              {{ t('inventory.OUT_OF_STOCK_ONLINE', 'Slut online') }}
            </span>
          </div>
          <div v-else-if="product.statusCode === 'OUT_OF_STOCK'">
            <span class="badge badge-error badge-sm text-white shadow-xs font-semibold">
              {{ t('inventory.OUT_OF_STOCK', 'Slut i lager') }}
            </span>
          </div>
        </div>

        <!-- Jämförpris -->
        <div class="text-[11px] font-medium text-base-content/60 dark:text-zinc-400">
          {{
            calculateComparisonPrice(
              (product.discount && product.discount > 0 && (product.discountedPrice || (product as any).discountPrice))
                ? ((product.discountedPrice || (product as any).discountPrice)[activeCurrency] ?? (product.discountedPrice || (product as any).discountPrice).SEK ?? 0)
                : (product.price[activeCurrency] ?? product.price.SEK ?? 0),
              product.netQuantity
            )
          }}
        </div>
      </div>

      <!-- Bottom: Dual Action Row -->
      <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-base-200 dark:border-zinc-800">
        <!-- View Product -->
        <NuxtLink
          :to="localePath(`/products/${product.id}`)"
          class="btn btn-sm h-9 min-h-9 py-0 border border-base-300 dark:border-zinc-700 hover:border-emerald-500 bg-base-100 hover:bg-base-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-base-content font-bold transition-all rounded-xl text-center flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <Icon name="lucide:eye" class="size-4 shrink-0" />
          <span>{{ t('catalog.viewProduct', 'Visa') }}</span>
        </NuxtLink>

        <!-- Add to Cart -->
        <button
          type="button"
          :disabled="!product.canAddToCart"
          @click.stop="handleAddToCart"
          class="btn btn-sm h-9 min-h-9 py-0 !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-none gap-1.5 font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-sm rounded-xl disabled:opacity-50 disabled:hover:scale-100 text-center flex items-center justify-center"
        >
          <Icon name="lucide:shopping-cart" class="size-4 shrink-0" />
          <span>{{ t('cart.add', 'Köp') }}</span>
        </button>
      </div>
    </div>
  </article>
</template>
