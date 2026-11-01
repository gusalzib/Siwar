<!-- components/ConfirmModal.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  isOpen: boolean
  title: string
  subtitle?: string
  message?: string
  icon?: string
  iconClass?: string
  variant?: 'danger' | 'warning' | 'primary' | 'info'
  confirmText?: string
  cancelText?: string
  confirmIcon?: string
  isSubmitting?: boolean
  showCancel?: boolean
  showCloseButton?: boolean
  closeOnConfirm?: boolean
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | string
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  message: '',
  icon: 'lucide:alert-triangle',
  iconClass: '',
  variant: 'danger',
  confirmText: 'Bekräfta',
  cancelText: 'Avbryt',
  confirmIcon: '',
  isSubmitting: false,
  showCancel: true,
  showCloseButton: true,
  closeOnConfirm: false,
  maxWidth: 'md',
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const iconVariantClasses = computed(() => {
  switch (props.variant) {
    case 'warning':
      return 'bg-warning/10 dark:bg-warning/20 text-warning'
    case 'primary':
      return 'bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400'
    case 'info':
      return 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
    case 'danger':
    default:
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
  }
})

const confirmButtonClasses = computed(() => {
  switch (props.variant) {
    case 'warning':
      return '!bg-amber-600 hover:!bg-amber-700 !text-white !border-none'
    case 'primary':
      return '!bg-brand-600 hover:!bg-brand-700 !text-white !border-none'
    case 'info':
      return '!bg-sky-600 hover:!bg-sky-700 !text-white !border-none'
    case 'danger':
    default:
      return '!bg-red-600 hover:!bg-red-700 !text-white !border-none'
  }
})

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm')
  if (props.closeOnConfirm) {
    emit('close')
  }
}
</script>

<template>
  <BaseModal
    :is-open="isOpen"
    :max-width="maxWidth"
    :show-close-button="false"
    @close="handleClose"
  >
    <!-- Custom Header with Icon, Title, Subtitle, and Close Button -->
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3.5 flex-1 min-w-0">
          <div
            v-if="icon"
            :class="[
              'size-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5',
              iconVariantClasses,
              iconClass
            ]"
          >
            <Icon :name="icon" class="size-6" />
          </div>

          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="font-extrabold text-lg text-base-content leading-snug break-words">
              {{ title }}
            </h3>
            <p v-if="subtitle" class="text-xs text-base-content/60 font-mono truncate">
              {{ subtitle }}
            </p>
          </div>
        </div>

        <button
          v-if="showCloseButton"
          type="button"
          class="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
          title="Stäng"
          aria-label="Stäng dialogruta"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          <Icon name="lucide:x" class="size-5" />
        </button>
      </div>
    </template>

    <!-- Modal Content: Description and Optional Slot -->
    <div class="space-y-3">
      <p v-if="message" class="text-sm text-base-content/80 leading-relaxed font-medium">
        {{ message }}
      </p>
      <slot />
    </div>

    <!-- Action Buttons -->
    <template #footer>
      <div class="flex items-center justify-end gap-3">
        <button
          v-if="showCancel"
          type="button"
          :disabled="isSubmitting"
          class="btn h-10 px-4 sm:px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-colors shadow-xs"
          @click="handleClose"
        >
          {{ cancelText }}
        </button>

        <button
          type="button"
          :disabled="isSubmitting"
          :class="[
            'btn h-10 px-4 sm:px-5 rounded-xl font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2',
            confirmButtonClasses
          ]"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs" />
          <Icon v-else-if="confirmIcon" :name="confirmIcon" class="size-4" />
          <span>{{ confirmText }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
