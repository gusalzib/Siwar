<!-- pages/favoriter.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useFavoritesStore } from '~/stores/favorites'
import ProductCard from '~/components/ProductCard.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const favoritesStore = useFavoritesStore()

const isLoading = ref(true)
const products = ref<any[]>([])

// Fetch product details for all stored favorite IDs
async function fetchFavoriteProducts() {
  const ids = favoritesStore.favoriteIds
  if (!ids || ids.length === 0) {
    products.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<any[]>('/api/products/batch', {
      method: 'POST',
      body: { ids },
    })
    products.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Failed to load favorite products:', err)
    products.value = []
  } finally {
    isLoading.value = false
  }
}

// Client-side hydration on mount
onMounted(() => {
  favoritesStore.hydrateFavorites()
  fetchFavoriteProducts()
})

// Reactively filter displayed products when favorites are removed in the UI
const activeFavoriteProducts = computed(() => {
  return products.value.filter((p) => favoritesStore.isFavorite(p.id || p._id))
})

// If cross-tab changes add new IDs that aren't in `products`, re-fetch
watch(
  () => favoritesStore.favoriteIds,
  (newIds) => {
    if (newIds.length === 0) {
      products.value = []
    } else {
      const knownIds = new Set(products.value.map((p) => p.id))
      const hasNewUnfetchedIds = newIds.some((id) => !knownIds.has(id))
      if (hasNewUnfetchedIds) {
        fetchFavoriteProducts()
      }
    }
  },
  { deep: true }
)

const clearModalRef = ref<HTMLDialogElement | null>(null)

function openClearModal() {
  clearModalRef.value?.showModal()
}

function closeClearModal() {
  clearModalRef.value?.close()
}

function confirmClearFavorites() {
  favoritesStore.clearFavorites()
  products.value = []
  clearModalRef.value?.close()
}

useSeoMeta({
  title: () => `${t('favorites.title', 'Mina favoriter')} | Siwar`,
  description: () => t('favorites.subtitle', 'Dina sparade favoritprodukter på ett och samma ställe.'),
  ogTitle: () => `${t('favorites.title', 'Mina favoriter')} | Siwar`,
  ogDescription: () => t('favorites.subtitle', 'Dina sparade favoritprodukter på ett och samma ställe.'),
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 space-y-8 min-h-[60vh]">
    <!-- Breadcrumb Navigation -->
    <nav class="text-sm breadcrumbs mt-2 overflow-visible">
      <ul class="!flex flex-row flex-wrap gap-2 w-full">
        <li>
          <NuxtLink
            :to="localePath('/')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all font-medium"
          >
            <Icon name="lucide:home" class="size-4 shrink-0" />
            <span>{{ t('nav.home', 'Hem') }}</span>
          </NuxtLink>
        </li>
        <li>
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
            <Icon name="lucide:heart" class="size-4 shrink-0 text-rose-500" />
            <span>{{ t('favorites.title', 'Mina favoriter') }}</span>
          </div>
        </li>
      </ul>
    </nav>

    <!-- Header Section with count and clear button -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-base-300 pb-5">
      <div>
        <div class="inline-flex items-center gap-2 mb-2">
          <span class="inline-flex items-center justify-center p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <Icon name="lucide:heart" class="size-5 fill-rose-500 text-rose-500" />
          </span>
          <span class="text-xs font-bold uppercase tracking-wider text-base-content/60">
            {{ t('nav.store', 'Butik') }}
          </span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
          {{ t('favorites.title', 'Mina favoriter') }}
        </h1>
        <p class="text-xs sm:text-sm text-base-content/70 mt-1">
          {{ t('favorites.subtitle', 'Dina sparade favoritprodukter på ett och samma ställe.') }}
        </p>
      </div>

      <!-- Action items when populated -->
      <div v-if="activeFavoriteProducts.length > 0" class="flex items-center gap-3 self-start sm:self-auto">
        <span class="badge badge-lg bg-base-100 text-base-content font-bold border border-base-300 px-3 py-3">
          {{
            activeFavoriteProducts.length === 1
              ? t('favorites.itemsCountOne', '1 sparad produkt')
              : t('favorites.itemsCount', { count: activeFavoriteProducts.length })
          }}
        </span>
        <button
          type="button"
          class="btn btn-sm btn-outline border-error/30 text-error hover:bg-error hover:text-white hover:border-error transition-all gap-1.5 rounded-xl font-semibold"
          @click="openClearModal"
        >
          <Icon name="lucide:trash-2" class="size-4" />
          <span>{{ t('favorites.clearAll', 'Rensa alla') }}</span>
        </button>
      </div>
    </div>

    <!-- Loading Skeleton State -->
    <div
      v-if="isLoading"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <div
        v-for="n in (favoritesStore.favoriteCount || 4)"
        :key="n"
        class="card bg-base-100 border border-base-200 animate-pulse rounded-2xl overflow-hidden"
      >
        <div class="h-48 bg-base-300 w-full" />
        <div class="card-body p-4 space-y-3">
          <div class="h-3 bg-base-300 rounded w-1/3" />
          <div class="h-5 bg-base-300 rounded w-3/4" />
          <div class="h-6 bg-base-300 rounded w-1/2 pt-2" />
          <div class="grid grid-cols-2 gap-2 pt-2">
            <div class="h-8 bg-base-300 rounded" />
            <div class="h-8 bg-base-300 rounded" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State (AC-2 & Task 6) -->
    <div
      v-else-if="activeFavoriteProducts.length === 0"
      class="card bg-base-100 border border-base-300 text-center py-16 px-6 max-w-xl mx-auto rounded-3xl shadow-sm"
    >
      <div class="flex flex-col items-center space-y-4">
        <!-- Empty State Illustration / Decorative Icon -->
        <div class="relative flex items-center justify-center size-20 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <Icon name="lucide:heart-off" class="size-10" />
        </div>

        <div class="space-y-1.5 max-w-md">
          <h2 class="text-xl sm:text-2xl font-black text-base-content tracking-tight">
            {{ t('favorites.emptyTitle', 'Inga sparade favoriter än') }}
          </h2>
          <p class="text-sm text-base-content/70">
            {{ t('favorites.emptySubtitle', 'Spara dina favoritprodukter genom att klicka på hjärtikonen när du handlar.') }}
          </p>
        </div>

        <!-- CTA Button back to catalog -->
        <div class="pt-2">
          <NuxtLink
            :to="localePath('/catalog')"
            class="btn bg-brand-500 hover:bg-brand-600 !text-white font-bold border-none shadow-md gap-2 rounded-xl px-6 transition-all hover:scale-[1.02]"
          >
            <Icon name="lucide:layout-grid" class="size-4" />
            <span>{{ t('favorites.exploreCta', 'Utforska sortimentet') }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Populated Product Grid (AC-2) -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <ProductCard
        v-for="product in activeFavoriteProducts"
        :key="product.id || product._id"
        :product="product"
      />
    </div>

    <!-- Clear Favorites Confirmation Modal (Teleported to Body) -->
    <ClientOnly>
      <Teleport to="body">
        <dialog ref="clearModalRef" class="modal" @close="closeClearModal">
          <div class="modal-box max-w-md bg-base-100 dark:bg-base-200 border border-base-300 shadow-2xl p-6 sm:p-7 rounded-3xl space-y-5 text-base-content">
            <div class="flex items-start gap-3.5">
              <div class="p-3 bg-error/10 text-error rounded-2xl shrink-0 mt-0.5">
                <Icon name="lucide:trash-2" class="size-6 text-error" />
              </div>
              <div class="space-y-1.5 flex-1">
                <h3 class="font-black text-lg text-base-content leading-snug">
                  {{ t('favorites.clearModalTitle', 'Rensa alla favoriter?') }}
                </h3>
                <p class="text-sm text-base-content/70 leading-relaxed font-normal">
                  {{ t('favorites.clearModalDesc', 'Är du säker på att du vill ta bort alla dina sparade favoriter? Denna åtgärd kan inte ångras.') }}
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-4 border-t border-base-300">
              <button
                type="button"
                class="btn btn-sm h-10 px-4 rounded-xl btn-ghost hover:bg-base-300 text-base-content font-semibold"
                @click="closeClearModal"
              >
                {{ t('favorites.clearCancel', 'Avbryt') }}
              </button>
              <button
                type="button"
                class="btn btn-sm h-10 px-4 rounded-xl !bg-red-600 hover:!bg-red-700 !text-white !border-none font-bold shadow-sm gap-1.5"
                @click="confirmClearFavorites"
              >
                <Icon name="lucide:trash-2" class="size-4" />
                <span>{{ t('favorites.clearConfirmBtn', 'Ja, rensa alla') }}</span>
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop bg-black/60">
            <button type="submit" @click="closeClearModal">close</button>
          </form>
        </dialog>
      </Teleport>
    </ClientOnly>
  </div>
</template>
