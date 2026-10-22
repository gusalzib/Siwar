<!-- pages/admin/settings/index.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CategoryManager from '~/components/admin/settings/CategoryManager.vue'
import AllergenManager from '~/components/admin/settings/AllergenManager.vue'
import BannerManager from '~/components/admin/settings/BannerManager.vue'

definePageMeta({
  middleware: 'admin',
  alias: ['/admin/store-settings', '/admin/StoreSettings'],
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Valid tabs
type SettingsTab = 'categories' | 'allergens' | 'banners'

const validTabs: SettingsTab[] = ['categories', 'allergens', 'banners']

// Active Tab state synced with URL query (?tab=categories, ?tab=allergens, or ?tab=banners)
const initialTab = (
  typeof route.query.tab === 'string' && validTabs.includes(route.query.tab as SettingsTab)
    ? route.query.tab
    : 'categories'
) as SettingsTab

const activeTab = ref<SettingsTab>(initialTab)

// Upfront counters fetching so all 3 stats display immediately on load
const { data: initialCategories } = await useFetch<any[]>('/api/admin/categories' as string)
const { data: initialAllergens } = await useFetch<any[]>('/api/admin/allergens' as string)
const { data: initialBanners } = await useFetch<any[]>('/api/admin/settings/banners' as string)

const categoriesCount = ref(Array.isArray(initialCategories.value) ? initialCategories.value.length : 0)
const allergensCount = ref(Array.isArray(initialAllergens.value) ? initialAllergens.value.length : 0)
const bannersCount = ref(Array.isArray(initialBanners.value) ? initialBanners.value.length : 0)

watch(initialCategories, (val) => {
  if (Array.isArray(val)) categoriesCount.value = val.length
})
watch(initialAllergens, (val) => {
  if (Array.isArray(val)) allergensCount.value = val.length
})
watch(initialBanners, (val) => {
  if (Array.isArray(val)) bannersCount.value = val.length
})

function setTab(tab: SettingsTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  router.replace({
    query: {
      ...route.query,
      tab,
    },
  })
}

// Watch route changes (e.g. browser back/forward)
watch(
  () => route.query.tab,
  (newTab) => {
    if (typeof newTab === 'string' && validTabs.includes(newTab as SettingsTab)) {
      activeTab.value = newTab as SettingsTab
    }
  }
)
</script>

<template>
  <div class="min-h-screen bg-slate-100/90 dark:bg-zinc-950 p-2 sm:p-6 lg:p-8 text-base-content">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- Header & Stats Summary (Matches pages/admin/orders/index.vue style) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="size-10 rounded-2xl bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-xs">
              <Icon name="lucide:settings" class="size-5.5" />
            </div>
            <div>
              <h1 class="text-2xl font-bold tracking-tight text-base-content">
                {{ t('admin.settings.title', 'Butiksinställningar') }}
              </h1>
              <p class="text-sm text-base-content/80 mt-0.5 font-medium">
                {{ t('admin.settings.subtitle', 'Hantera butikskategorier, allergener och konfiguration') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Counters Summary -->
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <div class="stats shadow-sm bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl w-full sm:w-auto grid grid-cols-3 sm:flex">
            <div class="stat py-2 px-2 sm:py-2.5 sm:px-5">
              <div class="stat-title text-[10px] sm:text-xs font-bold uppercase tracking-wider text-base-content/80 truncate">
                {{ t('admin.settings.stats.categories', 'Kategorier') }}
              </div>
              <div class="stat-value text-lg sm:text-2xl font-black text-brand-600 dark:text-brand-400">
                {{ categoriesCount }}
              </div>
            </div>
            <div class="stat py-2 px-2 sm:py-2.5 sm:px-5 border-l-2 border-slate-200 dark:border-zinc-700/80">
              <div class="stat-title text-[10px] sm:text-xs font-bold uppercase tracking-wider text-base-content/80 truncate">
                {{ t('admin.settings.stats.allergens', 'Allergener') }}
              </div>
              <div class="stat-value text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {{ allergensCount }}
              </div>
            </div>
            <div class="stat py-2 px-2 sm:py-2.5 sm:px-5 border-l-2 border-slate-200 dark:border-zinc-700/80">
              <div class="stat-title text-[10px] sm:text-xs font-bold uppercase tracking-wider text-base-content/80 truncate">
                {{ t('admin.settings.stats.banners', 'Banners') }}
              </div>
              <div class="stat-value text-lg sm:text-2xl font-black text-teal-600 dark:text-teal-400">
                {{ bannersCount }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Layout: Left Side Panel (Desktop) + Tab Selector (Mobile/Tablet) + Content Area -->
      <div class="flex flex-col lg:flex-row gap-6 items-start">
        
        <!-- Mobile/Tablet Tabs Bar (< lg): Stacks vertically on smaller screens -->
        <div class="w-full block lg:hidden">
          <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl p-2.5 sm:p-3">
            <div class="flex flex-col gap-2">
              <button
                type="button"
                :class="[
                  activeTab === 'categories'
                    ? 'bg-brand-500 text-white font-bold shadow-xs'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800'
                ]"
                class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150"
                @click="setTab('categories')"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon name="lucide:folder-tree" class="size-4.5 shrink-0" />
                  <span class="truncate font-medium">{{ t('admin.settings.tabs.categories', 'Kategorier') }}</span>
                </div>
                <span
                  :class="activeTab === 'categories' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm font-bold px-2"
                >
                  {{ categoriesCount }}
                </span>
              </button>

              <button
                type="button"
                :class="[
                  activeTab === 'allergens'
                    ? 'bg-brand-500 text-white font-bold shadow-xs'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800'
                ]"
                class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150"
                @click="setTab('allergens')"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon name="lucide:shield-alert" class="size-4.5 shrink-0" />
                  <span class="truncate font-medium">{{ t('admin.settings.tabs.allergens', 'Allergener') }}</span>
                </div>
                <span
                  :class="activeTab === 'allergens' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm font-bold px-2"
                >
                  {{ allergensCount }}
                </span>
              </button>

              <button
                type="button"
                :class="[
                  activeTab === 'banners'
                    ? 'bg-brand-500 text-white font-bold shadow-xs'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800'
                ]"
                class="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150"
                @click="setTab('banners')"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon name="lucide:image" class="size-4.5 shrink-0" />
                  <span class="truncate font-medium">{{ t('admin.settings.tabs.banners', 'Kampanjbanners') }}</span>
                </div>
                <span
                  :class="activeTab === 'banners' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm font-bold px-2"
                >
                  {{ bannersCount }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Desktop Left Side Panel (>= lg) -->
        <aside class="hidden lg:block w-72 shrink-0 sticky top-20">
          <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl p-4 space-y-4">
            
            <!-- Side Panel Header -->
            <div class="px-2 pt-1 pb-2 border-b border-slate-100 dark:border-zinc-800">
              <span class="text-xs font-bold uppercase tracking-wider text-base-content/70">
                {{ t('admin.settings.navigation', 'Inställningsmeny') }}
              </span>
            </div>

            <!-- Primary Active Tabs Menu -->
            <nav class="space-y-1.5" aria-label="Settings Tabs">
              <!-- Categories Tab -->
              <button
                type="button"
                :class="[
                  activeTab === 'categories'
                    ? 'bg-brand-500 text-white font-bold shadow-sm'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-base-content font-medium'
                ]"
                class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-150 group"
                @click="setTab('categories')"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <Icon
                    name="lucide:folder-tree"
                    class="size-5 shrink-0 transition-transform group-hover:scale-110"
                    :class="activeTab === 'categories' ? 'text-white' : 'text-purple-600 dark:text-purple-400'"
                  />
                  <span class="truncate">{{ t('admin.settings.tabs.categories', 'Kategorier') }}</span>
                </div>
                <span
                  :class="activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm border-0 font-bold px-2"
                >
                  {{ categoriesCount }}
                </span>
              </button>

              <!-- Allergens Tab -->
              <button
                type="button"
                :class="[
                  activeTab === 'allergens'
                    ? 'bg-brand-500 text-white font-bold shadow-sm'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-base-content font-medium'
                ]"
                class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-150 group"
                @click="setTab('allergens')"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <Icon
                    name="lucide:shield-alert"
                    class="size-5 shrink-0 transition-transform group-hover:scale-110"
                    :class="activeTab === 'allergens' ? 'text-white' : 'text-amber-600 dark:text-amber-400'"
                  />
                  <span class="truncate">{{ t('admin.settings.tabs.allergens', 'Allergener') }}</span>
                </div>
                <span
                  :class="activeTab === 'allergens' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm border-0 font-bold px-2"
                >
                  {{ allergensCount }}
                </span>
              </button>

              <!-- Banners Tab -->
              <button
                type="button"
                :class="[
                  activeTab === 'banners'
                    ? 'bg-brand-500 text-white font-bold shadow-sm'
                    : 'text-base-content/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-base-content font-medium'
                ]"
                class="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all duration-150 group"
                @click="setTab('banners')"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <Icon
                    name="lucide:image"
                    class="size-5 shrink-0 transition-transform group-hover:scale-110"
                    :class="activeTab === 'banners' ? 'text-white' : 'text-teal-600 dark:text-teal-400'"
                  />
                  <span class="truncate">{{ t('admin.settings.tabs.banners', 'Kampanjbanners') }}</span>
                </div>
                <span
                  :class="activeTab === 'banners' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-base-content/70'"
                  class="badge badge-sm border-0 font-bold px-2"
                >
                  {{ bannersCount }}
                </span>
              </button>
            </nav>

            <!-- Upcoming / Future Tabs Section -->
            <div class="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-1">
              <div class="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-base-content/50">
                {{ t('admin.settings.comingSoon', 'Fler inställningar') }}
              </div>

              <!-- Shipping & Delivery (Upcoming) -->
              <div class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-base-content/50 cursor-not-allowed">
                <div class="flex items-center gap-3">
                  <Icon name="lucide:truck" class="size-4.5 opacity-60" />
                  <span>{{ t('admin.settings.tabs.shipping', 'Frakt & Leverans') }}</span>
                </div>
                <span class="badge badge-xs badge-ghost text-[10px] font-bold opacity-60">
                  {{ t('admin.settings.comingSoon', 'Snart') }}
                </span>
              </div>

              <!-- Store Pickup (Upcoming) -->
              <div class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-base-content/50 cursor-not-allowed">
                <div class="flex items-center gap-3">
                  <Icon name="lucide:store" class="size-4.5 opacity-60" />
                  <span>{{ t('admin.settings.tabs.pickup', 'Upphämtning') }}</span>
                </div>
                <span class="badge badge-xs badge-ghost text-[10px] font-bold opacity-60">
                  {{ t('admin.settings.comingSoon', 'Snart') }}
                </span>
              </div>

              <!-- General (Upcoming) -->
              <div class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-base-content/50 cursor-not-allowed">
                <div class="flex items-center gap-3">
                  <Icon name="lucide:sliders-horizontal" class="size-4.5 opacity-60" />
                  <span>{{ t('admin.settings.tabs.general', 'Allmänna') }}</span>
                </div>
                <span class="badge badge-xs badge-ghost text-[10px] font-bold opacity-60">
                  {{ t('admin.settings.comingSoon', 'Snart') }}
                </span>
              </div>
            </div>

          </div>
        </aside>

        <!-- Main Content Area: Renders Active Tab Component -->
        <main class="flex-1 min-w-0 w-full space-y-6">
          <Transition name="fade" mode="out-in">
            <CategoryManager
              v-if="activeTab === 'categories'"
              key="categories"
              @update:count="categoriesCount = $event"
            />
            <AllergenManager
              v-else-if="activeTab === 'allergens'"
              key="allergens"
              @update:count="allergensCount = $event"
            />
            <BannerManager
              v-else-if="activeTab === 'banners'"
              key="banners"
              @update:count="bannersCount = $event"
            />
          </Transition>
        </main>

      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
