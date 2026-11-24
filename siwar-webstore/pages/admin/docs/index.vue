<!-- pages/admin/docs/index.vue -->
<!--
  Internal Administrative Documentation Hub
  
  Provides staff and administrators with built-in reference documentation explaining
  complex business rules, starting with the 4-tier discount hierarchy.
  
  Features:
  - Responsive two-column layout with a sticky sidebar navigation menu.
  - URL query (?section=discounts) and hash (#discounts) synchronization.
  - Modular component loading for expandable documentation topics.
  - Strict middleware: 'admin' protection.
  - Complete trilingual localization across Arabic, Swedish, and English.
-->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import DiscountHierarchyDoc from '~/components/admin/docs/DiscountHierarchyDoc.vue'

definePageMeta({
  middleware: 'admin',
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = typeof useRoute === 'function' ? useRoute() : { query: {}, hash: '' }
const router = typeof useRouter === 'function' ? useRouter() : { replace: () => {} }

// Documented Section Identifiers
type DocSection = 'discounts' | 'shipping' | 'inventory'

interface NavSectionItem {
  id: DocSection
  titleKey: string
  defaultTitle: string
  icon: string
  isAvailable: boolean
}

const navSections: NavSectionItem[] = [
  {
    id: 'discounts',
    titleKey: 'admin.docs.sections.discounts',
    defaultTitle: 'Rabatthierarki (4 nivåer)',
    icon: 'lucide:tags',
    isAvailable: true,
  },
  {
    id: 'shipping',
    titleKey: 'admin.docs.sections.shipping',
    defaultTitle: 'Frakt- & Leveransregler',
    icon: 'lucide:truck',
    isAvailable: false,
  },
  {
    id: 'inventory',
    titleKey: 'admin.docs.sections.inventory',
    defaultTitle: 'Lagersaldo & Säkerhetsmarginal',
    icon: 'lucide:boxes',
    isAvailable: false,
  },
]

// Resolve initial section from URL query (?section=...) or hash (#...)
function resolveInitialSection(): DocSection {
  const querySection = route?.query?.section
  if (typeof querySection === 'string' && ['discounts', 'shipping', 'inventory'].includes(querySection)) {
    return querySection as DocSection
  }
  const hash = route?.hash ? route.hash.replace('#', '') : ''
  if (['discounts', 'shipping', 'inventory'].includes(hash)) {
    return hash as DocSection
  }
  return 'discounts'
}

const activeSection = ref<DocSection>(resolveInitialSection())

function selectSection(id: DocSection) {
  if (activeSection.value === id) return
  activeSection.value = id
  if (router?.replace) {
    router.replace({
      query: { ...(route?.query || {}), section: id },
      hash: `#${id}`,
    })
  }
}

// Keep active section in sync if route query or hash changes externally
watch(
  () => [route?.query?.section, route?.hash],
  ([newQuery, newHash]) => {
    if (typeof newQuery === 'string' && ['discounts', 'shipping', 'inventory'].includes(newQuery)) {
      activeSection.value = newQuery as DocSection
    } else if (typeof newHash === 'string') {
      const cleanHash = newHash.replace('#', '')
      if (['discounts', 'shipping', 'inventory'].includes(cleanHash)) {
        activeSection.value = cleanHash as DocSection
      }
    }
  }
)

onMounted(() => {
  // Ensure URL reflects current section on first mount if query was absent
  if (router?.replace && !route?.query?.section && !route?.hash) {
    router.replace({
      query: { ...(route?.query || {}), section: activeSection.value },
      hash: `#${activeSection.value}`,
    })
  }
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-6 lg:p-8 text-base-content bg-base-100">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Breadcrumb & Top Bar Navigation -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 dark:border-zinc-800 pb-4">
        <div class="space-y-1">
          <nav class="text-xs breadcrumbs p-0 mb-1">
            <ul>
              <li>
                <NuxtLink :to="localePath('/admin/products')" class="text-base-content/70 hover:text-primary transition-colors">
                  {{ t('admin.nav.management', 'Administration') }}
                </NuxtLink>
              </li>
              <li class="font-bold text-base-content">
                {{ t('admin.docs.title', 'Intern Dokumentation') }}
              </li>
            </ul>
          </nav>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-100">
            {{ t('admin.docs.title', 'Intern Dokumentation & Affärsregler') }}
          </h1>
          <p class="text-xs sm:text-sm text-base-content/70">
            {{ t('admin.docs.subtitle', 'Referensguide för butiksadministratörer och personal') }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <NuxtLink
            :to="localePath('/admin/products')"
            class="btn btn-sm btn-ghost gap-1.5 border border-base-300 dark:border-zinc-700 rounded-xl"
          >
            <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
            <span>{{ t('admin.docs.backToProducts', 'Tillbaka till produkter') }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Two-Column Layout: Sticky Sidebar Navigation & Content Pane -->
      <div class="flex flex-col lg:flex-row gap-6 items-start">
        <!-- Sidebar Navigation (Sticky on desktop) -->
        <aside class="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 z-10">
          <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl p-4 space-y-3">
            <h2 class="text-xs font-bold uppercase tracking-wider text-base-content/60 px-2 flex items-center gap-2">
              <Icon name="lucide:book-open" class="size-3.5 text-primary" />
              <span>{{ t('admin.docs.tableOfContents', 'Innehållsförteckning') }}</span>
            </h2>

            <ul class="menu menu-sm p-0 gap-1.5 w-full">
              <li v-for="item in navSections" :key="item.id" class="w-full">
                <button
                  type="button"
                  class="w-full flex items-center justify-between p-2.5 rounded-xl font-medium transition-all text-start"
                  :class="[
                    activeSection === item.id
                      ? '!bg-primary !text-white font-bold shadow-xs'
                      : 'hover:bg-base-200 dark:hover:bg-zinc-800 text-base-content',
                    !item.isAvailable && 'opacity-60 cursor-not-allowed'
                  ]"
                  :disabled="!item.isAvailable"
                  @click="item.isAvailable && selectSection(item.id)"
                >
                  <div class="flex items-center gap-2.5 truncate">
                    <Icon :name="item.icon" class="size-4 shrink-0" />
                    <span class="text-xs sm:text-sm truncate">{{ t(item.titleKey, item.defaultTitle) }}</span>
                  </div>

                  <span
                    v-if="!item.isAvailable"
                    class="badge badge-xs badge-ghost text-[10px] shrink-0 font-normal"
                  >
                    {{ t('admin.docs.status.comingSoon', 'Snart') }}
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 w-full min-w-0">
          <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl p-6 sm:p-8">
            <!-- Dynamic Section Component Rendering -->
            <DiscountHierarchyDoc v-if="activeSection === 'discounts'" />

            <!-- Fallback for future sections -->
            <div v-else class="text-center py-16 space-y-3 text-base-content/60">
              <Icon name="lucide:file-text" class="size-10 mx-auto opacity-40" />
              <p class="text-sm font-medium">
                {{ t('admin.docs.status.comingSoon', 'Denna sektion är under utveckling.') }}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
