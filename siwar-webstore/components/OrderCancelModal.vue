<!-- components/admin/orders/pack/OrderCancelModal.vue -->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  isOpen: boolean
  orderReference: string
  isSubmitting: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string): void
}>()

const { t } = useI18n()
const dialogRef = ref<HTMLDialogElement | null>(null)
const manualCancelReason = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      manualCancelReason.value = ''
      if (dialogRef.value && !dialogRef.value.open) {
        dialogRef.value.showModal()
      }
    } else {
      if (dialogRef.value && dialogRef.value.open) {
        dialogRef.value.close()
      }
    }
  }
)

onMounted(() => {
  if (props.isOpen && dialogRef.value && !dialogRef.value.open) {
    manualCancelReason.value = ''
    dialogRef.value.showModal()
  }
})

function handleClose() {
  if (dialogRef.value && dialogRef.value.open) {
    dialogRef.value.close()
  }
  emit('close')
}

function handleNativeClose() {
  if (props.isOpen) {
    emit('close')
  }
}

function handleConfirm() {
  const reason = manualCancelReason.value.trim() || t('admin.orders.pack.modal.cancelDefaultReason', 'Avbruten av butiksadministratör')
  emit('confirm', reason)
}
</script>

<template>
  <dialog ref="dialogRef" class="modal" @close="handleNativeClose">
    <div class="modal-box max-w-md bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-2xl p-6 sm:p-8 rounded-2xl space-y-5">
      <div class="flex items-center gap-3 text-error">
        <div class="p-2.5 bg-error/10 rounded-full shrink-0">
          <Icon name="lucide:alert-triangle" class="size-6 text-error" />
        </div>
        <h3 class="font-bold text-lg text-base-content leading-snug">
          {{ t('admin.orders.pack.modal.cancelOrderTitle', 'Avbryt order') }} {{ orderReference }}
        </h3>
      </div>

      <p class="text-xs text-base-content/80 leading-relaxed font-medium">
        {{ t('admin.orders.pack.modal.cancelOrderDesc', 'Är du säker på att du vill avbryta hela ordern? Reservationen släpps hos betalväxeln och alla reserverade varor återförs automatiskt till lagersaldot.') }}
      </p>

      <div class="space-y-1.5 mt-4">
        <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
          {{ t('admin.orders.pack.modal.cancelReasonLabel', 'Anledning till avbruten order') }}
        </label>
        <input
          v-model="manualCancelReason"
          type="text"
          :placeholder="t('admin.orders.pack.modal.cancelReasonPlaceholder', 'T.ex. Kunden ångrade köpet, felaktig adress...')"
          class="input w-full px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all text-sm shadow-xs"
          @keydown.enter.prevent="handleConfirm"
        />
      </div>

      <div class="flex items-center justify-end gap-3 pt-5 border-t-2 border-slate-200 dark:border-zinc-700 mt-6">
        <button
          type="button"
          class="btn px-5 py-2.5 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-base-content border-2 border-slate-300 dark:border-zinc-600 font-bold rounded-xl transition-colors shadow-xs"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          {{ t('admin.orders.pack.modal.doNotCancel', 'Avbryt inte') }}
        </button>
        <button
          type="button"
          class="btn px-6 py-2.5 h-11 bg-error hover:bg-error/90 text-white font-bold rounded-xl border-transparent shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          :disabled="isSubmitting"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('admin.orders.pack.modal.confirmCancel', 'Bekräfta och avbryt ordern') }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop bg-black/60 backdrop-blur-xs">
      <button type="button" class="outline-none text-transparent cursor-default" @click="handleClose">Stäng</button>
    </form>
  </dialog>
</template>