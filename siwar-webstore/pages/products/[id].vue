<!-- pages/products/[id].vue -->
<script setup lang="ts">
import { calculateJamforpris, type SupportedUnit } from '~/server/services/pricing.service'
import type { StorefrontProduct } from '~/types/product'

const route = useRoute()
const { t, locale } = useI18n()
const preferences = usePreferencesStore()

const productId = route.params.id as string

// SSR Data Fetching (NFR-1: TTFB < 200ms)
const { data: product, error } = await useAsyncData<StorefrontProduct>(
  `product-${productId}`,
  () => $fetch<StorefrontProduct>(`/api/products/${productId}` as string),
  {
    watch: [() => route.params.id],
  }
)

if (error.value || !product.value) {
  throw createError({
    statusCode: 404,
    statusMessage: t(  'admin.products.notFound') || 'Product not found',
    fatal: true,
  })
}

// Active Image Gallery State
const activeImageIndex = ref(0)
const selectedImage = computed(() => {
  if (!product.value?.images?.length) return null
  return product.value.images[activeImageIndex.value] || product.value.images[0]
})

// Quantity Selection State
const selectedQuantity = ref(1)

// Active Currency & Price Derivation
const activeCurrency = computed<'SEK' | 'EUR' | 'USD'>(() => preferences.currency || 'SEK')

const displayPrice = computed(() => {
  if (!product.value?.price) return '0.00'
  const minorPrice = product.value.price[activeCurrency.value] ?? product.value.price.SEK
  return (minorPrice / 100).toFixed(2)
})

// AC-1: Dynamic Jämförpris matching active currency
const comparisonPrice = computed(() => {
  if (!product.value?.netQuantity?.value || !product.value?.netQuantity?.unit) return null
  
  const unit = product.value.netQuantity.unit.toLowerCase() as SupportedUnit
  if (!['g', 'kg', 'ml', 'l'].includes(unit)) return null

  const minorPrice = product.value.price[activeCurrency.value] ?? product.value.price.SEK
  const unitPriceMinor = calculateJamforpris(minorPrice, product.value.netQuantity.value, unit)
  const formattedAmount = (unitPriceMinor / 100).toFixed(2)

  const referenceUnit = ['g', 'kg'].includes(unit) ? 'kg' : 'l'

  switch (activeCurrency.value) {
    case 'EUR':
      return `€${formattedAmount}/${referenceUnit}`
    case 'USD':
      return `$${formattedAmount}/${referenceUnit}`
    case 'SEK':
    default:
      return `${formattedAmount.replace('.', ',')} kr/${referenceUnit}`
  }
})

// Multilingual Helper with Fallback
function getLocalized(field?: { ar?: string; sv?: string; en?: string }): string {
  if (!field) return ''
  const current = field[locale.value as 'ar' | 'sv' | 'en']
  return current || field.sv || field.en || field.ar || ''
}

// AC-3: SSR OpenGraph & Social Scraper Compliance
const productName = computed(() => getLocalized(product.value?.name))
const productDescription = computed(() => getLocalized(product.value?.description))
const primaryImageUrl = computed(() => {
  const primary = product.value?.images?.find((img) => img.isPrimary)
  return primary?.url || product.value?.images?.[0]?.url || 'https://siwar.se/og-fallback.webp'
})

useSeoMeta({
  title: () => `${productName.value} | Siwar`,
  ogTitle: () => `${productName.value} - Siwar`,
  description: () => productDescription.value,
  ogDescription: () => productDescription.value,
  ogImage: () => primaryImageUrl.value,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: () => productName.value,
  twitterDescription: () => productDescription.value,
  twitterImage: () => primaryImageUrl.value,
})

// Add to Cart Action
function addToCart() {
  if (!product.value?.availability?.canAddToCart) return
  // Dispatches to Pinia cart store
}

const localePath = useLocalePath()
</script>

<template>
  <div v-if="product" class="container mx-auto px-4 py-8">
    <!-- Breadcrumb Navigation -->
    <nav class="text-sm breadcrumbs mb-8 mt-2 overflow-visible">
      <ul class="!flex flex-col sm:!flex-row flex-wrap gap-2 w-full">
        <li class="w-full sm:w-auto">
          <NuxtLink :to="localePath('/')" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
            <Icon name="lucide:home" class="size-4 shrink-0" />
            <span class="whitespace-nowrap">{{ t('nav.home') }}</span>
          </NuxtLink>
        </li>
        <li class="w-full sm:w-auto">
          <NuxtLink :to="localePath('/catalog')" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
            <Icon name="lucide:shopping-bag" class="size-4 shrink-0" />
            <span class="whitespace-nowrap">{{ t('nav.catalog') }}</span>
          </NuxtLink>
        </li>
        <li v-if="product.category" class="w-full sm:w-auto">
          <NuxtLink :to="localePath(`/catalog?category=${getLocalized(product.category.slug)}`)" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
            <Icon name="lucide:tag" class="size-4 shrink-0" />
            <span class="whitespace-nowrap">{{ getLocalized(product.category.name) }}</span>
          </NuxtLink>
        </li>
        <li class="w-full sm:w-auto">
          <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
            <Icon name="lucide:package" class="size-4 shrink-0" />
            <span class="whitespace-nowrap">{{ productName }}</span>
          </div>
        </li>
      </ul>
    </nav>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <!-- Left: Responsive Image Gallery -->
      <section class="flex flex-col gap-4">
        <!-- Main Image Stage -->
        <div class="relative aspect-square w-full rounded-2xl bg-base-200 overflow-hidden border border-base-300 shadow-inner flex items-center justify-center">
          <img
            v-if="selectedImage"
            :src="selectedImage.url"
            :alt="selectedImage.altText || productName"
            class="h-full w-full object-contain p-4 transition-all duration-300"
            loading="eager"
            fetchpriority="high"
          />
          <div v-else class="text-base-content/30 flex flex-col items-center gap-2">
            <Icon name="lucide:image" class="size-16" />
            <span class="text-sm">{{ t(  'admin.products.noImage') }}</span>
          </div>

          <!-- Stock Status Badge -->
          <span
            v-if="product.availability.statusCode === 'OUT_OF_STOCK_ONLINE'"
            class="badge badge-warning badge-md absolute top-4 end-4 shadow-md font-bold px-3 py-1"
          >
            {{ t('inventory.OUT_OF_STOCK_ONLINE') }}
          </span>
          <span
            v-else-if="product.availability.statusCode === 'OUT_OF_STOCK'"
            class="badge badge-error badge-md text-white absolute top-4 end-4 shadow-md font-bold px-3 py-1"
          >
            {{ t('inventory.OUT_OF_STOCK') }}
          </span>
        </div>

        <!-- WebP Thumbnail Row -->
        <div
          v-if="product.images && product.images.length > 1"
          class="flex items-center gap-3 overflow-x-auto pb-2"
        >
          <button
            v-for="(img, idx) in product.images"
            :key="idx"
            type="button"
            @click="activeImageIndex = idx"
            :class="[
              'relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 bg-base-200 transition',
              activeImageIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-base-300 opacity-70 hover:opacity-100'
            ]"
          >
            <img
              :src="img.url"
              :alt="img.altText || `${productName} ${idx + 1}`"
              class="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        </div>
      </section>

      <!-- Right: Product Information & Purchase Actions -->
      <section class="flex flex-col justify-between">
        <div class="space-y-4">
          <!-- Brand & Origin -->
          <div class="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-base-content/60">
            <span>{{ product.brand }}</span>
            <span v-if="product.countryOfOrigin">• {{ product.countryOfOrigin }}</span>
            <span v-if="product.netQuantity">• {{ product.netQuantity.value }} {{ product.netQuantity.unit }}</span>
          </div>

          <!-- Title -->
          <h1 class="text-2xl sm:text-3xl font-black text-base-content">
            {{ productName }}
          </h1>

          <!-- Price & Jämförpris Section (AC-1) -->
          <div class="p-4 rounded-xl bg-base-200/60 border border-base-200 flex items-baseline justify-between">
            <div>
              <div class="text-3xl font-black text-base-content">
                {{ displayPrice }} {{ activeCurrency }}
              </div>
              <div v-if="comparisonPrice" class="text-xs text-base-content/70 mt-0.5">
                {{ t(  'admin.products.jamforpris') }}: <span class="font-semibold">{{ comparisonPrice }}</span>
              </div>
            </div>
            <span class="text-xs text-base-content/50">
              {{ t(  'admin.products.taxIncluded', { rate: product.momsRate }) }}
            </span>
          </div>

          <!-- Marketing Description -->
          <div class="prose prose-sm max-w-none text-base-content/80 leading-relaxed pt-2">
            <p>{{ productDescription }}</p>
          </div>

          <!-- Separated Ingredients (EU 1169/2011 & FR-1) -->
          <div v-if="getLocalized(product.ingredients)" class="pt-4 border-t border-base-200">
            <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/70 mb-1">
              {{ t(  'admin.products.ingredientsTitle') }}
            </h2>
            <p class="text-sm text-base-content/80 leading-relaxed bg-base-100 p-3 rounded-lg border border-base-200">
              {{ getLocalized(product.ingredients) }}
            </p>
          </div>

          <!-- Allergen Declarations -->
          <div v-if="product.allergens && product.allergens.length" class="pt-2">
            <span class="text-xs font-bold text-error/90 uppercase tracking-wider">
              {{ t(  'admin.products.allergensTitle') }}:
            </span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              <span
                v-for="allergen in product.allergens"
                :key="allergen._id"
                class="badge badge-error badge-outline badge-sm font-semibold"
              >
                {{ getLocalized(allergen.name) }}
              </span>
            </div>
          </div>

          <!-- AC-2: Nutrition Facts Table (Structured + Package Image Reference) -->
          <div class="pt-4 border-t border-base-200">
            <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/70 mb-2">
              {{ t(  'admin.products.nutritionTitle') }}
            </h2>

            <!-- Render structured table if values are defined -->
            <div
              v-if="product.nutritionTable && Object.keys(product.nutritionTable).length"
              class="overflow-x-auto rounded-lg border border-base-200"
            >
              <table class="table table-xs w-full">
                <thead>
                  <tr class="bg-base-200/50">
                    <th class="font-bold">{{ t(  'admin.products.nutritionPer100') }}</th>
                    <th class="text-end font-bold">{{ t(  'admin.products.nutritionAmount') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="product.nutritionTable.energyKj != null || product.nutritionTable.energyKcal != null">
                    <td>{{ t('admin.products.nutrition.energy') }}</td>
                    <td class="text-end font-mono">
                      {{ product.nutritionTable.energyKj ?? '-' }} kJ / {{ product.nutritionTable.energyKcal ?? '-' }} kcal
                    </td>
                  </tr>
                  <tr v-if="product.nutritionTable.fat != null">
                    <td>{{ t('admin.products.nutrition.fat') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.fat }} g</td>
                  </tr>
                  <tr v-if="product.nutritionTable.saturatedFat != null" class="text-base-content/70">
                    <td class="ps-6">↳ {{ t('admin.products.nutrition.saturatedFat') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.saturatedFat }} g</td>
                  </tr>
                  <tr v-if="product.nutritionTable.carbohydrates != null">
                    <td>{{ t('admin.products.nutrition.carbohydrates') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.carbohydrates }} g</td>
                  </tr>
                  <tr v-if="product.nutritionTable.sugars != null" class="text-base-content/70">
                    <td class="ps-6">↳ {{ t('admin.products.nutrition.sugars') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.sugars }} g</td>
                  </tr>
                  <tr v-if="product.nutritionTable.protein != null">
                    <td>{{ t('admin.products.nutrition.protein') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.protein }} g</td>
                  </tr>
                  <tr v-if="product.nutritionTable.salt != null">
                    <td>{{ t('admin.products.nutrition.salt') }}</td>
                    <td class="text-end font-mono">{{ product.nutritionTable.salt }} g</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Fallback notification directing user to packaging gallery -->
            <div v-else class="text-xs text-base-content/60 bg-base-200/40 p-3 rounded-lg flex items-center gap-2">
              <Icon name="lucide:info" class="size-4 shrink-0" />
              <span>{{ t(  'admin.products.nutritionOnPackageNotice') }}</span>
            </div>
          </div>
        </div>

        <!-- Add to Cart & Availability Boundary -->
        <div class="pt-6 border-t border-base-200 mt-6 space-y-3">
          <div class="flex items-center gap-3">
            <!-- Quantity Selector -->
            <div class="join border border-base-300 rounded-lg">
              <button
                type="button"
                class="join-item btn btn-sm btn-ghost px-3"
                :disabled="selectedQuantity <= 1 || !product.availability.canAddToCart"
                @click="selectedQuantity--"
              >
                -
              </button>
              <span class="join-item px-4 flex items-center text-sm font-semibold">
                {{ selectedQuantity }}
              </span>
              <button
                type="button"
                class="join-item btn btn-sm btn-ghost px-3"
                :disabled="selectedQuantity >= product.availability.availableStock || !product.availability.canAddToCart"
                @click="selectedQuantity++"
              >
                +
              </button>
            </div>

            <!-- Submit Button (FR-4 & AC-1) -->
            <button
              type="button"
              :disabled="!product.availability.canAddToCart"
              @click="addToCart"
              class="btn btn-md flex-1 !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-none font-bold gap-2 shadow transition-all disabled:opacity-50"
            >
              <Icon name="lucide:shopping-cart" class="size-5" />
              <span>{{ product.availability.canAddToCart ? t('cart.add') : t('inventory.' + product.availability.statusCode) }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>