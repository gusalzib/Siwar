<!-- components/OrderCancelModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
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
const manualCancelReason = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      manualCancelReason.value = ''
    }
  }
)

function handleConfirm() {
  const reason = manualCancelReason.value.trim() || t('admin.orders.pack.modal.cancelDefaultReason', 'Avbruten av butiksadministratör')
  emit('confirm', reason)
}
</script>

<template>
  <ConfirmModal
    :is-open="isOpen"
    :title="`${t('admin.orders.pack.modal.cancelOrderTitle', 'Avbryt order')} ${orderReference}`"
    :message="t('admin.orders.pack.modal.cancelOrderDesc', 'Är du säker på att du vill avbryta hela ordern? Reservationen släpps hos betalväxeln och alla reserverade varor återförs automatiskt till lagersaldot.')"
    icon="lucide:alert-triangle"
    variant="danger"
    :cancel-text="t('admin.orders.pack.modal.doNotCancel', 'Avbryt inte')"
    :confirm-text="t('admin.orders.pack.modal.confirmCancel', 'Bekräfta och avbryt ordern')"
    :is-submitting="isSubmitting"
    @confirm="handleConfirm"
    @close="emit('close')"
  >
    <div class="space-y-1.5 pt-2">
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
  </ConfirmModal>
</template>