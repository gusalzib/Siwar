<!-- components/admin/settings/AllergenManager.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const emit = defineEmits<{
  (e: 'update:count', count: number): void
}>()

const { t, locale } = useI18n()

// Fetch Allergens
const { data: allergens, pending: isLoading, refresh } = await useFetch<any[]>('/api/admin/allergens')

// Watch count to notify parent
watch(
  allergens,
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
  code: '',
  name: { ar: '', sv: '', en: '' },
  isActive: true,
}

const form = ref(JSON.parse(JSON.stringify(initialForm)))
const isEditing = computed(() => !!form.value.id)

// Localized text helper
function getLocalizedText(obj: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Filtered allergens based on search
const filteredAllergens = computed(() => {
  if (!allergens.value) return []
  if (!searchQuery.value.trim()) return allergens.value
  const query = searchQuery.value.toLowerCase().trim()
  return allergens.value.filter((all) => {
    const code = (all.code || '').toLowerCase()
    const svName = (all.name?.sv || '').toLowerCase()
    const enName = (all.name?.en || '').toLowerCase()
    const arName = (all.name?.ar || '').toLowerCase()
    return (
      code.includes(query) ||
      svName.includes(query) ||
      enName.includes(query) ||
      arName.includes(query)
    )
  })
})

function openModal(allergen: any = null) {
  if (allergen && !(allergen instanceof Event)) {
    form.value = JSON.parse(JSON.stringify(allergen))
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
  errorMessage.value = ''

  if (!form.value.code?.trim()) {
    errorMessage.value = t('admin.allergens.validation.codeRequired', 'Allergenkod krävs.')
    return
  }

  if (!form.value.name?.sv?.trim() || !form.value.name?.en?.trim() || !form.value.name?.ar?.trim()) {
    errorMessage.value = t(
      'admin.allergens.validation.nameRequired',
      'Vänligen fyll i allergennamn på alla tre språk (svenska, engelska och arabiska).'
    )
    return
  }

  isSubmitting.value = true

  try {
    const url = isEditing.value
      ? `/api/admin/allergens/${form.value.id}`
      : '/api/admin/allergens'

    await $fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      body: form.value,
    })

    successMessage.value = t('admin.allergens.success', 'Allergen har sparats!')
    closeModal()
    await refresh()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.allergens.error', 'Kunde inte spara allergen.')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(id: string) {
  if (
    !confirm(
      t(
        'admin.allergens.confirmDelete',
        'Är du säker på att du vill ta bort denna allergen?'
      )
    )
  )
    return

  try {
    await $fetch(`/api/admin/allergens/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(
      err?.data?.statusMessage ||
        err?.data?.message ||
        t('admin.allergens.error', 'Kunde inte ta bort allergen.')
    )
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
              <div class="size-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Icon name="lucide:shield-alert" class="size-5" />
              </div>
              <h2 class="text-xl font-bold tracking-tight text-base-content">
                {{ t('admin.allergens.title', 'Allergenhantering') }}
              </h2>
            </div>
            <p class="text-sm text-base-content/75 mt-1 font-medium">
              {{ t('admin.allergens.subtitle', 'Visa, redigera och hantera lagstadgade allergener och översättningar') }}
            </p>
          </div>

          <button
            type="button"
            class="btn bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm rounded-xl font-bold gap-2 text-sm shrink-0 transition-colors"
            @click="openModal()"
          >
            <Icon name="lucide:plus" class="size-4" />
            {{ t('admin.allergens.add', 'Lägg till allergen') }}
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
          <div class="relative w-full sm:max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('admin.allergens.searchPlaceholder', 'Filtrera allergener efter kod eller namn...')"
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
            {{ filteredAllergens.length }} / {{ allergens?.length || 0 }}
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
        v-else-if="!filteredAllergens || filteredAllergens.length === 0"
        class="text-center py-16 text-base-content/70"
      >
        <Icon name="lucide:shield-off" class="size-12 mx-auto mb-3 opacity-40 text-base-content" />
        <p class="font-bold text-base">{{ t('admin.allergens.empty', 'Inga allergener hittades') }}</p>
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
                <th class="py-3 px-4">{{ t('admin.allergens.code', 'Kod') }}</th>
                <th class="py-3 px-4">{{ t('admin.allergens.name', 'Namn') }}</th>
                <th class="py-3 px-4">{{ t('admin.allergens.translations', 'Översättningar') }}</th>
                <th class="py-3 px-4 text-right rtl:text-left">{{ t('admin.allergens.actions', 'Åtgärder') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
              <tr
                v-for="allergen in filteredAllergens"
                :key="allergen.id"
                class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <!-- Code -->
                <td class="py-3.5 px-4">
                  <span class="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                    {{ allergen.code }}
                  </span>
                </td>

                <!-- Localized Name -->
                <td class="py-3.5 px-4 font-bold text-sm text-base-content">
                  {{ getLocalizedText(allergen.name) }}
                </td>

                <!-- Translations preview -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-1.5 text-[11px] text-base-content/60 font-medium">
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': allergen.name?.sv }"
                    >
                      SV: {{ allergen.name?.sv || '—' }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': allergen.name?.en }"
                    >
                      EN: {{ allergen.name?.en || '—' }}
                    </span>
                    <span
                      class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800"
                      :class="{ 'text-brand-600 dark:text-brand-400 font-bold': allergen.name?.ar }"
                    >
                      AR: {{ allergen.name?.ar || '—' }}
                    </span>
                  </div>
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right rtl:text-left space-x-1 rtl:space-x-reverse">
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-lg"
                    :title="t('admin.allergens.edit', 'Redigera')"
                    @click="openModal(allergen)"
                  >
                    <Icon name="lucide:pencil" class="size-4" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-ghost text-error hover:bg-error/10 rounded-lg"
                    :title="t('admin.allergens.delete', 'Ta bort')"
                    @click="handleDelete(allergen.id)"
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
            v-for="allergen in filteredAllergens"
            :key="allergen.id"
            class="p-4 space-y-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                  {{ allergen.code }}
                </span>
                <h3 class="font-bold text-base text-base-content mt-1.5">
                  {{ getLocalizedText(allergen.name) }}
                </h3>
              </div>
            </div>

            <!-- Translation Badges -->
            <div class="flex flex-wrap gap-1 text-[11px] text-base-content/60">
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                SV: {{ allergen.name?.sv || '—' }}
              </span>
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                EN: {{ allergen.name?.en || '—' }}
              </span>
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                AR: {{ allergen.name?.ar || '—' }}
              </span>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                class="btn btn-sm btn-ghost text-brand-600 dark:text-brand-400 font-bold gap-1.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/40"
                :title="t('admin.allergens.edit', 'Redigera')"
                @click="openModal(allergen)"
              >
                <Icon name="lucide:pencil" class="size-3.5" />
                <span>{{ t('admin.allergens.edit', 'Redigera') }}</span>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost text-error font-bold gap-1.5 rounded-xl hover:bg-error/10"
                :title="t('admin.allergens.delete', 'Ta bort')"
                @click="handleDelete(allergen.id)"
              >
                <Icon name="lucide:trash-2" class="size-3.5" />
                <span>{{ t('admin.allergens.delete', 'Ta bort') }}</span>
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
            <div class="size-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Icon :name="isEditing ? 'lucide:pencil' : 'lucide:plus'" class="size-4" />
            </div>
            <h3 class="font-bold text-lg text-base-content">
              {{ isEditing ? t('admin.allergens.editTitle', 'Redigera allergen') : t('admin.allergens.addTitle', 'Skapa ny allergen') }}
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

          <!-- Code input -->
          <div class="form-control p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
            <label class="label py-1">
              <span class="label-text font-bold text-xs">{{ t('admin.allergens.codeLabel', 'Allergenkod (t.ex. GLUTEN eller MILK)') }} *</span>
            </label>
            <input
              v-model="form.code"
              type="text"
              required
              placeholder="e.g. sesame"
              class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 font-mono text-sm shadow-xs w-full uppercase"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- English -->
            <div class="form-control p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.allergens.nameEn', 'Namn (engelska)') }} *</span></label>
              <input
                v-model="form.name.en"
                type="text"
                required
                placeholder="e.g. Sesame seeds"
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
              />
            </div>

            <!-- Swedish -->
            <div class="form-control p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.allergens.nameSv', 'Namn (svenska)') }} *</span></label>
              <input
                v-model="form.name.sv"
                type="text"
                required
                placeholder="t.ex. Sesamfrön"
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
              />
            </div>

            <!-- Arabic -->
            <div class="form-control md:col-span-2 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60">
              <label class="label py-1"><span class="label-text font-bold text-xs">{{ t('admin.allergens.nameAr', 'Namn (arabiska)') }} *</span></label>
              <input
                v-model="form.name.ar"
                dir="rtl"
                type="text"
                required
                placeholder="مثال: بذور السمسم"
                class="input input-bordered h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs w-full"
              />
            </div>
          </div>

          <div class="modal-action pt-4 border-t border-slate-200 dark:border-zinc-800 mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="btn btn-ghost font-bold rounded-xl text-base-content/75 hover:text-base-content"
              @click="closeModal"
            >
              {{ t('admin.allergens.cancel', 'Avbryt') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn bg-brand-500 hover:bg-brand-600 text-white font-bold border-none shadow-sm rounded-xl gap-2 px-6"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ t('admin.allergens.save', 'Spara allergen') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Backdrop click to close -->
      <form method="dialog" class="modal-backdrop bg-neutral/40 backdrop-blur-xs" @submit="closeModal">
        <button class="sr-only">close</button>
      </form>
    </dialog>
  </div>
</template>
