<!-- pages/index.vue -->
<script setup lang="ts">
import { ref } from 'vue'

interface LocalizedField {
  [key: string]: string
}

interface CategoryFacet {
  id: string
  name: LocalizedField
  slug: LocalizedField
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
      <div class="card bg-base-100 shadow-md border border-base-200">
        <div class="card-body p-4 sm:p-6 space-y-4">
          <form @submit.prevent="submitSearch" class="flex flex-col sm:flex-row gap-2">
            <!-- Search Input with DaisyUI Join -->
            <div class="join flex-1 w-full">
              <span class="join-item btn btn-ghost no-animation bg-base-200 border border-base-300">
                <Icon name="lucide:search" class="size-5 text-base-content/60" />
              </span>
              <input
                v-model="searchInput"
                type="search"
                :placeholder="t('home.search.placeholder')"
                :aria-label="t('home.search.label')"
                class="input input-bordered join-item w-full focus:outline-none"
              />
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="btn btn-primary text-white font-bold gap-2 px-6"
            >
              <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
              <span>{{ t('home.search.submit') }}</span>
            </button>
          </form>

          <!-- Quick Allergen Exclusion Pills -->
          <div v-if="facetData?.allergens?.length" class="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span class="text-base-content/70 font-semibold flex items-center gap-1">
              <Icon name="lucide:shield-alert" class="size-4 text-warning" />
              {{ t('home.search.quickAllergenPrefix') }}
            </span>
            <button
              v-for="allergen in facetData.allergens.slice(0, 5)"
              :key="allergen.id"
              type="button"
              :class="[
                'badge badge-lg transition cursor-pointer gap-1 font-medium',
                selectedAllergens.includes(allergen.code || allergen.id)
                  ? 'badge-error text-white'
                  : 'badge-outline hover:badge-error'
              ]"
              @click="toggleQuickAllergen(allergen.code || allergen.id)"
            >
              <Icon
                :name="selectedAllergens.includes(allergen.code || allergen.id) ? 'lucide:check' : 'lucide:plus'"
                class="size-3"
              />
              <span>{{ getLocalized(allergen.name) }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Category Cards Showcase Grid -->
    <section class="max-w-7xl mx-auto px-4 space-y-6">
      <div class="text-center sm:text-start">
        <h2 class="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
          {{ t('home.categories.heading') }}
        </h2>
        <p class="text-sm text-base-content/60 mt-1">
          {{ t('home.categories.subheading') }}
        </p>
      </div>

      <!-- Category Grid (Locale-Preserving) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        <NuxtLink
          v-for="cat in facetData?.categories"
          :key="cat.id"
          :to="localePath({ path: '/catalog', query: { category: cat.slug?.[locale] || cat.id } })"
          class="card bg-base-100 border border-base-200 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden"
        >
          <div class="card-body p-6 flex flex-col justify-between h-44">
            <div class="flex items-center justify-between">
              <div class="rounded-2xl bg-primary/10 text-primary p-3 group-hover:scale-110 transition-transform">
                <Icon name="lucide:shopping-bag" class="size-6" />
              </div>
              <Icon
                name="lucide:chevron-right"
                class="size-5 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition"
              />
            </div>

            <div>
              <h3 class="font-bold text-base sm:text-lg text-base-content group-hover:text-primary transition line-clamp-1">
                {{ getLocalized(cat.name) }}
              </h3>
              <p class="text-xs text-base-content/50 mt-1">
                {{ t('home.categories.explore') }}
              </p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>