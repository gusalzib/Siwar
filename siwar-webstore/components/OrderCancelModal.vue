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
    <div class="modal-box max-w-md bg-base-100 border border-base-200 shadow-2xl p-6 space-y-4">
      <div class="flex items-center gap-3 text-error">
        <div class="p-2 bg-error/10 rounded-full">
          <Icon name="lucide:alert-triangle" class="size-6" />
        </div>
        <h3 class="font-bold text-lg text-base-content">
          {{ t('admin.orders.pack.modal.cancelOrderTitle', 'Avbryt order') }} {{ orderReference }}
        </h3>
      </div>

      <p class="text-xs text-base-content/70 leading-relaxed">
        {{ t('admin.orders.pack.modal.cancelOrderDesc', 'Är du säker på att du vill avbryta hela ordern? Reservationen släpps hos betalväxeln och alla reserverade varor återförs automatiskt till lagersaldot.') }}
      </p>

      <div class="space-y-1 mt-4">
        <label class="text-xs font-bold text-base-content">
          {{ t('admin.orders.pack.modal.cancelReasonLabel', 'Anledning till avbruten order') }}
        </label>
        <input
          v-model="manualCancelReason"
          type="text"
          :placeholder="t('admin.orders.pack.modal.cancelReasonPlaceholder', 'T.ex. Kunden ångrade köpet, felaktig adress...')"
          class="input input-bordered input-sm w-full bg-base-100 text-base-content px-4 py-2"
          @keydown.enter.prevent="handleConfirm"
        />
      </div>

      <div class="flex justify-end gap-2 pt-5 border-t border-base-200 mt-6">
        <button
          type="button"
          class="btn btn-sm bg-base-200 hover:bg-base-300 text-base-content border-transparent transition-colors disabled:opacity-50 px-4"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          {{ t('admin.orders.pack.modal.doNotCancel', 'Avbryt inte') }}
        </button>
        <button
          type="button"
          class="btn btn-sm bg-error hover:bg-error/90 text-white border-transparent shadow-sm transition-colors disabled:opacity-50 px-4"
          :disabled="isSubmitting"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ t('admin.orders.pack.modal.confirmCancel', 'Bekräfta och avbryt ordern') }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" class="outline-none text-transparent cursor-default" @click="handleClose">Stäng</button>
    </form>
  </dialog>
</template>