<!-- pages/index.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import PromotionalDealsSection from '~/components/PromotionalDealsSection.vue'

interface LocalizedField {
  [key: string]: string
}

interface CategoryFacet {
  id: string
  name: LocalizedField
  slug: LocalizedField
  imageUrl?: string | null
  productCount?: number
}

interface AllergenFacet {
  id: string
  code: string
  name: LocalizedField
}

interface StorefrontBanner {
  id: string
  title: LocalizedField
  subtitle: LocalizedField
  badge?: LocalizedField
  imageUrl: string
  mobileImageUrl?: string
  linkUrl: string
  sortOrder: number
}

interface FilterFacets {
  categories: CategoryFacet[]
  allergens: AllergenFacet[]
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const router = useRouter()

// 1. Local search input state
const searchInput = ref('')
const selectedAllergens = ref<string[]>([])

// 2. Fetch Category taxonomy and common allergens for quick pills
const { data: facetData } = await useAsyncData<FilterFacets>(
  'home-categories',
  () => $fetch<FilterFacets>('/api/catalog/filters' as string)
)

// 3. Fetch active promotional banners for dynamic hero
const { data: banners } = await useAsyncData<StorefrontBanner[]>(
  'hero-banners',
  () => $fetch<StorefrontBanner[]>('/api/banners' as string)
)

// 4. Hero Carousel state & auto-play logic
const currentSlide = ref(0)
let autoplayTimer: ReturnType<typeof setInterval> | null = null

function startAutoplay() {
  if (autoplayTimer) clearInterval(autoplayTimer)
  if (!banners.value || banners.value.length <= 1) return
  autoplayTimer = setInterval(() => {
    if (!banners.value || banners.value.length <= 1) return
    currentSlide.value = (currentSlide.value + 1) % banners.value.length
  }, 5000)
}

function pauseAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

function resumeAutoplay() {
  startAutoplay()
}

function nextSlide() {
  if (!banners.value || banners.value.length === 0) return
  currentSlide.value = (currentSlide.value + 1) % banners.value.length
  startAutoplay()
}

function prevSlide() {
  if (!banners.value || banners.value.length === 0) return
  currentSlide.value = (currentSlide.value - 1 + banners.value.length) % banners.value.length
  startAutoplay()
}

function goToSlide(idx: number) {
  currentSlide.value = idx
  startAutoplay()
}

onMounted(() => {
  startAutoplay()
})

onUnmounted(() => {
  pauseAutoplay()
})

// Helper: Safely resolve localized text across Arabic, Swedish, and English
function getLocalized(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj.sv || obj.en || obj.ar || ''
}

// 5. Seamless Transition to /catalog preserving active locale
function submitSearch() {
  const query: Record<string, string | undefined> = {}

  if (searchInput.value.trim()) {
    query.q = searchInput.value.trim()
  }

  if (selectedAllergens.value.length > 0) {
    query.excludeAllergens = selectedAllergens.value.join(',')
  }

  // localePath keeps the current language prefix (e.g., /sv/catalog or /en/catalog)
  router.push(
    localePath({
      path: '/catalog',
      query,
    })
  )
}

function toggleQuickAllergen(allergenCodeOrId: string) {
  const idx = selectedAllergens.value.indexOf(allergenCodeOrId)
  if (idx >= 0) selectedAllergens.value.splice(idx, 1)
  else selectedAllergens.value.push(allergenCodeOrId)
}
</script>

<template>
  <div class="space-y-12 pb-16">
    <!-- 1. Hero Slideshow Banner -->
    <section class="relative w-full">
      <!-- Case A: Multiple Active Banners (Interactive Carousel with Autoplay & Pause-on-hover) -->
      <div
        v-if="banners && banners.length > 1"
        class="relative w-full rounded-3xl overflow-hidden shadow-lg border border-base-200 min-h-[320px] md:min-h-[420px] bg-slate-900"
        @mouseenter="pauseAutoplay"
        @mouseleave="resumeAutoplay"
      >
        <div
          v-for="(banner, index) in banners"
          :key="banner.id || index"
          class="absolute inset-0 transition-opacity duration-700 ease-in-out flex items-center p-8 md:p-14"
          :class="currentSlide === index ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'"
        >
          <!-- Background image graphic with optional mobile source -->
          <picture class="absolute inset-0 w-full h-full">
            <source
              v-if="banner.mobileImageUrl"
              :srcset="banner.mobileImageUrl"
              media="(max-width: 640px)"
            />
            <img
              :src="banner.imageUrl"
              :alt="getLocalized(banner.title)"
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </picture>

          <!-- Gradient Scrim for readable high-contrast typography in LTR & RTL -->
          <div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25 rtl:bg-gradient-to-l rtl:from-black/85 rtl:via-black/55 rtl:to-black/25"></div>

          <!-- Slide Content -->
          <div class="relative max-w-xl space-y-4 text-white z-10 text-start">
            <span
              v-if="getLocalized(banner.badge)"
              class="badge badge-primary font-bold tracking-wide shadow-sm"
            >
              {{ getLocalized(banner.badge) }}
            </span>
            <h1 class="text-3xl md:text-5xl font-black leading-tight drop-shadow-sm">
              {{ getLocalized(banner.title) }}
            </h1>
            <p
              v-if="getLocalized(banner.subtitle)"
              class="text-sm md:text-base text-white/90 drop-shadow-sm font-medium"
            >
              {{ getLocalized(banner.subtitle) }}
            </p>
            <div>
              <NuxtLink
                :to="localePath(banner.linkUrl || '/catalog')"
                class="btn btn-primary gap-2 text-white shadow-md font-bold rounded-xl"
              >
                <span>{{ t('home.hero.ctaDefault', 'Handla nu') }}</span>
                <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Manual Navigation Controls -->
        <div class="absolute inset-y-0 left-3 right-3 flex justify-between items-center z-20 pointer-events-none">
          <button
            type="button"
            class="btn btn-circle btn-sm md:btn-md bg-black/40 hover:bg-black/70 text-white border-0 pointer-events-auto backdrop-blur-xs shadow-md transition-transform active:scale-95"
            :aria-label="t('home.hero.prev', 'Föregående bild')"
            @click="prevSlide"
          >
            <Icon name="lucide:chevron-left" class="size-5 rtl:rotate-180" />
          </button>
          <button
            type="button"
            class="btn btn-circle btn-sm md:btn-md bg-black/40 hover:bg-black/70 text-white border-0 pointer-events-auto backdrop-blur-xs shadow-md transition-transform active:scale-95"
            :aria-label="t('home.hero.next', 'Nästa bild')"
            @click="nextSlide"
          >
            <Icon name="lucide:chevron-right" class="size-5 rtl:rotate-180" />
          </button>
        </div>

        <!-- Slide Indicator Dots -->
        <div class="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-2 z-20 pointer-events-auto">
          <button
            v-for="(_, dotIdx) in banners"
            :key="dotIdx"
            type="button"
            class="h-2 rounded-full transition-all duration-300"
            :class="currentSlide === dotIdx ? 'w-8 bg-primary shadow-xs' : 'w-2 bg-white/50 hover:bg-white/80'"
            :aria-label="`Slide ${dotIdx + 1}`"
            @click="goToSlide(dotIdx)"
          />
        </div>
      </div>

      <!-- Case B: Exactly 1 Active Banner (Static Display without arrows, dots, or timers) -->
      <div
        v-else-if="banners && banners.length === 1"
        class="relative w-full rounded-3xl overflow-hidden shadow-lg border border-base-200 min-h-[320px] md:min-h-[420px] bg-slate-900 flex items-center p-8 md:p-14"
      >
        <picture class="absolute inset-0 w-full h-full">
          <source
            v-if="banners[0]?.mobileImageUrl"
            :srcset="banners[0]?.mobileImageUrl"
            media="(max-width: 640px)"
          />
          <img
            :src="banners[0]?.imageUrl"
            :alt="getLocalized(banners[0]?.title)"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </picture>
        <div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25 rtl:bg-gradient-to-l rtl:from-black/85 rtl:via-black/55 rtl:to-black/25"></div>
        <div class="relative max-w-xl space-y-4 text-white z-10 text-start">
          <span
            v-if="getLocalized(banners[0]?.badge)"
            class="badge badge-primary font-bold tracking-wide shadow-sm"
          >
            {{ getLocalized(banners[0]?.badge) }}
          </span>
          <h1 class="text-3xl md:text-5xl font-black leading-tight drop-shadow-sm">
            {{ getLocalized(banners[0]?.title) }}
          </h1>
          <p
            v-if="getLocalized(banners[0]?.subtitle)"
            class="text-sm md:text-base text-white/90 drop-shadow-sm font-medium"
          >
            {{ getLocalized(banners[0]?.subtitle) }}
          </p>
          <div>
            <NuxtLink
              :to="localePath(banners[0]?.linkUrl || '/catalog')"
              class="btn btn-primary gap-2 text-white shadow-md font-bold rounded-xl"
            >
              <span>{{ t('home.hero.ctaDefault', 'Handla nu') }}</span>
              <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Case C: Zero Active Banners (Graceful Theme Fallback Container) -->
      <div
        v-else
        class="relative w-full rounded-3xl overflow-hidden shadow-lg border border-base-200 min-h-[300px] md:min-h-[380px] bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 flex items-center p-8 md:p-14 text-white"
      >
        <div class="max-w-xl space-y-4 text-start">
          <span class="badge badge-accent font-semibold tracking-wide">
            {{ t('home.hero.fallback.badge', t('home.hero.slide1.badge')) }}
          </span>
          <h1 class="text-3xl md:text-5xl font-black leading-tight">
            {{ t('home.hero.fallback.title', t('home.hero.slide1.title')) }}
          </h1>
          <p class="text-sm md:text-base text-emerald-100">
            {{ t('home.hero.fallback.subtitle', t('home.hero.slide1.subtitle')) }}
          </p>
          <div>
            <NuxtLink
              :to="localePath('/catalog')"
              class="btn btn-primary gap-2 text-white shadow-md font-bold rounded-xl"
            >
              <span>{{ t('home.hero.fallback.cta', t('home.hero.slide1.cta')) }}</span>
              <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Search & Filter Bar (Seamless Transition Trigger) -->
    <section class="max-w-4xl mx-auto px-4">
      <div class="card bg-base-100 dark:bg-zinc-900 shadow-md border-2 border-base-300 dark:border-zinc-700 rounded-2xl">
        <div class="card-body p-4 sm:p-6 space-y-4">
          <form @submit.prevent="submitSearch" class="flex flex-col sm:flex-row gap-3">
            <!-- Search Input with DaisyUI Join -->
            <div class="join flex-1 w-full shadow-2xs">
              <span class="join-item btn btn-sm h-12 no-animation !bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700 dark:text-white text-black px-3.5">
                <Icon name="lucide:search" class="size-5" />
              </span>
              <input
                v-model="searchInput"
                type="search"
                :placeholder="t('home.search.placeholder')"
                :aria-label="t('home.search.label')"
                class="input input-bordered border-2 border-base-300 dark:border-zinc-700 focus:border-emerald-500 join-item w-full h-12 focus:outline-none bg-base-100 dark:bg-zinc-800 text-base-content text-sm font-medium"
              />
            </div>

            <!-- Submit Button (High-contrast dark text on light theme, never invisible white) -->
            <button
              type="submit"
              class="btn btn-primary text-slate-950 dark:text-slate-950 font-black gap-2 px-7 h-12 rounded-xl shadow-sm hover:brightness-105 cursor-pointer transition-all text-sm"
            >
              <Icon name="lucide:arrow-right" class="size-4.5 rtl:rotate-180 text-slate-950 stroke-[2.5]" />
              <span>{{ t('home.search.submit') }}</span>
            </button>
          </form>

          <!-- Quick Allergen Exclusion Pills (High-contrast active state, never invisible white text on light mode) -->
          <div v-if="facetData?.allergens?.length" class="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span class="text-base-content/70 font-semibold flex items-center gap-1.5 select-none">
              <Icon name="lucide:shield-alert" class="size-4 text-warning" />
              {{ t('home.search.quickAllergenPrefix') }}
            </span>
            <button
              v-for="allergen in facetData.allergens.slice(0, 5)"
              :key="allergen.id"
              type="button"
              :class="[
                'px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer select-none inline-flex items-center gap-1.5 border-2 shadow-2xs',
                selectedAllergens.includes(allergen.code || allergen.id)
                  ? 'bg-rose-100 border-rose-500 text-rose-900 dark:bg-rose-950/80 dark:border-rose-500 dark:text-rose-200 font-bold'
                  : 'bg-base-200/60 dark:bg-zinc-800/60 border-base-300 dark:border-zinc-700 text-base-content hover:border-rose-400 dark:hover:border-rose-500 hover:text-rose-700 dark:hover:text-rose-300'
              ]"
              @click="toggleQuickAllergen(allergen.code || allergen.id)"
            >
              <Icon
                :name="selectedAllergens.includes(allergen.code || allergen.id) ? 'lucide:check' : 'lucide:plus'"
                :class="[
                  'size-3.5',
                  selectedAllergens.includes(allergen.code || allergen.id)
                    ? 'text-rose-900 dark:text-rose-200 stroke-[2.5]'
                    : 'text-base-content/60'
                ]"
              />
              <span>{{ getLocalized(allergen.name) }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Current Deals & Promotional Products Section -->
    <PromotionalDealsSection />

    <!-- 4. Category Cards Showcase Grid -->
    <section class="max-w-7xl mx-auto px-4 space-y-6">
      <!-- Category Section Header Card with Solid Background, Rounded Corners & Clear Borders -->
      <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-base-300 dark:border-zinc-700 shadow-md rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 text-xs font-black uppercase tracking-wider mb-2">
            <Icon name="lucide:layout-grid" class="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>{{ t('nav.catalog', 'Sortiment') }}</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
            {{ t('home.categories.heading', 'Utforska våra kategorier') }}
          </h2>
          <p class="text-xs sm:text-sm text-base-content/70 font-medium mt-1">
            {{ t('home.categories.subheading', 'Hitta dina orientaliska favoriter bland våra noga utvalda råvaror och delikatesser') }}
          </p>
        </div>

        <NuxtLink
          :to="localePath('/catalog')"
          class="btn btn-sm border-2 border-base-300 dark:border-zinc-700 text-base-content hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl gap-1.5 font-bold text-xs sm:text-sm transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <span>{{ t('home.categories.viewAll', 'Se alla kategorier') }}</span>
          <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
        </NuxtLink>
      </div>

      <!-- Category Grid (Responsive Dynamic Product Photography) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-5">
        <NuxtLink
          v-for="cat in facetData?.categories"
          :key="cat.id"
          :to="localePath({ path: '/catalog', query: { category: cat.slug?.[locale] || cat.id } })"
          class="card bg-base-100 border-2 border-base-300 dark:border-zinc-700 hover:border-emerald-500/70 shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 rounded-2xl overflow-hidden group flex flex-col justify-between"
        >
          <!-- Category Image Stage -->
          <div class="relative aspect-square w-full bg-base-200/40 p-4 sm:p-5 flex items-center justify-center overflow-hidden border-b border-base-200/60">
            <!-- Dynamic Primary Product Image -->
            <img
              v-if="cat.imageUrl"
              :src="cat.imageUrl"
              :alt="getLocalized(cat.name)"
              class="h-full w-full object-contain group-hover:scale-110 transition-transform duration-500 ease-out drop-shadow-xs"
              loading="lazy"
            />

            <!-- Fallback Default Emblem when category has no product photos yet -->
            <div
              v-else
              class="h-full w-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-base-200 text-base-content/40 group-hover:text-primary transition-colors p-4 text-center"
            >
              <div class="size-12 sm:size-14 rounded-2xl bg-base-100 shadow-xs border border-base-200 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Icon name="lucide:shopping-bag" class="size-6 sm:size-7" />
              </div>
              <span class="text-[11px] font-black uppercase tracking-widest text-base-content/50">Siwar</span>
            </div>

            <!-- Product Count Badge -->
            <span
              v-if="cat.productCount"
              class="badge badge-xs sm:badge-sm bg-base-100/90 dark:bg-base-200/90 backdrop-blur-xs border border-base-300/80 text-base-content/70 font-semibold absolute top-2.5 end-2.5 shadow-xs px-2 py-0.5"
            >
              {{ cat.productCount }}
            </span>
          </div>

          <!-- Category Label & Exploration CTA -->
          <div class="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-base-100">
            <div class="min-w-0">
              <h3 class="font-bold text-xs sm:text-sm text-base-content group-hover:text-primary transition-colors truncate">
                {{ getLocalized(cat.name) }}
              </h3>
              <p class="text-[11px] text-base-content/50 font-medium truncate mt-0.5">
                {{ t('home.categories.explore', 'Utforska sortiment') }}
              </p>
            </div>

            <div class="size-7 sm:size-8 shrink-0 rounded-full bg-base-200/80 group-hover:bg-primary group-hover:text-white flex items-center justify-center text-base-content/50 transition-colors shadow-xs">
              <Icon
                name="lucide:arrow-right"
                class="size-3.5 sm:size-4 rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform"
              />
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>