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
    <div class="modal-box max-w-lg bg-base-100 border border-base-200 shadow-2xl p-6 sm:p-8">
      <h3 class="font-bold text-lg flex items-center gap-2">
        <Icon name="lucide:alert-triangle" class="size-5 text-warning" />
        {{ t('admin.orders.pack.modal.title') }}
      </h3>

      <p class="text-xs text-base-content/70 mt-1">
        {{ getLocalizedName(item?.name) }}
      </p>

      <div class="space-y-6 mt-6">
        <!-- Select Action Type -->
        <div class="form-control">
          <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.actionLabel') }}</label>
          <div class="grid grid-cols-3 gap-3">
            <button
              type="button"
              class="btn btn-sm"
              :class="selectedActionType === 'REDUCE_QUANTITY' ? 'bg-brand-600 hover:bg-brand-700 text-white border-brand-600' : 'btn-outline border-brand-500 text-base-content hover:bg-brand-50 hover:border-brand-600 hover:text-brand-800'"
              @click="selectActionType('REDUCE_QUANTITY')"
            >
              {{ t('admin.orders.pack.modal.reduceQty') }}
            </button>
            <button
              type="button"
              class="btn btn-sm"
              :class="selectedActionType === 'REMOVE_LINE' ? 'bg-error hover:bg-error/90 text-white border-transparent' : 'btn-outline border-base-300 text-base-content'"
              @click="selectActionType('REMOVE_LINE')"
            >
              {{ t('admin.orders.pack.modal.removeLine') }}
            </button>
            <button
              type="button"
              class="btn btn-sm"
              :class="selectedActionType === 'SUBSTITUTE_ITEM' ? 'bg-brand-600 hover:bg-brand-700 text-white border-brand-600' : 'btn-outline border-brand-500 text-base-content hover:bg-brand-50 hover:border-brand-600 hover:text-brand-800'"
              @click="selectActionType('SUBSTITUTE_ITEM')"
            >
              {{ t('admin.orders.pack.modal.substituteItem') }}
            </button>
          </div>
        </div>

        <!-- Option 1: Reduce Quantity Input -->
        <div v-if="selectedActionType === 'REDUCE_QUANTITY'" class="form-control">
          <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.newQty') }}</label>
          <input
            v-model.number="modalAdjustedQuantity"
            type="number"
            min="0"
            :max="item ? item.quantity - 1 : 0"
            class="input input-bordered input-sm w-full font-mono"
          />
        </div>

        <!-- Option 2: Substitution Product Search -->
        <div v-if="selectedActionType === 'SUBSTITUTE_ITEM'" class="space-y-3">
          <div class="form-control">
            <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.searchSubstitute') }}</label>
            <div class="join w-full">
              <input
                v-model="substituteSearchQuery"
                type="text"
                :placeholder="t('admin.orders.pack.modal.searchPlaceholder')"
                class="input input-bordered input-sm join-item w-full"
                @keydown.enter.prevent="searchSubstitutes"
              />
              <button
                type="button"
                class="btn btn-sm btn-primary join-item text-white"
                :disabled="isSearchingSubstitute"
                @click="searchSubstitutes"
              >
                <span v-if="isSearchingSubstitute" class="loading loading-spinner loading-xs"></span>
                <Icon v-else name="lucide:search" class="size-4" />
              </button>
            </div>
          </div>

          <!-- Search Results List -->
          <div v-if="substituteResults.length > 0" class="max-h-40 overflow-y-auto border border-base-200 rounded-lg divide-y">
            <div
              v-for="prod in substituteResults"
              :key="prod._id"
              class="p-2 text-xs flex justify-between items-center cursor-pointer hover:bg-base-200"
              :class="{ 'bg-primary/10 border-l-4 border-primary': selectedSubstitute?._id === prod._id }"
              @click="selectSubstituteProduct(prod)"
            >
              <div>
                <div class="font-bold">{{ getLocalizedName(prod.name) }}</div>
                <div class="text-[10px] text-base-content/50 font-mono">SKU: {{ prod.sku || 'N/A' }}</div>
              </div>
              <div class="font-mono font-semibold">
                {{ formatMoney(prod.price?.[currency] ?? prod.price?.SEK ?? 0, currency) }}
              </div>
            </div>
          </div>

          <div v-if="selectedSubstitute" class="form-control">
            <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.substituteQty') }}</label>
            <input
              v-model.number="modalAdjustedQuantity"
              type="number"
              min="1"
              class="input input-bordered input-sm w-full font-mono"
            />
          </div>
        </div>

        <!-- Note / Reason -->
        <div class="form-control">
          <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.noteLabel') }}</label>
          <textarea
            v-model="modalNote"
            rows="2"
            :placeholder="t('admin.orders.pack.modal.notePlaceholder')"
            class="textarea textarea-bordered textarea-sm w-full"
          ></textarea>
        </div>
      </div>

      <!-- Modal Action Buttons -->
      <div class="modal-action mt-8">
        <button type="button" class="btn btn-ghost btn-sm" @click="handleClose">{{ t('admin.orders.pack.modal.cancel') }}</button>
        <button
          type="button"
          class="btn btn-sm bg-brand-600 hover:bg-brand-700 text-white border-transparent disabled:opacity-50"
          :disabled="selectedActionType === 'SUBSTITUTE_ITEM' && !selectedSubstitute"
          @click="applyShortageAction"
        >
          {{ t('admin.orders.pack.modal.apply') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" class="outline-none text-transparent cursor-default" @click="handleClose">Stäng</button>
    </form>
  </dialog>
</template>