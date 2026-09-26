<script setup lang="ts">
import { ref, computed } from 'vue'

const { t, locale } = useI18n()

// State
const { data: allergens, refresh } = await useFetch('/api/admin/allergens')
const modalRef = ref<HTMLDialogElement | null>(null)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const initialForm = {
  id: '',
  code: '',
  name: { ar: '', sv: '', en: '' },
  isActive: true
}
const form = ref(JSON.parse(JSON.stringify(initialForm)))

// If we have an ID in the form, we are editing an existing allergen
const isEditing = computed(() => !!form.value.id)

// Helpers
function getLocalizedText(obj: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

function openModal(allergen: any = null) {
  if (allergen && !(allergen instanceof Event)) {
    form.value = JSON.parse(JSON.stringify(allergen))
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

// Handlers
async function handleSubmit() {
  isSubmitting.value = true
  errorMessage.value = ''
  
  try {
    const url = isEditing.value 
      ? `/api/admin/allergens/${form.value.id}` 
      : '/api/admin/allergens'
    
    await $fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      body: form.value
    })
    
    successMessage.value = t('admin.allergens.success', 'Allergen saved successfully!')
    closeModal()
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.data?.message || t('admin.allergens.error', 'Failed to save allergen.')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(id: string) {
  if (!confirm(t('admin.allergens.confirmDelete', 'Are you sure you want to delete this allergen?'))) return
  
  try {
    await $fetch(`/api/admin/allergens/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.data?.message || t('admin.allergens.error', 'Failed to delete allergen.'))
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-6 md:p-10">
    <div class="mx-auto max-w-5xl space-y-6">
      
      <!-- Top Bar -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-base-content mt-2">
            {{ t('admin.allergens.title', 'Allergens Management') }}
          </h1>
          <p class="text-sm text-base-content/60">
            {{ t('admin.allergens.subtitle', 'Add, edit, or delete product allergens.') }}
          </p>
        </div>
        <button @click="openModal()" class="btn bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm gap-2 transition-colors">
          <Icon name="lucide:plus" class="size-4" />
          {{ t('admin.allergens.add', 'Add Allergen') }}
        </button>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="alert alert-success shadow-sm" role="alert">
        <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>

      <!-- List -->
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr class="bg-base-200/50">
                <th>{{ t('admin.allergens.code', 'Internal Code') }}</th>
                <th>{{ t('admin.allergens.name', 'Display Name') }}</th>
                <th class="text-right">{{ t('admin.allergens.actions', 'Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="allergen in allergens" :key="allergen.id" class="hover:bg-base-200/30 transition-colors">
                <td class="font-mono text-sm">{{ allergen.code }}</td>
                <td class="font-medium">{{ getLocalizedText(allergen.name) }}</td>
                <td class="text-right space-x-2">
                  <button @click="openModal(allergen)" class="btn btn-sm btn-ghost text-brand-500 hover:bg-brand-500/10">
                    <Icon name="lucide:edit" class="size-4" />
                  </button>
                  <button @click="handleDelete(allergen.id)" class="btn btn-sm btn-ghost text-error hover:bg-error/10">
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="!allergens?.length">
                <td colspan="3" class="text-center py-8 text-base-content/50">
                  {{ t('admin.allergens.empty', 'No allergens found.') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Edit/Add Modal -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box p-6 bg-base-100 shadow-lg border border-base-content/10">
        <h3 class="font-bold text-lg mb-4 text-base-content">
          {{ isEditing ? t('admin.allergens.editTitle', 'Edit Allergen') : t('admin.allergens.addTitle', 'New Allergen') }}
        </h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="errorMessage" class="alert alert-error text-sm shadow-sm py-2">
            <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text font-medium">{{ t('admin.allergens.codeLabel', 'Allergen Code (e.g. sesame)') }} *</span></label>
            <input v-model="form.code" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">{{ t('admin.allergens.nameEn', 'Name (English)') }} *</span></label>
            <input v-model="form.name.en" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text font-medium">{{ t('admin.allergens.nameSv', 'Name (Swedish)') }} *</span></label>
            <input v-model="form.name.sv" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
          </div>
          
          <div class="form-control">
            <label class="label"><span class="label-text font-medium">{{ t('admin.allergens.nameAr', 'Name (Arabic)') }} *</span></label>
            <input v-model="form.name.ar" dir="rtl" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
          </div>

          <div class="modal-action pt-4 border-t border-base-200 mt-6 flex justify-end gap-3">
            <button type="button" @click="closeModal" class="btn btn-ghost text-error hover:bg-error hover:text-white transition-colors gap-2 px-6">
              <Icon name="lucide:x" class="size-4" />
              {{ t('admin.allergens.cancel', 'Cancel') }}
            </button>
            <button type="submit" :disabled="isSubmitting" class="btn bg-brand-500 border-none text-white hover:bg-brand-600 shadow-sm gap-2 px-6 transition-colors">
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ t('admin.allergens.save', 'Save') }}
            </button>
          </div>
        </form>
      </div>
      
      <!-- Backdrop click to close -->
      <form method="dialog" class="modal-backdrop bg-neutral/30" @submit="closeModal">
        <button class="sr-only">close</button>
      </form>
    </dialog>
  </div>
</template>
