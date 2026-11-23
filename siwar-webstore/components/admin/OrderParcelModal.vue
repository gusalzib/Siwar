<!-- components/admin/OrderParcelModal.vue -->
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PackageParcel, ParcelPresetName } from '~/server/types/shipping'

/**
 * Standard Swedish DHL carton dimension presets.
 * Pre-calibrated for standard DHL Freight Servicepoint (Product 103) cardboard shippers.
 */
interface PresetOption {
  id: ParcelPresetName
  labelKey: string
  defaultLabel: string
  dimensions: { lengthCm: number; widthCm: number; heightCm: number }
  description: string
}

const BOX_PRESETS: readonly PresetOption[] = [
  {
    id: 'LITEN',
    labelKey: 'admin.orders.pack.parcelModal.presetLiten',
    defaultLabel: 'Liten (25 × 20 × 15 cm)',
    dimensions: { lengthCm: 25, widthCm: 20, heightCm: 15 },
    description: 'Kryddor, te, mindre burkar',
  },
  {
    id: 'MELLAN',
    labelKey: 'admin.orders.pack.parcelModal.presetMellan',
    defaultLabel: 'Mellan (35 × 25 × 20 cm)',
    dimensions: { lengthCm: 35, widthCm: 25, heightCm: 20 },
    description: 'Standardkartong för blandade livsmedel',
  },
  {
    id: 'STOR',
    labelKey: 'admin.orders.pack.parcelModal.presetStor',
    defaultLabel: 'Stor (45 × 35 × 30 cm)',
    dimensions: { lengthCm: 45, widthCm: 35, heightCm: 30 },
    description: 'Större volym, oljor och bulkköp',
  },
] as const

interface Props {
  isOpen: boolean
  calculatedGrossWeightGrams: number
  isSubmitting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSubmitting: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', parcel: PackageParcel): void
}>()

const { t } = useI18n()

// Pre-calculated weight converted to kilograms
const calculatedKg = computed(() => {
  const kg = (props.calculatedGrossWeightGrams || 0) / 1000
  return Number(kg.toFixed(2))
})

// Measured scale weight (editable input)
const measuredWeightKg = ref<number>(3.5)

// Carton dimensions in centimeters
const lengthCm = ref<number>(35)
const widthCm = ref<number>(25)
const heightCm = ref<number>(20)
const selectedPreset = ref<ParcelPresetName>('MELLAN')

// Sync initial values whenever modal opens or calculated weight changes
watch(
  () => props.isOpen,
  (open) => {
    if (import.meta.client) {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
    }

    if (open) {
      // Default measured scale weight: calculated weight + typical cardboard box tare (~300g)
      const baseKg = calculatedKg.value > 0 ? calculatedKg.value : 1.0
      const suggestedTare = calculatedKg.value > 0 ? 0.3 : 0
      measuredWeightKg.value = Number((baseKg + suggestedTare).toFixed(2))

      // Default to MELLAN preset
      applyPreset('MELLAN')
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

/**
 * Applies dimension values from standard cardboard presets.
 */
function applyPreset(presetId: ParcelPresetName) {
  const found = BOX_PRESETS.find((p) => p.id === presetId)
  if (found) {
    selectedPreset.value = presetId
    lengthCm.value = found.dimensions.lengthCm
    widthCm.value = found.dimensions.widthCm
    heightCm.value = found.dimensions.heightCm
  }
}

/**
 * Flags preset as CUSTOM if user manually alters dimensions.
 */
function onDimensionChange() {
  const matches = BOX_PRESETS.find(
    (p) =>
      p.dimensions.lengthCm === lengthCm.value &&
      p.dimensions.widthCm === widthCm.value &&
      p.dimensions.heightCm === heightCm.value
  )
  selectedPreset.value = matches ? matches.id : 'CUSTOM'
}

// Difference between scale weight and pre-calculated product catalog grossWeight (tare weight)
const tareDifferenceKg = computed(() => {
  const diff = measuredWeightKg.value - calculatedKg.value
  return Number(diff.toFixed(2))
})

// Validation checks
const isValid = computed(() => {
  return (
    measuredWeightKg.value > 0 &&
    lengthCm.value > 0 &&
    widthCm.value > 0 &&
    heightCm.value > 0 &&
    !props.isSubmitting
  )
})

function handleConfirm() {
  if (!isValid.value) return

  emit('confirm', {
    weightKg: Number(Number(measuredWeightKg.value).toFixed(2)),
    lengthCm: Math.round(lengthCm.value),
    widthCm: Math.round(widthCm.value),
    heightCm: Math.round(heightCm.value),
    preset: selectedPreset.value,
    contentsDescription: 'Livsmedel / Food items',
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/75 dark:bg-black/85 flex items-center justify-center p-4 sm:p-6 md:p-8"
      role="dialog"
      aria-modal="true"
    >
      <!-- Clickable backdrop to close modal -->
      <div
        class="fixed inset-0"
        @click="!isSubmitting && emit('close')"
      />

      <!-- Modal Content Dialog with ample margins and max-height scrolling -->
      <div
        class="relative w-full max-w-xl my-auto max-h-[calc(100vh-3rem)] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl border-2 border-slate-300 dark:border-zinc-700 shadow-2xl p-6 sm:p-7 text-base-content z-10"
        @click.stop
      >
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Icon name="lucide:scale" class="size-6" />
          </div>
          <div>
            <h2 class="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {{ t('admin.orders.pack.parcelModal.title', 'Paketmått & Vågkontroll (DHL Servicepoint 103)') }}
            </h2>
            <p class="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              {{ t('admin.orders.pack.parcelModal.subtitle', 'Verifiera faktisk paketvikt och kartongmått innan sändningen bokas hos DHL Freight.') }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          <Icon name="lucide:x" class="size-5" />
        </button>
      </div>

      <div class="space-y-6 pt-5">
        <!-- 1. Scale Weight vs Catalog Gross Weight -->
        <div class="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-4 border border-slate-200 dark:border-zinc-700 space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-600 dark:text-zinc-400">
              {{ t('admin.orders.pack.parcelModal.calculatedWeight', 'Beräknad artikelvikt (Katalog):') }}
            </span>
            <span class="font-mono font-bold text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-700 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-600">
              {{ calculatedKg }} kg ({{ calculatedGrossWeightGrams }} g)
            </span>
          </div>

          <!-- Measured Scale Input -->
          <div>
            <label class="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-1.5">
              {{ t('admin.orders.pack.parcelModal.scaleWeight', 'Uppmätt vågvikt (inkl. kartong & emballage):') }}
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model.number="measuredWeightKg"
                type="number"
                step="0.01"
                min="0.1"
                class="input input-bordered w-full font-mono text-lg font-bold bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 pr-12 focus:border-amber-500 focus:outline-none"
                placeholder="3.70"
                :disabled="isSubmitting"
              />
              <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-zinc-400 pointer-events-none">
                kg
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
              {{ t('admin.orders.pack.parcelModal.scaleWeightHelp', 'Ange den faktiska bruttovikten på vågen i kg för att undvika eftertaxering från transportören.') }}
            </p>
          </div>

          <!-- Tare Notice Indicator -->
          <div
            v-if="tareDifferenceKg !== 0"
            class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
            :class="tareDifferenceKg > 0 ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200' : 'bg-blue-100/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'"
          >
            <Icon name="lucide:info" class="size-4 shrink-0" />
            <span>
              {{ t('admin.orders.pack.parcelModal.tareNotice', { diff: Math.abs(tareDifferenceKg) }, `Vågvikt skiljer sig med ${tareDifferenceKg > 0 ? '+' : ''}${tareDifferenceKg} kg mot beräknad artikelvikt.`) }}
            </span>
          </div>
        </div>

        <!-- 2. Carton Dimension Presets -->
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">
            {{ t('admin.orders.pack.parcelModal.boxPresets', 'Standardkartonger (Snabbval):') }}
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              v-for="preset in BOX_PRESETS"
              :key="preset.id"
              type="button"
              class="flex flex-col text-left p-3 rounded-xl border-2 transition-all active:scale-98"
              :class="selectedPreset === preset.id
                ? 'bg-amber-500/10 border-amber-500 dark:border-amber-400 text-slate-900 dark:text-zinc-100'
                : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600'"
              :disabled="isSubmitting"
              @click="applyPreset(preset.id)"
            >
              <div class="flex items-center justify-between w-full">
                <span class="text-xs font-bold">{{ preset.id === 'LITEN' ? 'Liten' : preset.id === 'MELLAN' ? 'Mellan' : 'Stor' }}</span>
                <span
                  v-if="selectedPreset === preset.id"
                  class="badge badge-xs bg-amber-500 text-slate-900 font-bold border-none"
                >
                  Vald
                </span>
              </div>
              <span class="text-[11px] font-mono mt-1 opacity-90">
                {{ preset.dimensions.lengthCm }}×{{ preset.dimensions.widthCm }}×{{ preset.dimensions.heightCm }} cm
              </span>
              <span class="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 truncate">
                {{ preset.description }}
              </span>
            </button>
          </div>
        </div>

        <!-- 3. Explicit Dimensions Input -->
        <div>
          <label class="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-1.5">
            {{ t('admin.orders.pack.parcelModal.dimensions', 'Kartongmått (Längd × Bredd × Höjd i cm):') }}
          </label>
          <div class="grid grid-cols-3 gap-2.5">
            <div>
              <label class="text-[11px] text-slate-500 dark:text-zinc-400 mb-1 block">{{ t('admin.orders.pack.parcelModal.length', 'Längd (cm)') }}</label>
              <input
                v-model.number="lengthCm"
                type="number"
                min="5"
                max="200"
                class="input input-bordered w-full font-mono text-center font-bold bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:border-amber-500"
                :disabled="isSubmitting"
                @input="onDimensionChange"
              />
            </div>
            <div>
              <label class="text-[11px] text-slate-500 dark:text-zinc-400 mb-1 block">{{ t('admin.orders.pack.parcelModal.width', 'Bredd (cm)') }}</label>
              <input
                v-model.number="widthCm"
                type="number"
                min="5"
                max="200"
                class="input input-bordered w-full font-mono text-center font-bold bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:border-amber-500"
                :disabled="isSubmitting"
                @input="onDimensionChange"
              />
            </div>
            <div>
              <label class="text-[11px] text-slate-500 dark:text-zinc-400 mb-1 block">{{ t('admin.orders.pack.parcelModal.height', 'Höjd (cm)') }}</label>
              <input
                v-model.number="heightCm"
                type="number"
                min="2"
                max="200"
                class="input input-bordered w-full font-mono text-center font-bold bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:border-amber-500"
                :disabled="isSubmitting"
                @input="onDimensionChange"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-3 mt-7 pt-4 border-t border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          class="btn btn-sm btn-ghost text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          {{ t('admin.orders.pack.parcelModal.cancel', 'Avbryt') }}
        </button>

        <!-- Dispatch Button with High Contrast & Clear Text in Light/Dark Mode -->
        <button
          type="button"
          class="btn btn-sm bg-brand-600 hover:bg-brand-700 text-white font-bold border-transparent px-4 shadow-sm gap-2 transition-transform active:scale-95 disabled:opacity-50"
          :disabled="!isValid"
          @click="handleConfirm"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
          <Icon v-else name="lucide:truck" class="size-4" />
          <span>
            {{ isSubmitting
              ? t('admin.orders.pack.parcelModal.booking', 'Bokar sändning hos DHL...')
              : t('admin.orders.pack.parcelModal.confirmAndDispatch', 'Bekräfta & Boka DHL-sändning')
            }}
          </span>
        </button>
      </div>
    </div>
  </div>
</Teleport>
</template>

