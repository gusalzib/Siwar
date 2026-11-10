<!-- components/admin/DhlHandoverModal.vue -->
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateCode128Svg } from '~/utils/barcode'

interface Props {
  isOpen: boolean
  orderReference: string
  kolliId: string
  consignmentNumber?: string
  trackingUrl?: string
  labelUrl?: string
  customerName?: string
  weightKg?: number
}

const props = withDefaults(defineProps<Props>(), {
  consignmentNumber: '',
  trackingUrl: '',
  labelUrl: '',
  customerName: '',
  weightKg: 0,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

// Prevent background scrolling when modal is open
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
  },
  { immediate: true }
)

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

// Clipboard feedback states
const kolliCopied = ref(false)
const consignmentCopied = ref(false)

// Generate crisp SVG barcode (Code 128 Subset C for 18-digit numeric Kolli-ID)
const barcodeSvg = computed(() => {
  if (!props.kolliId) return ''
  try {
    return generateCode128Svg(props.kolliId, {
      height: 90,
      moduleWidth: 2.2,
      quietZone: 10,
      color: '#000000',
      backgroundColor: '#ffffff',
    })
  } catch (err) {
    console.error('[DhlHandoverModal] Failed to generate SVG barcode:', err)
    return ''
  }
})

// Formatted Kolli-ID with readable spacing: [00] [3733] [0012] [3456] [78] [90]
const formattedKolliId = computed(() => {
  if (!props.kolliId) return ''
  const raw = props.kolliId.trim()
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ')
})

function copyKolliId() {
  if (!props.kolliId) return
  navigator.clipboard.writeText(props.kolliId.trim())
  kolliCopied.value = true
  setTimeout(() => {
    kolliCopied.value = false
  }, 2000)
}

function copyConsignmentNumber() {
  if (!props.consignmentNumber) return
  navigator.clipboard.writeText(props.consignmentNumber.trim())
  consignmentCopied.value = true
  setTimeout(() => {
    consignmentCopied.value = false
  }, 2000)
}

function openPdfLabel() {
  if (props.labelUrl) {
    window.open(props.labelUrl, '_blank')
  } else {
    // Emergency print trigger
    window.print()
  }
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
      <!-- Clickable backdrop overlay to close -->
      <div
        class="fixed inset-0"
        @click="emit('close')"
      />

      <!-- Handover Card Dialog Container with margins and max-height scrolling -->
      <div
        class="relative w-full max-w-lg my-auto max-h-[calc(100vh-3rem)] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl border-2 border-slate-300 dark:border-zinc-700 shadow-2xl p-5 sm:p-7 text-base-content z-10"
        @click.stop
      >
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3 sm:pb-4">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Icon name="lucide:barcode" class="size-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {{ t('admin.orders.pack.dhlHandover.title', 'DHL Inlämningskort') }}
              </h2>
              <span class="badge badge-sm font-bold bg-amber-500 text-slate-950 border-none">
                DHL 103
              </span>
            </div>
            <p class="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              {{ t('admin.orders.pack.dhlHandover.subtitle', 'Visa streckkoden för DHL-ombudet eller chauffören vid inlämning eller upphämtning.') }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
          @click="emit('close')"
        >
          <Icon name="lucide:x" class="size-5" />
        </button>
      </div>

      <!-- Main Handover Content -->
      <div class="space-y-4 pt-4">
        <!-- Scannable High-Contrast Barcode Card (Always white background for optical scanning) -->
        <div class="bg-white rounded-xl p-4 sm:p-5 border-2 border-slate-300 dark:border-zinc-600 shadow-md text-center">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {{ t('admin.orders.pack.dhlHandover.barcodeLabel', 'Skanningsbar streckkod (Code 128 / Kolli-ID)') }}
          </div>

          <!-- SVG Barcode Rendering -->
          <div
            v-if="barcodeSvg"
            class="w-full flex justify-center items-center py-2 overflow-hidden select-none"
            v-html="barcodeSvg"
          ></div>

          <!-- Human-Readable 18-digit Kolli-ID with Instant Copy -->
          <div class="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div class="text-left w-full sm:w-auto">
              <span class="text-[10px] font-bold text-slate-400 block uppercase">
                {{ t('admin.orders.pack.dhlHandover.kolliIdLabel', 'Kolli-ID (18 siffror)') }}
              </span>
              <span class="font-mono text-lg sm:text-xl font-bold tracking-wider text-slate-950 select-all block">
                {{ formattedKolliId || kolliId }}
              </span>
            </div>

            <button
              type="button"
              class="btn btn-sm w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold border-none gap-1.5 shadow-sm active:scale-95 transition-transform"
              @click="copyKolliId"
            >
              <Icon :name="kolliCopied ? 'lucide:check' : 'lucide:copy'" class="size-4" />
              <span>
                {{ kolliCopied ? t('admin.orders.pack.dhlHandover.copied', 'Kopierad!') : t('admin.orders.pack.dhlHandover.copy', 'Kopiera') }}
              </span>
            </button>
          </div>
        </div>

        <!-- Consignment Details Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Sändningsnummer -->
          <div class="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-slate-200 dark:border-zinc-700">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                {{ t('admin.orders.pack.dhlHandover.consignmentLabel', 'Sändningsnummer') }}
              </span>
              <button
                v-if="consignmentNumber"
                type="button"
                class="btn btn-ghost btn-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 gap-1 p-1 h-auto"
                @click="copyConsignmentNumber"
              >
                <Icon :name="consignmentCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
                <span class="text-[10px]">{{ consignmentCopied ? 'Kopierad' : 'Kopiera' }}</span>
              </button>
            </div>
            <div class="font-mono font-bold text-sm text-slate-900 dark:text-zinc-100 mt-1">
              {{ consignmentNumber || '—' }}
            </div>
          </div>

          <!-- Order Reference & Weight -->
          <div class="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-slate-200 dark:border-zinc-700">
            <span class="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block">
              Orderreferens & Vikt
            </span>
            <div class="flex items-center justify-between font-mono font-bold text-sm text-slate-900 dark:text-zinc-100 mt-1">
              <span>{{ orderReference }}</span>
              <span v-if="weightKg > 0" class="badge badge-sm badge-ghost border-slate-300 dark:border-zinc-600 font-mono">
                {{ weightKg }} kg
              </span>
            </div>
          </div>
        </div>

        <!-- Carrier & Fallback Notice -->
        <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
          <Icon name="lucide:info" class="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p class="leading-relaxed">
            {{ t('admin.orders.pack.dhlHandover.manualHint', 'Om ombudets skanner inte kan läsa från mobilskärmen, visa Kolli-ID manuellt för inmatning i kassan.') }}
          </p>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="flex flex-wrap items-center justify-between gap-2.5 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
        <!-- Emergency PDF Fallback Button -->
        <button
          type="button"
          class="btn btn-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-600 gap-1.5 shadow-xs"
          @click="openPdfLabel"
        >
          <Icon name="lucide:printer" class="size-4" />
          <span>{{ t('admin.orders.pack.dhlHandover.printFallback', 'Skriv ut fraktsedel / PDF-reserv') }}</span>
        </button>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          <!-- External DHL Tracking Link -->
          <a
            v-if="trackingUrl"
            :href="trackingUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-none gap-1.5 shadow-sm"
          >
            <Icon name="lucide:external-link" class="size-4" />
            <span>{{ t('admin.orders.pack.dhlHandover.trackDhl', 'Spåra sändning hos DHL') }}</span>
          </a>

          <button
            type="button"
            class="btn btn-sm btn-ghost text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
            @click="emit('close')"
          >
            {{ t('admin.orders.pack.dhlHandover.close', 'Stäng') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</Teleport>
</template>

