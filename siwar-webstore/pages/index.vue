<!-- pages/index.vue -->
<!-- <script setup lang="ts">
const { t } = useI18n()
</script> -->

<!-- <template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold">
        {{ t('welcome') }}
      </h2>
      <p class="text-base-content/80 mt-4">
        {{ t('welcomeMessage') }}
      </p>
      <div class="card-actions justify-end mt-4">
        <button class="btn btn-primary">{{ t('callToAction.startShopping') }}</button>
      </div>
    </div>
  </div>
</template> -->


<!-- pages/index.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const { t, locale } = useI18n()
const router = useRouter()

// 1. Local search input state
const searchInput = ref('')
const selectedAllergens = ref<string[]>([])

// 2. Fetch Category taxonomy and common allergens for quick pills
const { data: facetData } = await useAsyncData('home-categories', () =>
  $fetch('/api/catalog/filters')
)

// Helper: Safely resolve localized text across Arabic, Swedish, and English
function getLocalized(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// 3. Seamless Transition to /catalog on Search Submission
function submitSearch() {
  const query: Record<string, string | undefined> = {}
  
  if (searchInput.value.trim()) {
    query.q = searchInput.value.trim()
  }
  
  if (selectedAllergens.value.length > 0) {
    query.excludeAllergens = selectedAllergens.value.join(',')
  }

  router.push({
    path: '/catalog',
    query,
  })
}

function toggleQuickAllergen(allergenId: string) {
  const idx = selectedAllergens.value.indexOf(allergenId)
  if (idx >= 0) selectedAllergens.value.splice(idx, 1)
  else selectedAllergens.value.push(allergenId)
}
</script>

<template>
  <div class="space-y-12 pb-16">
    <!-- 1. Hero Slideshow Banner (DaisyUI Carousel) -->
    <section class="relative w-full">
      <div class="carousel w-full rounded-3xl overflow-hidden shadow-lg border border-base-200">
        <!-- Slide 1: Pantry & Spices -->
        <div id="slide1" class="carousel-item relative w-full bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white min-h-[300px] md:min-h-[360px] flex items-center p-8 md:p-14">
          <div class="max-w-xl space-y-4">
            <span class="badge badge-accent font-semibold tracking-wide">
              {{ t('home.hero.slide1.badge') }}
            </span>
            <h1 class="text-3xl md:text-5xl font-black leading-tight">
              {{ t('home.hero.slide1.title') }}
            </h1>
            <p class="text-sm md:text-base text-emerald-100">
              {{ t('home.hero.slide1.subtitle') }}
            </p>
            <NuxtLink
              to="/catalog"
              class="btn btn-primary gap-2 text-white shadow-md font-bold"
            >
              <span>{{ t('home.hero.slide1.cta') }}</span>
              <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
            </NuxtLink>
          </div>
          <!-- Carousel navigation controls -->
          <div class="absolute flex justify-between transform -translate-y-1/2 left-4 right-4 top-1/2 pointer-events-none">
            <a href="#slide2" class="btn btn-circle btn-sm btn-ghost bg-black/20 text-white pointer-events-auto">❮</a>
            <a href="#slide2" class="btn btn-circle btn-sm btn-ghost bg-black/20 text-white pointer-events-auto">❯</a>
          </div>
        </div>

        <!-- Slide 2: Sweets & Fresh Bakery -->
        <div id="slide2" class="carousel-item relative w-full bg-gradient-to-r from-amber-900 via-orange-900 to-amber-800 text-white min-h-[300px] md:min-h-[360px] flex items-center p-8 md:p-14">
          <div class="max-w-xl space-y-4">
            <span class="badge badge-warning font-semibold tracking-wide">
              {{ t('home.hero.slide2.badge') }}
            </span>
            <h1 class="text-3xl md:text-5xl font-black leading-tight">
              {{ t('home.hero.slide2.title') }}
            </h1>
            <p class="text-sm md:text-base text-amber-100">
              {{ t('home.hero.slide2.subtitle') }}
            </p>
            <NuxtLink
              to="/catalog"
              class="btn btn-warning gap-2 font-bold"
            >
              <span>{{ t('home.hero.slide2.cta') }}</span>
              <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
            </NuxtLink>
          </div>
          <!-- Carousel navigation controls -->
          <div class="absolute flex justify-between transform -translate-y-1/2 left-4 right-4 top-1/2 pointer-events-none">
            <a href="#slide1" class="btn btn-circle btn-sm btn-ghost bg-black/20 text-white pointer-events-auto">❮</a>
            <a href="#slide1" class="btn btn-circle btn-sm btn-ghost bg-black/20 text-white pointer-events-auto">❯</a>
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

          <!-- Quick Allergen Exclusion Pills (AC-2 Entrypoint) -->
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
                selectedAllergens.includes(allergen.id)
                  ? 'badge-error text-white'
                  : 'badge-outline hover:badge-error'
              ]"
              @click="toggleQuickAllergen(allergen.id)"
            >
              <Icon
                :name="selectedAllergens.includes(allergen.id) ? 'lucide:check' : 'lucide:plus'"
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

      <!-- Category Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        <NuxtLink
          v-for="cat in facetData?.categories"
          :key="cat.id"
          :to="{ path: '/catalog', query: { category: cat.slug?.[locale] || cat.id } }"
          class="card bg-base-100 border border-base-200 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden"
        >
          <div class="card-body p-6 flex flex-col justify-between h-44">
            <div class="flex items-center justify-between">
              <div class="rounded-2xl bg-primary/10 text-primary p-3 group-hover:scale-110 transition-transform">
                <Icon name="lucide:shopping-bag" class="size-6" />
              </div>
              <Icon name="lucide:chevron-right" class="size-5 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition" />
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