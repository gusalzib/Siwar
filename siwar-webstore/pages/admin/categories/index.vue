<script setup lang="ts">
import { ref, computed } from 'vue'

const { t, locale } = useI18n()

// State
const { data: categories, refresh } = await useFetch('/api/admin/categories')
const modalRef = ref<HTMLDialogElement | null>(null)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const initialForm = {
  id: '',
  name: { ar: '', sv: '', en: '' },
  slug: { ar: '', sv: '', en: '' },
  sortOrder: 0,
  isActive: true
}
const form = ref(JSON.parse(JSON.stringify(initialForm)))

// If we have an ID in the form, we are editing an existing category
const isEditing = computed(() => !!form.value.id)

// Helpers
function getLocalizedText(obj: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Auto generate slugs from English name if not provided manually
function generateSlugs() {
  if (!form.value.slug.en && form.value.name.en) {
    form.value.slug.en = form.value.name.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  }
  if (!form.value.slug.sv && form.value.name.sv) {
    // simplified swedish slug
    form.value.slug.sv = form.value.name.sv.toLowerCase()
      .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  }
  if (!form.value.slug.ar && form.value.name.ar) {
    // For arabic, we might just use the english slug or keep it simple
    form.value.slug.ar = form.value.name.ar.replace(/\s+/g, '-').trim()
  }
}

function openModal(category: any = null) {
  if (category && !(category instanceof Event)) {
    form.value = JSON.parse(JSON.stringify(category))
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
  generateSlugs()
  isSubmitting.value = true
  errorMessage.value = ''
  
  try {
    const url = isEditing.value 
      ? `/api/admin/categories/${form.value.id}` 
      : '/api/admin/categories'
    
    await $fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      body: form.value
    })
    
    successMessage.value = t('admin.categories.success', 'Category saved successfully!')
    closeModal()
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.data?.message || t('admin.categories.error', 'Failed to save category.')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(id: string) {
  if (!confirm(t('admin.categories.confirmDelete', 'Are you sure you want to delete this category?'))) return
  
  try {
    await $fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.data?.message || t('admin.categories.error', 'Failed to delete category.'))
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
            {{ t('admin.categories.title', 'Categories Management') }}
          </h1>
          <p class="text-sm text-base-content/60">
            {{ t('admin.categories.subtitle', 'Organize the catalog hierarchy.') }}
          </p>
        </div>
        <button @click="openModal()" class="btn bg-brand-500 p-5 hover:bg-brand-600 text-white border-none shadow-sm gap-2 transition-colors">
          <Icon name="lucide:plus" class="size-4" />
          {{ t('admin.categories.add', 'Add Category') }}
        </button>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="alert alert-success shadow-sm" role="alert">
        <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>

      <!-- List -->
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden p-3">
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr class="bg-base-200/50">
                <th>{{ t('admin.categories.name', 'Category Name') }}</th>
                <th>{{ t('admin.categories.slug', 'URL Slug') }}</th>
                <th class="text-right">{{ t('admin.categories.actions', 'Actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="category in categories" :key="category.id" class="hover:bg-base-200/30 transition-colors">
                <td class="font-medium">{{ getLocalizedText(category.name) }}</td>
                <td class="font-mono text-sm opacity-70">{{ getLocalizedText(category.slug) || '-' }}</td>
                <td class="text-right space-x-2">
                  <button @click="openModal(category)" class="btn btn-sm btn-ghost text-brand-500 hover:bg-brand-500/10">
                    <Icon name="lucide:edit" class="size-4" />
                  </button>
                  <button @click="handleDelete(category.id)" class="btn btn-sm btn-ghost text-error hover:bg-error/10">
                    <Icon name="lucide:trash-2" class="size-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="!categories?.length">
                <td colspan="3" class="text-center py-8 text-base-content/50">
                  {{ t('admin.categories.empty', 'No categories found.') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Edit/Add Modal -->
    <dialog ref="modalRef" class="modal">
      <div class="modal-box p-6 bg-base-100 shadow-lg border border-base-content/10 max-w-2xl">
        <h3 class="font-bold text-lg mb-4 text-base-content">
          {{ isEditing ? t('admin.categories.editTitle', 'Edit Category') : t('admin.categories.addTitle', 'New Category') }}
        </h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="errorMessage" class="alert alert-error text-sm shadow-sm py-2">
            <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- English -->
            <div class="space-y-2">
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">{{ t('admin.categories.nameEn', 'Name (English)') }} *</span></label>
                <input v-model="form.name.en" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text text-xs opacity-70">Slug (English)</span></label>
                <input v-model="form.slug.en" type="text" placeholder="auto-generated" class="input input-sm input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent w-full font-mono text-xs" />
              </div>
            </div>
            
            <!-- Swedish -->
            <div class="space-y-2">
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">{{ t('admin.categories.nameSv', 'Name (Swedish)') }} *</span></label>
                <input v-model="form.name.sv" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text text-xs opacity-70">Slug (Swedish)</span></label>
                <input v-model="form.slug.sv" type="text" placeholder="auto-generated" class="input input-sm input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent w-full font-mono text-xs" />
              </div>
            </div>

            <!-- Arabic -->
            <div class="space-y-2 md:col-span-2">
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">{{ t('admin.categories.nameAr', 'Name (Arabic)') }} *</span></label>
                <input v-model="form.name.ar" dir="rtl" type="text" required class="input input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent transition-colors w-full" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text text-xs opacity-70">Slug (Arabic)</span></label>
                <input v-model="form.slug.ar" dir="rtl" type="text" placeholder="auto-generated" class="input input-sm input-bordered border-2 border-base-content/20 hover:border-brand-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-transparent w-full font-mono text-xs" />
              </div>
            </div>
          </div>

          <div class="form-control mt-4">
            <label class="label cursor-pointer justify-start gap-4">
              <input v-model="form.isActive" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text font-medium">{{ t('admin.categories.isActive', 'Is Active') }}</span>
            </label>
          </div>

          <div class="modal-action pt-4 border-t border-base-200 mt-6 flex justify-end gap-3">
            <button type="button" @click="closeModal" class="btn btn-ghost text-error hover:bg-error hover:text-white transition-colors gap-2 px-6">
              <Icon name="lucide:x" class="size-4" />
              {{ t('admin.categories.cancel', 'Cancel') }}
            </button>
            <button type="submit" :disabled="isSubmitting" class="btn bg-brand-500 border-none text-white hover:bg-brand-600 shadow-sm gap-2 px-6 transition-colors">
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <Icon v-else name="lucide:save" class="size-4" />
              {{ t('admin.categories.save', 'Save') }}
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
