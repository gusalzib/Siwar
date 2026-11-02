<!-- components/admin/AdminDiscountAdjustModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toMajorUnits } from '~~/utils/currency'

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
const localDiscount = ref(0)
const localStartsAt = ref('')
const localExpiresAt = ref('')
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

// Preset percentages
const DISCOUNT_PRESETS = [0, 10, 15, 20, 25, 30, 50]

function getLocalizedText(obj?: Record<string, string>): string {
  if (!obj) return ''
  return obj[locale.value] || obj['sv'] || obj['en'] || obj['ar'] || ''
}

// Convert Date or ISO string to input datetime-local format (YYYY-MM-DDTHH:mm)
function toDatetimeLocalString(val?: string | Date | null): string {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`
}

// Reset state when opening or product changes
watch(
  () => [props.isOpen, props.product],
  ([open, prod]) => {
    if (open && prod) {
      errorMessage.value = null
      localDiscount.value = typeof prod.discount === 'number' ? prod.discount : 0
      localStartsAt.value = toDatetimeLocalString(prod.discountStartsAt)
      localExpiresAt.value = toDatetimeLocalString(prod.discountExpiresAt)
    }
  },
  { immediate: true }
)

// Date validation check
const dateValidationError = computed(() => {
  if (localDiscount.value > 0 && localStartsAt.value && localExpiresAt.value) {
    const starts = new Date(localStartsAt.value).getTime()
    const expires = new Date(localExpiresAt.value).getTime()
    if (expires <= starts) {
      return t('admin.discountModal.dateOrderError', 'Slutdatum måste vara efter startdatum.')
    }
  }
  return null
})

// Can submit validation (0 <= discount <= 90)
const isValid = computed(() => {
  if (localDiscount.value < 0 || localDiscount.value > 90 || !Number.isInteger(localDiscount.value)) {
    return false
  }
  if (dateValidationError.value) {
    return false
  }
  return true
})

// Live schedule status badge preview
const liveScheduleStatus = computed<'active' | 'scheduled' | 'expired' | 'none'>(() => {
  if (localDiscount.value <= 0) return 'none'
  const now = new Date().getTime()

  if (localExpiresAt.value) {
    const expires = new Date(localExpiresAt.value).getTime()
    if (!Number.isNaN(expires) && expires <= now) {
      return 'expired'
    }
  }

  if (localStartsAt.value) {
    const starts = new Date(localStartsAt.value).getTime()
    if (!Number.isNaN(starts) && starts > now) {
      return 'scheduled'
    }
  }

  return 'active'
})

// Calculate discounted multi-currency price previews
function calculateDiscountedPrice(originalMinor: number, discountPercent: number): number {
  if (discountPercent <= 0) return originalMinor
  const factor = (100 - discountPercent) / 100
  return Math.round(originalMinor * factor)
}

function selectPreset(percent: number) {
  localDiscount.value = percent
  if (percent === 0) {
    // AC-5: clears dates on 0%
    clearDates()
  }
}

function clearDates() {
  localStartsAt.value = ''
  localExpiresAt.value = ''
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
      discount: localDiscount.value,
      discountStartsAt: localDiscount.value === 0 ? null : (localStartsAt.value ? new Date(localStartsAt.value).toISOString() : null),
      discountExpiresAt: localDiscount.value === 0 ? null : (localExpiresAt.value ? new Date(localExpiresAt.value).toISOString() : null),
    }

    const res = await $fetch<any>(`/api/admin/products/${props.product.id}/discount`, {
      method: 'PATCH',
      body: payload,
    })

    emit('saved', res)
    handleClose()
  } catch (err: any) {
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.data?.message ||
      t('admin.discountModal.error', 'Kunde inte uppdatera rabatten.')
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
          <div class="size-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
            <Icon name="lucide:percent" class="size-5" />
          </div>
          <div class="space-y-0.5 min-w-0 flex-1">
            <h3 class="font-extrabold text-lg text-base-content leading-snug">
              {{ t('admin.discountModal.title', 'Snabbjustera rabatt') }}
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
    <div v-if="errorMessage || dateValidationError" class="alert alert-error text-xs py-2 px-3 rounded-xl">
      <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
      <span>{{ errorMessage || dateValidationError }}</span>
    </div>

    <!-- Live Status & Price Previews Header -->
    <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-base-content/70">
          {{ t('admin.discountModal.campaignStatus', 'Kampanjstatus') }}
        </span>

        <!-- Live Localized Schedule Badge (AC-4, AC-5) -->
        <span
          v-if="liveScheduleStatus === 'scheduled'"
          class="badge badge-warning badge-sm text-black font-bold gap-1 shadow-xs"
        >
          <Icon name="lucide:clock" class="size-3 text-black" />
          {{ t('admin.discountModal.statusScheduled', 'Schemalagd') }} (-{{ localDiscount }}%)
        </span>
        <span
          v-else-if="liveScheduleStatus === 'active'"
          class="badge badge-success badge-sm text-white font-bold gap-1 shadow-xs"
        >
          <Icon name="lucide:zap" class="size-3 text-white" />
          {{ t('admin.discountModal.statusActive', 'Aktiv nu') }} (-{{ localDiscount }}%)
        </span>
        <span
          v-else-if="liveScheduleStatus === 'expired'"
          class="badge badge-error badge-sm text-white font-bold gap-1 shadow-xs"
        >
          <Icon name="lucide:calendar-x" class="size-3 text-white" />
          {{ t('admin.discountModal.statusExpired', 'Utgången') }}
        </span>
        <span
          v-else
          class="badge badge-ghost badge-sm font-bold text-base-content/60"
        >
          {{ t('admin.discountModal.statusNone', 'Ingen aktiv rabatt') }}
        </span>
      </div>

      <!-- Multi-currency Effective Price Preview -->
      <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-zinc-700 text-center">
        <!-- SEK -->
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono font-bold text-base-content/60">SEK</span>
          <div class="text-sm font-black text-base-content">
            <span v-if="localDiscount > 0" class="line-through text-base-content/40 text-xs mr-1">
              {{ toMajorUnits(product?.price?.SEK || 0) }}
            </span>
            <span>{{ toMajorUnits(calculateDiscountedPrice(product?.price?.SEK || 0, localDiscount)) }} kr</span>
          </div>
        </div>

        <!-- EUR -->
        <div class="space-y-0.5 border-x border-slate-200 dark:border-zinc-700">
          <span class="text-[11px] font-mono font-bold text-base-content/60">EUR</span>
          <div class="text-sm font-black text-base-content">
            <span v-if="localDiscount > 0" class="line-through text-base-content/40 text-xs mr-1">
              {{ toMajorUnits(product?.price?.EUR || 0) }}
            </span>
            <span>€{{ toMajorUnits(calculateDiscountedPrice(product?.price?.EUR || 0, localDiscount)) }}</span>
          </div>
        </div>

        <!-- USD -->
        <div class="space-y-0.5">
          <span class="text-[11px] font-mono font-bold text-base-content/60">USD</span>
          <div class="text-sm font-black text-base-content">
            <span v-if="localDiscount > 0" class="line-through text-base-content/40 text-xs mr-1">
              {{ toMajorUnits(product?.price?.USD || 0) }}
            </span>
            <span>${{ toMajorUnits(calculateDiscountedPrice(product?.price?.USD || 0, localDiscount)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Percentage Preset Chips (AC-4, AC-5) -->
    <div class="space-y-2">
      <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
        {{ t('admin.discountModal.presetsLabel', 'Snabbval rabattsats') }}
      </label>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in DISCOUNT_PRESETS"
          :key="preset"
          type="button"
          class="btn btn-sm h-9 px-3 rounded-xl font-bold transition-transform active:scale-95 text-xs shadow-xs"
          :class="localDiscount === preset
            ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs'
            : preset === 0
              ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-2 border-rose-200 dark:border-rose-900'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-zinc-600'"
          @click="selectPreset(preset)"
        >
          {{ preset === 0 ? t('admin.discountModal.presetZero', '0% (Ingen)') : `-${preset}%` }}
        </button>
      </div>
    </div>

    <!-- Manual Percentage Input -->
    <div class="space-y-1.5">
      <label class="text-xs font-bold uppercase tracking-wider text-base-content block">
        {{ t('admin.discountModal.manualDiscountLabel', 'Ange exakt procentsats (0–90%)') }}
      </label>
      <div class="relative">
        <input
          v-model.number="localDiscount"
          type="number"
          min="0"
          max="90"
          step="1"
          class="input w-full font-mono text-base font-bold pl-4 pr-10 py-2.5 h-11 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
          @keydown.enter.prevent="handleSave"
        />
        <span class="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-base-content/50 pointer-events-none">
          %
        </span>
      </div>
      <p v-if="localDiscount < 0 || localDiscount > 90" class="text-xs font-bold text-error">
        {{ t('admin.discountModal.percentRangeError', 'Rabattsats måste vara mellan 0% och 90%.') }}
      </p>
    </div>

    <!-- Campaign Schedule Pickers -->
    <div class="space-y-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold uppercase tracking-wider text-base-content">
          {{ t('admin.discountModal.scheduleHeading', 'Schemalägg kampanjperiod (valfritt)') }}
        </label>
        <button
          v-if="localStartsAt || localExpiresAt"
          type="button"
          class="btn btn-xs btn-ghost text-error hover:bg-error/10 font-bold gap-1 rounded-lg"
          @click="clearDates"
        >
          <Icon name="lucide:trash-2" class="size-3" />
          {{ t('admin.discountModal.clearDates', 'Rensa datum') }}
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Start Date -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-base-content/70 block">
            {{ t('admin.discountModal.startDate', 'Startdatum & tid') }}
          </label>
          <input
            v-model="localStartsAt"
            type="datetime-local"
            class="input w-full text-xs font-mono font-medium px-3 py-2 h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
          />
        </div>

        <!-- Expiration Date -->
        <div class="space-y-1">
          <label class="text-xs font-semibold text-base-content/70 block">
            {{ t('admin.discountModal.endDate', 'Slutdatum & tid') }}
          </label>
          <input
            v-model="localExpiresAt"
            type="datetime-local"
            class="input w-full text-xs font-mono font-medium px-3 py-2 h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all shadow-xs"
          />
        </div>
      </div>
      <p class="text-[11px] text-base-content/60 leading-relaxed font-medium">
        {{ t('admin.discountModal.scheduleHelp', 'Lämna tomt för att aktivera omedelbart utan slutdatum. Om 0% väljs nollställs alla datum automatiskt.') }}
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
          {{ t('admin.discountModal.cancel', 'Avbryt') }}
        </button>

        <button
          type="button"
          :disabled="!isValid || isSubmitting"
          class="btn h-10 px-6 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 !text-white !border-none shadow-sm transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
          @click="handleSave"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs" />
          <Icon v-else name="lucide:check" class="size-4" />
          <span>{{ isSubmitting ? t('admin.discountModal.saving', 'Sparar...') : t('admin.discountModal.save', 'Spara rabatt') }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
