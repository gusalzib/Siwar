<!-- components/admin/AdminStockAdjustModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  isOpen: boolean
  product: any | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', updated: any): void
}>()

const { t, locale } = useI18n()

// Form state
const localStock = ref(0)
const localBuffer = ref(0)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Reset state whenever the modal opens or product changes
watch(
  () => [props.isOpen, props.product],
  ([open, prod]) => {
    if (open && prod) {
      errorMessage.value = null
      localStock.value = Number.isInteger(prod.stockQuantity) ? prod.stockQuantity : 0
      localBuffer.value = Number.isInteger(prod.safetyBuffer) && prod.safetyBuffer >= 0 ? prod.safetyBuffer : 0
    }
  },
  { immediate: true }
)

// Computed effective buffer and online stock preview
const effectiveBuffer = computed(() => {
  return localBuffer.value >= 0 ? localBuffer.value : 0
})

const effectiveOnlineStock = computed(() => {
  return Math.max(0, localStock.value - effectiveBuffer.value)
})

// Can submit validation (AC-3: stockQuantity >= 0 and safetyBuffer >= 0)
const isValid = computed(() => {
  if (localStock.value < 0 || !Number.isInteger(localStock.value)) return false
  if (localBuffer.value < 0 || !Number.isInteger(localBuffer.value)) return false
  return true
})

function applyDelta(delta: number) {
  const next = localStock.value + delta
  localStock.value = Math.max(0, next)
}

function handleClose() {
  errorMessage.value = null
  emit('close')
}

async function handleSave() {
  if (!isValid.value || !props.product || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    const payload = {
      stockQuantity: localStock.value,
      safetyBuffer: localBuffer.value,
    }

    const res = await $fetch<any>(`/api/admin/products/${props.product.id}/stock`, {
      method: 'PATCH',
      body: payload,
    })

    emit('saved', res)
    handleClose()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.stockModal.error', 'Kunde inte uppdatera lagersaldot.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :is-open="isOpen"
    max-width="lg"
    :show-close-button="true"
    @close="handleClose"
  >
    <!-- Custom Header -->
    <template #header>
      <div class="flex items-start justify-between gap-3 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <div class="size-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="lucide:boxes" class="size-5" />
          </div>
          <div class="space-y-0.5 min-w-0 flex-1">
            <h3 class="font-extrabold text-lg text-base-content leading-snug">
              {{ t('admin.stockModal.title', 'Snabbjustera lager') }}
            </h3>
            <p v-if="product" class="text-xs text-base-content/70 font-semibold truncate">
              {{ getLocalizedText(product.name) }}
              <span v-if="product.barcode" class="font-mono text-base-content/50 ml-1">({{ product.barcode }})</span>
            </p>
          </div>
        </div>

        <button
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

    <!-- Error Alert Banner -->
    <div v-if="errorMessage" class="alert alert-error text-xs py-2 px-3 rounded-xl">
      <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Live Status Preview Cards -->
    <div class="grid grid-cols-3 gap-2.5 sm:gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 text-center">
      <!-- Physical Stock -->
      <div class="space-y-1">
        <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60 block">
          {{ t('admin.stockModal.physicalStock', 'Fysiskt') }}
        </span>
        <div class="text-xl sm:text-2xl font-black text-base-content font-mono">
          {{ localStock }}
        </div>
      </div>

      <!-- Active Buffer Threshold -->
      <div class="space-y-1 border-x border-slate-200 dark:border-zinc-700">
        <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60 block">
          {{ t('admin.stockModal.safetyBuffer', 'Buffert') }}
        </span>
        <div class="text-xl sm:text-2xl font-black text-base-content font-mono">
          {{ effectiveBuffer }}
        </div>
      </div>

      <!-- Effective Online Available Stock with Live Badge -->
      <div class="space-y-1">
        <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/60 block">
          {{ t('admin.stockModal.onlineStock', 'Online') }}
        </span>
        <div
          class="text-xl sm:text-2xl font-black font-mono"
          :class="effectiveOnlineStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
        >
          {{ effectiveOnlineStock }}
        </div>
      </div>
    </div>

    <!-- Live Online Availability Badge -->
    <div class="flex items-center justify-between px-1">
      <span class="text-xs font-semibold text-base-content/70">
        {{ t('admin.stockModal.statusLabel', 'Status i webbutik:') }}
      </span>
      <span
        v-if="localStock <= 0"
        class="badge badge-error badge-sm text-white font-bold"
      >
        {{ t('admin.stockModal.outOfStockBadge', 'Slut i lager') }}
      </span>
      <span
        v-else-if="effectiveOnlineStock <= 0"
        class="badge badge-warning badge-sm text-black font-bold"
      >
        {{ t('admin.stockModal.outOfStockOnlineBadge', 'Tillfälligt slut online') }}
      </span>
      <span
        v-else
        class="badge badge-success badge-sm text-white font-bold"
      >
        {{ t('admin.stockModal.inStockBadge', 'I lager') }}
      </span>
    </div>

    <!-- Quick Delta Stepper Buttons -->
    <div class="space-y-2">
      <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
        {{ t('admin.stockModal.quickDeltas', 'Snabbjustering (Delta)') }}
      </label>
      <div class="grid grid-cols-5 gap-2">
        <button
          type="button"
          class="btn btn-sm h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-transform active:scale-95 shadow-xs"
          @click="applyDelta(-1)"
        >
          -1
        </button>
        <button
          type="button"
          class="btn btn-sm h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-transform active:scale-95 shadow-xs"
          @click="applyDelta(1)"
        >
          +1
        </button>
        <button
          type="button"
          class="btn btn-sm h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-transform active:scale-95 shadow-xs"
          @click="applyDelta(5)"
        >
          +5
        </button>
        <button
          type="button"
          class="btn btn-sm h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-transform active:scale-95 shadow-xs"
          @click="applyDelta(10)"
        >
          +10
        </button>
        <button
          type="button"
          class="btn btn-sm h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-transform active:scale-95 shadow-xs"
          @click="applyDelta(20)"
        >
          +20
        </button>
      </div>
    </div>

    <!-- Manual Physical Stock Input -->
    <div class="space-y-1.5">
      <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
        {{ t('admin.stockModal.setExactStock', 'Ange exakt fysiskt lagersaldo') }}
      </label>
      <input
        v-model.number="localStock"
        type="number"
        min="0"
        step="1"
        class="input w-full font-mono text-base font-bold px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
        @keydown.enter.prevent="handleSave"
      />
      <p v-if="localStock < 0" class="text-xs font-bold text-error">
        {{ t('admin.stockModal.cannotBeNegative', 'Lagersaldot kan inte vara negativt.') }}
      </p>
    </div>

    <!-- Safety Buffer Configuration -->
    <div class="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
      <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
        {{ t('admin.stockModal.bufferConfiguration', 'Säkerhetsbuffert') }}
      </label>
      <input
        v-model.number="localBuffer"
        type="number"
        min="0"
        step="1"
        class="input w-full font-mono text-base font-bold px-4 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
        :placeholder="t('admin.stockModal.bufferPlaceholder', 'T.ex. 3')"
        @keydown.enter.prevent="handleSave"
      />
      <p v-if="localBuffer < 0" class="text-xs font-bold text-error">
        {{ t('admin.stockModal.cannotBeNegative', 'Bufferten kan inte vara negativ.') }}
      </p>
      <p v-else class="text-[11px] text-base-content/60 leading-relaxed font-medium">
        {{ t('admin.stockModal.bufferHelp', 'Enheter under detta tröskelvärde reserveras för butiksförsäljning och säljs ej online.') }}
      </p>
    </div>

    <!-- Modal Footer Actions -->
    <template #footer>
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          :disabled="isSubmitting"
          class="btn h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600 font-bold transition-colors shadow-xs"
          @click="handleClose"
        >
          {{ t('admin.stockModal.cancel', 'Avbryt') }}
        </button>

        <button
          type="button"
          :disabled="!isValid || isSubmitting"
          class="btn h-10 px-6 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 !text-white !border-none shadow-sm transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
          @click="handleSave"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs" />
          <Icon v-else name="lucide:check" class="size-4" />
          <span>{{ isSubmitting ? t('admin.stockModal.saving', 'Sparar...') : t('admin.stockModal.save', 'Spara lager') }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
