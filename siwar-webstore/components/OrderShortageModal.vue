<!-- components/admin/orders/pack/OrderShortageModal.vue -->
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LineItemState, ShortageActionDraft } from '~/composables/useOrderPacking'

interface Props {
  isOpen: boolean
  item: LineItemState | null
  currency: string
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'SEK',
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', actionDraft: ShortageActionDraft): void
}>()

const { t, locale } = useI18n()

const dialogRef = ref<HTMLDialogElement | null>(null)
const selectedActionType = ref<'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'>('REDUCE_QUANTITY')
const modalAdjustedQuantity = ref(1)
const modalNote = ref('')

// State variables specifically for the "Substitute Item" workflow
const substituteSearchQuery = ref('')
const substituteResults = ref<any[]>([])
const selectedSubstitute = ref<any | null>(null)
const isSearchingSubstitute = ref(false)

function getLocalizedName(nameObj?: { ar?: string; sv?: string; en?: string }) {
  if (!nameObj) return ''
  const current = locale.value as 'ar' | 'sv' | 'en'
  return nameObj[current] || nameObj.sv || nameObj.en || nameObj.ar || ''
}

function formatMoney(amountMinor: number, currency = props.currency) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function resetForm() {
  selectedActionType.value = 'REDUCE_QUANTITY'
  modalAdjustedQuantity.value = props.item ? Math.max(0, props.item.fulfilledQuantity - 1) : 0
  modalNote.value = ''
  selectedSubstitute.value = null
  substituteSearchQuery.value = ''
  substituteResults.value = []
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetForm()
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
    resetForm()
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

function selectActionType(type: 'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM') {
  selectedActionType.value = type
  if (type === 'SUBSTITUTE_ITEM') {
    modalAdjustedQuantity.value = props.item?.fulfilledQuantity || props.item?.quantity || 1
  } else if (type === 'REDUCE_QUANTITY') {
    modalAdjustedQuantity.value = Math.max(0, (props.item?.fulfilledQuantity ?? 1) - 1)
  } else if (type === 'REMOVE_LINE') {
    modalAdjustedQuantity.value = 0
  }
}

async function searchSubstitutes() {
  if (!substituteSearchQuery.value.trim()) return
  isSearchingSubstitute.value = true
  try {
    const res = await $fetch<any[]>('/api/admin/products/search', {
      query: { q: substituteSearchQuery.value },
    })
    substituteResults.value = res || []
  } catch (err) {
    console.error('Failed to search products:', err)
  } finally {
    isSearchingSubstitute.value = false
  }
}

function selectSubstituteProduct(product: any) {
  selectedSubstitute.value = product
  if (modalAdjustedQuantity.value <= 0) {
    modalAdjustedQuantity.value = props.item?.fulfilledQuantity || props.item?.quantity || 1
  }
}

function applyShortageAction() {
  if (!props.item) return

  const pId = props.item.productId
  let draft: ShortageActionDraft | null = null

  if (selectedActionType.value === 'REMOVE_LINE') {
    draft = {
      productId: pId,
      action: 'REMOVE_LINE',
      adjustedQuantity: 0,
      note: modalNote.value,
    }
  } else if (selectedActionType.value === 'REDUCE_QUANTITY') {
    const newQty = Math.max(0, Math.min(modalAdjustedQuantity.value, props.item.quantity))
    draft = {
      productId: pId,
      action: 'REDUCE_QUANTITY',
      adjustedQuantity: newQty,
      note: modalNote.value,
    }
  } else if (selectedActionType.value === 'SUBSTITUTE_ITEM' && selectedSubstitute.value) {
    const sub = selectedSubstitute.value
    const subPriceMinor = sub.price?.[props.currency] ?? sub.price?.SEK ?? 0
    const qty = Math.max(1, modalAdjustedQuantity.value || 1)

    draft = {
      productId: pId,
      action: 'SUBSTITUTE_ITEM',
      adjustedQuantity: qty,
      substitutedProduct: {
        _id: String(sub._id),
        sku: sub.sku,
        name: sub.name,
        priceMinor: subPriceMinor,
        momsRate: sub.momsRate || 12,
      },
      note: modalNote.value,
    }
  }

  if (draft) {
    emit('apply', draft)
    handleClose()
  }
}
</script>

<template>
  <dialog ref="dialogRef" class="modal" @close="handleNativeClose">
    <div class="modal-box max-w-lg bg-white dark:bg-zinc-900 border-2 border-slate-300 dark:border-zinc-600 shadow-2xl p-6 sm:p-8 rounded-2xl">
      <h3 class="font-bold text-xl flex items-center gap-2.5 text-base-content">
        <Icon name="lucide:alert-triangle" class="size-6 text-warning" />
        {{ t('admin.orders.pack.modal.title') }}
      </h3>

      <!-- Product Context Banner -->
      <div class="mt-3 p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700">
        <div class="text-sm font-bold text-base-content leading-snug">
          {{ getLocalizedName(item?.name) }}
        </div>
        <div v-if="item?.sku" class="text-xs font-mono text-base-content/70 mt-0.5">
          SKU: {{ item.sku }}
        </div>
      </div>

      <div class="space-y-6 mt-6">
        <!-- Select Action Type -->
        <div class="form-control">
          <label class="label text-xs font-bold uppercase tracking-wider text-base-content pb-2">
            {{ t('admin.orders.pack.modal.actionLabel') }}
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              class="btn py-3 px-3 h-auto min-h-[46px] rounded-xl font-bold text-xs sm:text-sm text-center shadow-xs transition-all"
              :class="selectedActionType === 'REDUCE_QUANTITY'
                ? 'bg-brand-600 hover:bg-brand-700 text-white border-2 border-brand-600 shadow-sm ring-2 ring-brand-500/40'
                : 'bg-slate-50 dark:bg-zinc-800 text-base-content border-2 border-slate-300 dark:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'"
              @click="selectActionType('REDUCE_QUANTITY')"
            >
              {{ t('admin.orders.pack.modal.reduceQty') }}
            </button>
            <button
              type="button"
              class="btn py-3 px-3 h-auto min-h-[46px] rounded-xl font-bold text-xs sm:text-sm text-center shadow-xs transition-all"
              :class="selectedActionType === 'REMOVE_LINE'
                ? 'bg-error hover:bg-error/90 text-white border-2 border-error shadow-sm ring-2 ring-error/40'
                : 'bg-slate-50 dark:bg-zinc-800 text-base-content border-2 border-slate-300 dark:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'"
              @click="selectActionType('REMOVE_LINE')"
            >
              {{ t('admin.orders.pack.modal.removeLine') }}
            </button>
            <button
              type="button"
              class="btn py-3 px-3 h-auto min-h-[46px] rounded-xl font-bold text-xs sm:text-sm text-center shadow-xs transition-all"
              :class="selectedActionType === 'SUBSTITUTE_ITEM'
                ? 'bg-brand-600 hover:bg-brand-700 text-white border-2 border-brand-600 shadow-sm ring-2 ring-brand-500/40'
                : 'bg-slate-50 dark:bg-zinc-800 text-base-content border-2 border-slate-300 dark:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500'"
              @click="selectActionType('SUBSTITUTE_ITEM')"
            >
              {{ t('admin.orders.pack.modal.substituteItem') }}
            </button>
          </div>
        </div>

        <!-- Option 1: Reduce Quantity Input -->
        <div v-if="selectedActionType === 'REDUCE_QUANTITY'" class="form-control">
          <label class="label text-xs font-bold uppercase tracking-wider text-base-content pb-1">
            {{ t('admin.orders.pack.modal.newQty') }}
          </label>
          <input
            v-model.number="modalAdjustedQuantity"
            type="number"
            min="0"
            :max="item ? item.quantity - 1 : 0"
            class="input w-full font-mono text-base font-bold px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
          />
        </div>

        <!-- Option 2: Substitution Product Search -->
        <div v-if="selectedActionType === 'SUBSTITUTE_ITEM'" class="space-y-3.5">
          <div class="form-control">
            <label class="label text-xs font-bold uppercase tracking-wider text-base-content pb-1">
              {{ t('admin.orders.pack.modal.searchSubstitute') }}
            </label>
            <div class="flex gap-2">
              <input
                v-model="substituteSearchQuery"
                type="text"
                :placeholder="t('admin.orders.pack.modal.searchPlaceholder')"
                class="input flex-1 px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all text-sm shadow-xs"
                @keydown.enter.prevent="searchSubstitutes"
              />
              <button
                type="button"
                class="btn h-11 px-5 bg-brand-600 hover:bg-brand-700 text-white border-transparent font-bold rounded-xl shadow-xs transition-transform active:scale-95"
                :disabled="isSearchingSubstitute"
                @click="searchSubstitutes"
              >
                <span v-if="isSearchingSubstitute" class="loading loading-spinner loading-xs"></span>
                <Icon v-else name="lucide:search" class="size-4" />
              </button>
            </div>
          </div>

          <!-- Search Results List with High Contrast Rows -->
          <div v-if="substituteResults.length > 0" class="max-h-52 overflow-y-auto border-2 border-slate-300 dark:border-zinc-700 rounded-xl divide-y-2 divide-slate-200 dark:divide-zinc-800 bg-slate-100 dark:bg-zinc-950 shadow-inner">
            <div
              v-for="prod in substituteResults"
              :key="prod._id"
              class="p-3.5 sm:px-4 text-xs sm:text-sm flex justify-between items-center cursor-pointer transition-all bg-white dark:bg-zinc-800 hover:bg-brand-50 dark:hover:bg-zinc-700"
              :class="{ '!bg-brand-100/90 dark:!bg-brand-900/60 border-l-4 border-l-brand-600 dark:border-l-brand-400 font-bold shadow-xs': selectedSubstitute?._id === prod._id }"
              @click="selectSubstituteProduct(prod)"
            >
              <div class="space-y-0.5">
                <div class="font-bold text-base-content leading-snug">{{ getLocalizedName(prod.name) }}</div>
                <div class="text-[11px] text-base-content/70 font-mono font-medium">SKU: {{ prod.sku || 'N/A' }}</div>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="font-mono font-bold text-sm text-base-content">
                  {{ formatMoney(prod.price?.[currency] ?? prod.price?.SEK ?? 0, currency) }}
                </span>
                <Icon
                  v-if="selectedSubstitute?._id === prod._id"
                  name="lucide:check-circle-2"
                  class="size-5 text-brand-600 dark:text-brand-400 shrink-0"
                />
              </div>
            </div>
          </div>

          <div v-if="selectedSubstitute" class="form-control pt-1">
            <label class="label text-xs font-bold uppercase tracking-wider text-base-content pb-1">
              {{ t('admin.orders.pack.modal.substituteQty') }}
            </label>
            <input
              v-model.number="modalAdjustedQuantity"
              type="number"
              min="1"
              class="input w-full font-mono text-base font-bold px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
            />
          </div>
        </div>

        <!-- Note / Reason -->
        <div class="form-control">
          <label class="label text-xs font-bold uppercase tracking-wider text-base-content pb-1">
            {{ t('admin.orders.pack.modal.noteLabel') }}
          </label>
          <textarea
            v-model="modalNote"
            rows="2"
            :placeholder="t('admin.orders.pack.modal.notePlaceholder')"
            class="textarea w-full p-3.5 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all text-sm shadow-xs leading-relaxed"
          ></textarea>
        </div>
      </div>

      <!-- Modal Action Buttons with Generous Padding and Distance -->
      <div class="flex items-center justify-end gap-3.5 pt-6 mt-8 border-t-2 border-slate-200 dark:border-zinc-700">
        <button
          type="button"
          class="btn px-5 py-2.5 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-base-content border-2 border-slate-300 dark:border-zinc-600 font-bold rounded-xl transition-colors shadow-xs"
          @click="handleClose"
        >
          {{ t('admin.orders.pack.modal.cancel') }}
        </button>
        <button
          type="button"
          class="btn px-6 py-2.5 h-11 bg-brand-600 hover:bg-brand-700 text-white border-transparent font-bold rounded-xl shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          :disabled="selectedActionType === 'SUBSTITUTE_ITEM' && !selectedSubstitute"
          @click="applyShortageAction"
        >
          {{ t('admin.orders.pack.modal.apply') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop bg-black/60 backdrop-blur-xs">
      <button type="button" class="outline-none text-transparent cursor-default" @click="handleClose">Stäng</button>
    </form>
  </dialog>
</template>