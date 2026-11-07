<!-- components/admin/AdminCategoryDeleteModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface CategoryItem {
  id: string
  name: { sv: string; ar: string; en: string }
  slug?: { sv: string; ar: string; en: string }
  productCount?: number
  isSystemDefault?: boolean
  isActive?: boolean
}

interface Props {
  isOpen: boolean
  category: CategoryItem | null
  categories: CategoryItem[]
  isSubmitting?: boolean
  errorMessage?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  category: null,
  categories: () => [],
  isSubmitting: false,
  errorMessage: null,
})

const emit = defineEmits<{
  close: []
  confirm: [replacementCategoryId: string]
}>()

const { t, locale } = useI18n()

// Helper to get localized category name with fallbacks
function getLocalizedText(nameObj: Record<string, string> | undefined): string {
  if (!nameObj) return ''
  return nameObj[locale.value] || nameObj['sv'] || nameObj['en'] || nameObj['ar'] || ''
}

// Filter out the category currently being deleted; allow only active candidate categories
const availableDestinations = computed(() => {
  if (!props.category) return []
  return props.categories.filter((cat) => {
    // Cannot migrate to the category being deleted
    if (String(cat.id) === String(props.category?.id)) return false
    // Only active categories
    return cat.isActive !== false
  })
})

// Selected replacement category ID
const selectedReplacementId = ref<string>('')

// Pre-select the system default "Övrigt" category if present, or the first available category
function initializeSelectedCategory() {
  if (!availableDestinations.value.length) {
    selectedReplacementId.value = ''
    return
  }

  // Priority 1: Category with isSystemDefault: true
  const systemDefault = availableDestinations.value.find((c) => c.isSystemDefault)
  if (systemDefault) {
    selectedReplacementId.value = String(systemDefault.id)
    return
  }

  // Priority 2: Category with slug 'ovrigt' or 'other'
  const slugMatch = availableDestinations.value.find(
    (c) => c.slug?.sv === 'ovrigt' || c.slug?.en === 'other'
  )
  if (slugMatch) {
    selectedReplacementId.value = String(slugMatch.id)
    return
  }

  // Fallback: First candidate
  const firstCandidate = availableDestinations.value[0]
  if (firstCandidate) {
    selectedReplacementId.value = String(firstCandidate.id)
  }
}

// Watch modal open state to initialize default selection
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      initializeSelectedCategory()
    }
  },
  { immediate: true }
)

function handleConfirm() {
  if (!selectedReplacementId.value || props.isSubmitting) return
  emit('confirm', selectedReplacementId.value)
}
</script>

<template>
  <BaseModal
    :is-open="isOpen"
    max-width="lg"
    :show-close-button="!isSubmitting"
    @close="$emit('close')"
  >
    <div class="space-y-5 text-base-content">
      <!-- Modal Header -->
      <div class="flex items-start gap-3.5">
        <div class="size-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
          <Icon name="lucide:alert-triangle" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">
            {{ t('admin.categories.deleteModalTitle', 'Ta bort kategori?') }}
          </h3>
          <p v-if="category" class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
            {{ getLocalizedText(category.name) }}
          </p>
        </div>
      </div>

      <!-- Warning Badge & Count -->
      <div class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
        <Icon name="lucide:info" class="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          {{ t('admin.categories.containsProductsWarning', { count: category?.productCount || 0 }, `Denna kategori innehåller ${category?.productCount || 0} produkt(er).`) }}
        </span>
      </div>

      <!-- Outcome Explanation Callout -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/60 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
        <p class="font-medium text-slate-900 dark:text-white">
          {{ t('admin.categories.migrationExplanation', { count: category?.productCount || 0 }, `Alla ${category?.productCount || 0} produkter kommer att flyttas till den valda kategorin innan denna kategori tas bort permanent.`) }}
        </p>
      </div>

      <!-- Category Selection Dropdown -->
      <div class="space-y-2">
        <label for="replacement-category-select" class="block text-xs font-bold text-slate-700 dark:text-zinc-300">
          {{ t('admin.categories.selectDestinationCategory', 'Välj ny kategori för produkterna') }}
        </label>
        <select
          id="replacement-category-select"
          v-model="selectedReplacementId"
          :disabled="isSubmitting || !availableDestinations.length"
          class="select select-bordered w-full rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border-slate-300 dark:border-zinc-700 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option
            v-for="cat in availableDestinations"
            :key="cat.id"
            :value="cat.id"
          >
            {{ getLocalizedText(cat.name) }} {{ cat.isSystemDefault ? `(${t('admin.categories.systemDefaultBadge', 'Övrigt / Standard')})` : '' }}
          </option>
        </select>
      </div>

      <!-- Error Message if API fails -->
      <div v-if="errorMessage" class="alert alert-error text-xs py-2 px-3 rounded-xl">
        <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
        <button
          type="button"
          class="btn btn-sm sm:btn-md btn-ghost text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
          :disabled="isSubmitting"
          @click="$emit('close')"
        >
          {{ t('admin.categories.cancel', 'Avbryt') }}
        </button>

        <button
          type="button"
          class="btn btn-sm sm:btn-md bg-amber-600 hover:bg-amber-700 text-white font-bold border-none shadow-sm rounded-xl flex items-center gap-2 disabled:opacity-50"
          :disabled="isSubmitting || !selectedReplacementId"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs text-white"></span>
          <Icon v-else name="lucide:arrow-right-left" class="size-4 text-white" />
          <span class="text-white">{{ isSubmitting ? t('admin.categories.migrating', 'Flyttar produkter...') : t('admin.categories.confirmMigrateAndDelete', 'Flytta produkter och ta bort kategori') }}</span>
        </button>
      </div>
    </div>
  </BaseModal>
</template>
