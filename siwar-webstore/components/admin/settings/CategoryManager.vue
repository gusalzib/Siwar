<!-- components/admin/settings/CategoryManager.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  (e: 'update:count', count: number): void
}>()

const { t, locale } = useI18n()

// Fetch Categories
const { data: categories, pending: isLoading, refresh } = await useFetch<any[]>('/api/admin/categories')

// Watch count to notify parent
watch(
  categories,
  (newVal) => {
    emit('update:count', newVal?.length || 0)
  },
  { immediate: true }
)

const modalRef = ref<HTMLDialogElement | null>(null)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const searchQuery = ref('')

const initialForm = {
  id: '',
  name: { ar: '', sv: '', en: '' },
  slug: { ar: '', sv: '', en: '' },
  sortOrder: 0,
  isActive: true,
}

const form = ref(JSON.parse(JSON.stringify(initialForm)))
const isEditing = computed(() => !!form.value.id)

// Localized text helper
function getLocalizedText(obj: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Filtered categories based on search
const filteredCategories = computed(() => {
  if (!categories.value) return []
  if (!searchQuery.value.trim()) return categories.value
  const query = searchQuery.value.toLowerCase().trim()
  return categories.value.filter((cat) => {
    const svName = (cat.name?.sv || '').toLowerCase()
    const enName = (cat.name?.en || '').toLowerCase()
    const arName = (cat.name?.ar || '').toLowerCase()
    const svSlug = (cat.slug?.sv || '').toLowerCase()
    const enSlug = (cat.slug?.en || '').toLowerCase()
    const arSlug = (cat.slug?.ar || '').toLowerCase()
    return (
      svName.includes(query) ||
      enName.includes(query) ||
      arName.includes(query) ||
      svSlug.includes(query) ||
      enSlug.includes(query) ||
      arSlug.includes(query)
    )
  })
})

// Auto generate slugs
function generateSlugs() {
  if (!form.value.slug.en && form.value.name.en) {
    form.value.slug.en = form.value.name.en
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }
  if (!form.value.slug.sv && form.value.name.sv) {
    form.value.slug.sv = form.value.name.sv
      .toLowerCase()
      .replace(/å/g, 'a')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }
  if (!form.value.slug.ar && form.value.name.ar) {
    form.value.slug.ar = form.value.name.ar.replace(/\s+/g, '-').trim()
  }
}

function openModal(category: any = null) {
  if (category && !(category instanceof Event)) {
    form.value = JSON.parse(JSON.stringify(category))
    if (form.value.isActive === undefined) {
      form.value.isActive = true
    }
  } else {
    form.value = JSON.parse(JSON.stringify(initialForm))
  }
  errorMessage.value = ''
  successMessage.value = ''
  modalRef.value?.showModal()
}

function closeModal() {
  modalRef.value?.close()
  form.value = JSON.parse(JSON.stringify(initialForm))
}

async function handleSubmit() {
  generateSlugs()
  errorMessage.value = ''

  if (!form.value.name?.sv?.trim() || !form.value.name?.en?.trim() || !form.value.name?.ar?.trim()) {
    errorMessage.value = t(
      'admin.categories.validation.nameRequired',
      'Vänligen fyll i kategorinamn på alla tre språk (svenska, engelska och arabiska).'
    )
    return
  }

  isSubmitting.value = true

  try {
    const url = isEditing.value
      ? `/api/admin/categories/${form.value.id}`
      : '/api/admin/categories'

    await $fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      body: form.value,
    })

    successMessage.value = t('admin.categories.success', 'Kategorin har sparats!')
    closeModal()
    await refresh()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.categories.error', 'Kunde inte spara kategorin.')
  } finally {
    isSubmitting.value = false
  }
}

// Delete Confirmation Modal State
const isDeleteModalOpen = ref(false)
const categoryToDelete = ref<any | null>(null)
const isDeleting = ref(false)
const deleteErrorMessage = ref<string | null>(null)

function openDeleteModal(category: any) {
  categoryToDelete.value = category
  deleteErrorMessage.value = null
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  categoryToDelete.value = null
  deleteErrorMessage.value = null
  isDeleteModalOpen.value = false
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value) return

  isDeleting.value = true
  deleteErrorMessage.value = null
  try {
    await $fetch(`/api/admin/categories/${categoryToDelete.value.id}`, { method: 'DELETE' })
    closeDeleteModal()
    await refresh()
  } catch (err: any) {
    deleteErrorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.categories.error', 'Kunde inte ta bort kategorin.')
  } finally {
    isDeleting.value = false
  }
}

// Category Promotional Discount Modal State (Issue #41)
const isPromoModalOpen = ref(false)
const categoryForPromo = ref<any | null>(null)
const promoForm = ref({
  discountPercent: 0,
  isActiveDiscount: false,
  discountStartsAt: '',
  discountExpiresAt: '',
})
const promoErrorMessage = ref('')
const isPromoSubmitting = ref(false)

function toDatetimeLocalString(val?: string | Date | null): string {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

function openPromoModal(category: any) {
  categoryForPromo.value = category
  promoErrorMessage.value = ''
  const hasExistingDiscount = typeof category.discountPercent === 'number' && category.discountPercent > 0
  promoForm.value = {
    discountPercent: typeof category.discountPercent === 'number' ? category.discountPercent : 0,
    isActiveDiscount: hasExistingDiscount ? Boolean(category.isActiveDiscount) : true,
    discountStartsAt: toDatetimeLocalString(category.discountStartsAt),
    discountExpiresAt: toDatetimeLocalString(category.discountExpiresAt),
  }
  isPromoModalOpen.value = true
}

function onDiscountPercentInput() {
  if (promoForm.value.discountPercent > 0 && !categoryForPromo.value?.discountPercent && !promoForm.value.isActiveDiscount) {
    promoForm.value.isActiveDiscount = true
  }
}

function closePromoModal() {
  categoryForPromo.value = null
  promoErrorMessage.value = ''
  isPromoModalOpen.value = false
}

async function handleSavePromo() {
  if (!categoryForPromo.value) return
  const percent = Number(promoForm.value.discountPercent) || 0
  if (promoForm.value.isActiveDiscount && (percent < 1 || percent > 90)) {
    promoErrorMessage.value = t(
      'admin.categories.invalidPercent',
      'Rabatten måste vara mellan 1% och 90%.'
    )
    return
  }

  if (promoForm.value.discountStartsAt && promoForm.value.discountExpiresAt) {
    const s = new Date(promoForm.value.discountStartsAt).getTime()
    const e = new Date(promoForm.value.discountExpiresAt).getTime()
    if (e <= s) {
      promoErrorMessage.value = t(
        'admin.discountModal.dateOrderError',
        'Slutdatum måste vara efter startdatum.'
      )
      return
    }
  }

  isPromoSubmitting.value = true
  promoErrorMessage.value = ''
  try {
    const catId = categoryForPromo.value.id || categoryForPromo.value._id
    await $fetch(`/api/admin/categories/${catId}`, {
      method: 'PUT',
      body: {
        discountPercent: percent,
        isActiveDiscount: Boolean(promoForm.value.isActiveDiscount),
        discountStartsAt: promoForm.value.discountStartsAt ? new Date(promoForm.value.discountStartsAt) : null,
        discountExpiresAt: promoForm.value.discountExpiresAt ? new Date(promoForm.value.discountExpiresAt) : null,
      },
    })
    successMessage.value = t('admin.categories.promoSuccess', 'Kategorikampanj har sparats framgångsrikt!')
    closePromoModal()
    await refresh()
  } catch (err: any) {
    promoErrorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.categories.error', 'Kunde inte spara kampanjen.')
  } finally {
    isPromoSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Section Toolbar & Title -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl">
      <div class="card-body p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <div class="size-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <Icon name="lucide:folder-tree" class="size-5" />
              </div>
              <h2 class="text-xl font-bold tracking-tight text-base-content">
                {{ t('admin.categories.title', 'Kategorihantering') }}
              </h2>
            </div>
            <p class="text-sm text-base-content/75 mt-1 font-medium">
              {{ t('admin.categories.subtitle', 'Visa, redigera och organisera kategorier, URL-slugs och översättningar') }}
            </p>
          </div>

          <button
            type="button"
            class="btn bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm rounded-xl font-bold gap-2 text-sm shrink-0 transition-colors"
            @click="openModal()"
          >
            <Icon name="lucide:plus" class="size-4" />
            {{ t('admin.categories.add', 'Lägg till kategori') }}
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
          <div class="relative w-full sm:max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.categories.searchPlaceholder', 'Filtrera kategorier efter namn eller slug...')"
              class="input w-full pl-9 pr-8 h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs"
            />
            <Icon
              name="lucide:search"
              class="absolute left-3 top-3 size-4 text-base-content/60 rtl:left-auto rtl:right-3"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-2.5 size-5 flex items-center justify-center text-base-content/50 hover:text-base-content rtl:right-auto rtl:left-2.5"
              @click="searchQuery = ''"
            >
              <Icon name="lucide:x" class="size-3.5" />
            </button>
          </div>

          <div v-if="searchQuery" class="text-xs font-semibold text-base-content/70">
            {{ filteredCategories.length }} / {{ categories?.length || 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Alerts -->
    <div
      v-if="successMessage"
      class="alert alert-success shadow-sm rounded-xl border border-success/30 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
        <span class="font-medium text-sm">{{ successMessage }}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-xs btn-circle" @click="successMessage = ''">
        <Icon name="lucide:x" class="size-4" />
      </button>
    </div>

    <!-- Data Display Card -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-16">
        <span class="loading loading-spinner loading-md text-brand-500"></span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!filteredCategories || filteredCategories.length === 0"
        class="text-center py-16 text-base-content/70"
      >
        <Icon name="lucide:folder-x" class="size-12 mx-auto mb-3 opacity-40 text-base-content" />
        <p class="font-bold text-base">{{ t('admin.categories.empty', 'Inga kategorier hittades') }}</p>
        <p v-if="searchQuery" class="text-xs text-base-content/60 mt-1">
          {{ t('admin.orders.filters.resetFilters', 'Rensa filter') }}
        </p>
      </div>

      <template v-else>
        <!-- Desktop Table View (>= md) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr class="text-xs font-bold uppercase tracking-wider text-base-content/70 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-700/80">
                <th class="py-3 px-4">{{ t('admin.categories.name', 'Kategorinamn') }}</th>
                <th class="py-3 px-4">{{ t('admin.categories.slug', 'URL-slug') }}</th>
                <th class="py-3 px-4">{{ t('admin.categories.status', 'Status') }}</th>
                <th class="py-3 px-4 text-right rtl:text-left">{{ t('admin.categories.actions', 'Åtgärder') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
              <tr
                v-for="category in filteredCategories"
                :key="category.id"
                class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <!-- Name & Multi-language indicators -->
                <td class="py-3.5 px-4">
                  <div class="font-bold text-sm text-base-content">
                    {{ getLocalizedText(category.name) }}
                  </div>
                  <div class="flex items-center gap-1.5 mt-1 text-[11px] text-base-content/60 font-medium">
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': category.name?.sv }"
                    >
                      SV: {{ category.name?.sv || '—' }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': category.name?.en }"
                    >
                      EN: {{ category.name?.en || '—' }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': category.name?.ar }"
                    >
                      AR: {{ category.name?.ar || '—' }}
                    </span>
                  </div>
                </td>

                <!-- Slug -->
                <td class="py-3.5 px-4 font-mono text-xs text-base-content/75">
                  <div class="bg-slate-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg inline-block">
                    /{{ getLocalizedText(category.slug) || '—' }}
                  </div>
                </td>

                <!-- Status & Active Discount -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      v-if="category.isActive !== false"
                      class="badge badge-sm badge-success gap-1 font-bold text-[11px]"
                    >
                      <span class="size-1.5 rounded-full bg-white"></span>
                      {{ t('admin.categories.active', 'Aktiv') }}
                    </span>
                    <span
                      v-else
                      class="badge badge-sm badge-ghost gap-1 font-medium text-[11px] opacity-75"
                    >
                      {{ t('admin.categories.inactive', 'Inaktiv') }}
                    </span>

                    <!-- Active Blanket Category Promo Badge -->
                    <span
                      v-if="category.isActiveDiscount && category.discountPercent > 0"
                      class="badge badge-sm badge-error text-white font-bold text-[11px] gap-1 shadow-xs"
                      :title="t('admin.discountModal.title', 'Kategorikampanj')"
                    >
                      <Icon name="lucide:percent" class="size-3" />
                      -{{ category.discountPercent }}%
                    </span>
                  </div>
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right rtl:text-left space-x-1 rtl:space-x-reverse">
                  <!-- Category Promotional Discount Trigger -->
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost rounded-lg"
                    :class="category.isActiveDiscount && category.discountPercent > 0 ? 'text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40' : 'text-base-content/70 hover:text-base-content'"
                    :title="t('admin.categories.discountModalTitle', 'Hantera kategorirabatt')"
                    @click="openPromoModal(category)"
                  >
                    <Icon name="lucide:percent" class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg"
                    :title="t('admin.categories.edit', 'Redigera')"
                    @click="openModal(category)"
                  >
                    <Icon name="lucide:pencil" class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-lg"
                    :title="t('admin.categories.delete', 'Ta bort')"
                    @click="openDeleteModal(category)"
                  >
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View (< md) -->
        <div class="block md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
          <div
            v-for="category in filteredCategories"
            :key="category.id"
            class="p-4 space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-bold text-base text-base-content">
                  {{ getLocalizedText(category.name) }}
                </h3>
                <span class="font-mono text-xs text-base-content/70">
                  /{{ getLocalizedText(category.slug) || '—' }}
                </span>
              </div>
              <span
                v-if="category.isActive !== false"
                class="badge badge-sm badge-success font-bold text-[10px]"
              >
                {{ t('admin.categories.active', 'Aktiv') }}
              </span>
              <span
                v-else
                class="badge badge-sm badge-ghost font-medium text-[10px]"
              >
                {{ t('admin.categories.inactive', 'Inaktiv') }}
              </span>
            </div>

            <!-- Translation Badges -->
            <div class="flex flex-wrap gap-1 text-[11px] text-base-content/60">
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                SV: {{ category.name?.sv || '—' }}
              </span>
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                EN: {{ category.name?.en || '—' }}
              </span>
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                AR: {{ category.name?.ar || '—' }}
              </span>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                class="btn btn-sm btn-ghost font-bold gap-1.5 rounded-xl"
                :class="category.isActiveDiscount && category.discountPercent > 0 ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40' : 'text-base-content/75 hover:bg-base-200 dark:hover:bg-zinc-800'"
                :title="t('admin.categories.discountModalTitle', 'Hantera kategorirabatt')"
                @click="openPromoModal(category)"
              >
                <Icon name="lucide:percent" class="size-3.5" />
                <span>{{ t('admin.categories.discount', 'Kampanj') }}</span>
                <span v-if="category.isActiveDiscount && category.discountPercent > 0" class="badge badge-error badge-xs text-white">
                  -{{ category.discountPercent }}%
                </span>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 font-bold gap-1.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/40"
                :title="t('admin.categories.edit', 'Redigera')"
                @click="openModal(category)"
              >
                <Icon name="lucide:pencil" class="size-3.5" />
                <span>{{ t('admin.categories.edit', 'Redigera') }}</span>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost text-error font-bold gap-1.5 rounded-xl hover:bg-error/10"
                :title="t('admin.categories.delete', 'Ta bort')"
                @click="openDeleteModal(category)"
              >
                <Icon name="lucide:trash-2" class="size-3.5" />
                <span>{{ t('admin.categories.delete', 'Ta bort') }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Edit/Add Modal -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box p-6 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-2xl rounded-2xl max-w-2xl text-base-content">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div class="flex items-center gap-2">
            <div class="size-8 rounded-lg bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Icon :name="isEditing ? 'lucide:pencil' : 'lucide:plus'" class="size-4" />
            </div>
            <h3 class="font-bold text-lg text-base-content">
              {{ isEditing ? t('admin.categories.editTitle', 'Redigera kategori') : t('admin.categories.addTitle', 'Skapa ny kategori') }}
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
            @click="closeModal"
          >
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4 mt-4">
          <div v-if="errorMessage" class="alert alert-error text-sm shadow-sm py-2 rounded-xl">
            <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- English -->
            <div class="space-y-2 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <div class="form-control">
                <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.categories.nameEn', 'Namn (engelska)') }} *</span></label>
                <input
                  v-model="form.name.en"
                  type="text"
                  required
                  placeholder="e.g. Spices & Herbs"
                  class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
                />
              </div>
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-[11px] font-semibold opacity-70">Slug (English)</span></label>
                <input
                  v-model="form.slug.en"
                  type="text"
                  placeholder="auto-generated"
                  class="input input-sm input-bordered h-8 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-lg focus:border-brand-500 w-full font-mono text-xs"
                />
              </div>
            </div>

            <!-- Swedish -->
            <div class="space-y-2 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <div class="form-control">
                <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.categories.nameSv', 'Namn (svenska)') }} *</span></label>
                <input
                  v-model="form.name.sv"
                  type="text"
                  required
                  placeholder="t.ex. Kryddor & Örter"
                  class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
                />
              </div>
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-[11px] font-semibold opacity-70">Slug (Swedish)</span></label>
                <input
                  v-model="form.slug.sv"
                  type="text"
                  placeholder="auto-generated"
                  class="input input-sm input-bordered h-8 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-lg focus:border-brand-500 w-full font-mono text-xs"
                />
              </div>
            </div>

            <!-- Arabic -->
            <div class="space-y-2 md:col-span-2 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <div class="form-control">
                <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.categories.nameAr', 'Namn (arabiska)') }} *</span></label>
                <input
                  v-model="form.name.ar"
                  dir="rtl"
                  type="text"
                  required
                  placeholder="مثال: بهارات وتوابل"
                  class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
                />
              </div>
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-[11px] font-semibold opacity-70">Slug (Arabic)</span></label>
                <input
                  v-model="form.slug.ar"
                  dir="rtl"
                  type="text"
                  placeholder="auto-generated"
                  class="input input-sm input-bordered h-8 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-lg focus:border-brand-500 w-full font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div class="form-control p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
            <label class="label cursor-pointer justify-start gap-3 py-0">
              <input
                v-model="form.isActive"
                type="checkbox"
                class="checkbox checkbox-primary rounded-lg"
              />
              <span class="label-text font-bold text-sm">{{ t('admin.categories.isActive', 'Publicera kategori i butiken') }}</span>
            </label>
          </div>

          <div class="modal-action pt-4 border-t border-slate-200 dark:border-zinc-800 mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="btn btn-ghost font-bold rounded-xl text-base-content/75 hover:text-base-content"
              @click="closeModal"
            >
              {{ t('admin.categories.cancel', 'Avbryt') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold border-none shadow-sm rounded-xl gap-2 px-6"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ t('admin.categories.save', 'Spara kategori') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Backdrop click to close -->
      <form method="dialog" class="modal-backdrop bg-neutral/40 backdrop-blur-xs" @submit="closeModal">
        <button class="sr-only">close</button>
      </form>
    </dialog>

    <!-- Delete Category Confirmation Modal -->
    <ConfirmModal
      :is-open="isDeleteModalOpen"
      :title="t('admin.categories.deleteModalTitle', 'Ta bort kategori?')"
      :subtitle="categoryToDelete ? (categoryToDelete.slug ? `${getLocalizedText(categoryToDelete.name)} (${categoryToDelete.slug})` : getLocalizedText(categoryToDelete.name)) : undefined"
      :message="t('admin.categories.confirmDelete', 'Är du säker på att du vill ta bort denna kategori?')"
      icon="lucide:trash-2"
      variant="danger"
      :confirm-text="isDeleting ? t('admin.categories.deleting', 'Tar bort...') : t('admin.categories.delete', 'Ta bort')"
      :cancel-text="t('admin.categories.cancel', 'Avbryt')"
      :is-submitting="isDeleting"
      confirm-icon="lucide:trash-2"
      @confirm="confirmDeleteCategory"
      @close="closeDeleteModal"
    >
      <div v-if="deleteErrorMessage" class="alert alert-error text-xs py-2 px-3 rounded-xl mt-2">
        <span>{{ deleteErrorMessage }}</span>
      </div>
    </ConfirmModal>

    <!-- Category Promotional Discount Modal (Issue #41) -->
    <BaseModal
      :is-open="isPromoModalOpen"
      :title="t('admin.categories.discountModalTitle', 'Hantera kategorirabatt')"
      :subtitle="categoryForPromo ? getLocalizedText(categoryForPromo.name) : undefined"
      max-width="md"
      @close="closePromoModal"
    >
      <form @submit.prevent="handleSavePromo" class="space-y-4">
        <div v-if="promoErrorMessage" class="alert alert-error text-xs py-2 px-3 rounded-xl">
          <span>{{ promoErrorMessage }}</span>
        </div>

        <!-- Active Toggle (High-Contrast Toggle Card) -->
        <div
          class="p-3.5 rounded-2xl border-2 transition-all duration-200 shadow-2xs"
          :class="promoForm.isActiveDiscount
            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-500/20'
            : 'bg-slate-100/80 dark:bg-zinc-800/60 border-slate-300 dark:border-zinc-600'"
        >
          <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-extrabold text-sm text-base-content">
                  {{ t('admin.categories.isActiveDiscount', 'Aktivera rabatt för hela kategorin') }}
                </span>
                <span
                  class="badge badge-sm font-bold text-[10px]"
                  :class="promoForm.isActiveDiscount ? 'badge-success text-white' : 'badge-ghost text-base-content/60'"
                >
                  {{ promoForm.isActiveDiscount ? t('admin.categories.active', 'Aktiv') : t('admin.categories.inactive', 'Inaktiv') }}
                </span>
              </div>
              <p class="text-xs text-base-content/70 leading-snug">
                {{ t('admin.categories.discountHelp', 'Tillämpas automatiskt på alla produkter i denna kategori som inte har egna specifika rabatter.') }}
              </p>
            </div>
            <input
              v-model="promoForm.isActiveDiscount"
              type="checkbox"
              class="toggle toggle-md toggle-error shrink-0 border-2 border-slate-400 dark:border-zinc-500 cursor-pointer focus:ring-2 focus:ring-rose-500/30 shadow-xs"
            />
          </label>
        </div>

        <!-- Warning when discount rate entered but toggle is off -->
        <div
          v-if="promoForm.discountPercent > 0 && !promoForm.isActiveDiscount"
          class="alert alert-warning text-xs py-2.5 px-3.5 rounded-xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-xs flex items-start gap-2.5"
        >
          <Icon name="lucide:alert-triangle" class="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div class="space-y-0.5">
            <span class="font-bold block">{{ t('admin.categories.discountInactiveWarningTitle', 'Kampanjen är inaktiv') }}</span>
            <span class="text-xs opacity-90 leading-tight">
              {{ t('admin.categories.discountInactiveWarning', 'Obs! Du har angett en rabattsats men reglaget är inaktiverat. Slå på reglaget ovan om du vill att rabatten ska aktiveras i butiken.') }}
            </span>
          </div>
        </div>

        <!-- Discount Percent -->
        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">{{ t('admin.categories.discountPercent', 'Rabattsats (%)') }} *</span>
          </label>
          <div class="relative">
            <input
              v-model.number="promoForm.discountPercent"
              type="number"
              min="0"
              max="90"
              placeholder="0"
              class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-rose-500 text-sm shadow-xs w-full pr-8"
              @input="onDiscountPercentInput"
            />
            <span class="absolute right-3 top-2.5 text-xs font-bold text-base-content/50">%</span>
          </div>
        </div>

        <!-- Start Date -->
        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">{{ t('admin.categories.discountStartsAt', 'Kampanj startdatum') }}</span>
          </label>
          <input
            v-model="promoForm.discountStartsAt"
            type="datetime-local"
            class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
          />
        </div>

        <!-- Expiry Date -->
        <div class="form-control">
          <label class="label py-1">
            <span class="label-text font-bold text-xs">{{ t('admin.categories.discountExpiresAt', 'Kampanj slutdatum') }}</span>
          </label>
          <input
            v-model="promoForm.discountExpiresAt"
            type="datetime-local"
            class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
          />
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-zinc-800 mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="btn btn-ghost font-bold rounded-xl text-base-content/75 hover:text-base-content"
            @click="closePromoModal"
          >
            {{ t('admin.categories.cancel', 'Avbryt') }}
          </button>
          <button
            type="submit"
            :disabled="isPromoSubmitting"
            class="btn bg-rose-600 hover:bg-rose-700 text-white font-bold border-none shadow-sm rounded-xl gap-2 px-6"
          >
            <span v-if="isPromoSubmitting" class="loading loading-spinner loading-sm"></span>
            <Icon v-else name="lucide:check" class="size-4" />
            {{ t('admin.categories.save', 'Spara kategori') }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
