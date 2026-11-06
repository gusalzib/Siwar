<!-- pages/admin/orders/[id]/pack.vue -->
<script setup lang="ts">
import type { LineItemState, ShortageActionDraft } from '~/composables/useOrderPacking'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const orderId = route.params.id as string
const { data: order, pending, error, refresh } = await useFetch<any>(`/api/admin/orders/${orderId}`)

// Fetch dynamic StoreSettings for currency-aware threshold & shipping settings
const { data: storeSettings } = await useAsyncData(
  'packing-store-settings',
  () => $fetch<any>('/api/settings')
)

const {
  localItems,
  isSubmitting,
  errorMessage,
  totalFulfilledUnits,
  isOrderUnpackable,
  canDispatch,
  livePricing,
  toggleItemPicked,
  packAllItems,
  resetLineItem,
  applyShortageAction,
  submitPacking,
} = useOrderPacking(order, refresh, storeSettings)

const { t } = useI18n()

// Packing SLA threshold & aging calculations
const packingThresholdDays = computed<number>(() => {
  return storeSettings.value?.staleOrderPackingThresholdDays || 4
})

const elapsedDaysSincePlacement = computed<number>(() => {
  if (!order.value?.createdAt) return 0
  const createdMs = new Date(order.value.createdAt).getTime()
  const diffMs = Math.max(0, Date.now() - createdMs)
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
})

const isOrderStale = computed<boolean>(() => {
  if (!order.value || order.value.fulfillmentStatus !== 'PENDING_PACKING') return false
  const thresholdMs = packingThresholdDays.value * 24 * 60 * 60 * 1000
  const createdMs = new Date(order.value.createdAt).getTime()
  return (Date.now() - createdMs) > thresholdMs
})

// Warning banner for orders that cannot or should not be packed (cancelled, abandoned, unpaid, or already dispatched)
const unpackableBanner = computed(() => {
  if (!order.value) return null
  const fStatus = order.value.fulfillmentStatus
  const pStatus = order.value.paymentStatus

  if (fStatus === 'CANCELLED' || pStatus === 'CANCELLED') {
    return {
      type: 'error',
      icon: 'lucide:ban',
      title: t('admin.orders.pack.unpackable.cancelledTitle', 'Ordern är avbruten'),
      message: t('admin.orders.pack.unpackable.cancelledMessage', 'Denna order är avbruten och kan inte packas eller skickas.'),
    }
  }

  if (pStatus === 'ABANDONED') {
    return {
      type: 'warning',
      icon: 'lucide:alert-triangle',
      title: t('admin.orders.pack.unpackable.abandonedTitle', 'Övergiven betalsession'),
      message: t('admin.orders.pack.unpackable.abandonedMessage', 'Kunden avbröt eller lämnade kassan utan att slutföra betalningen. Ordern kan inte packas.'),
    }
  }

  if (pStatus === 'FAILED') {
    return {
      type: 'error',
      icon: 'lucide:alert-circle',
      title: t('admin.orders.pack.unpackable.failedTitle', 'Misslyckad betalning'),
      message: t('admin.orders.pack.unpackable.failedMessage', 'Betalningen misslyckades. Ordern kan inte expedieras.'),
    }
  }

  if (pStatus === 'PENDING') {
    return {
      type: 'info',
      icon: 'lucide:clock',
      title: t('admin.orders.pack.unpackable.pendingTitle', 'Väntar på betalning'),
      message: t('admin.orders.pack.unpackable.pendingMessage', 'Betalningen har inte auktoriserats eller bekräftats ännu. Ordern kan inte packas.'),
    }
  }

  if (fStatus === 'DISPATCHED') {
    return {
      type: 'neutral',
      icon: 'lucide:truck',
      title: t('admin.orders.pack.unpackable.dispatchedTitle', 'Ordern är redan skickad'),
      message: t('admin.orders.pack.unpackable.dispatchedMessage', 'Ordern har redan expedierats och dess innehåll är låst.'),
    }
  }

  return null
})

// Modal states
const activeShortageItem = ref<LineItemState | null>(null) // manages which specific item is currently being addressed in a shortage modal.
const isCancelModalOpen = ref(false)

function onApplyShortage(draft: ShortageActionDraft) {
  applyShortageAction(draft)
  activeShortageItem.value = null
}

async function onConfirmCancel(reason: string) {
  isSubmitting.value = true
  errorMessage.value = null

  try {
    await $fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      body: { reason },
    })

    isCancelModalOpen.value = false // Closes the modal on success
    await router.push(localePath('/admin/orders'))
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || err.message || 'Kunde inte avbryta ordern'
  } finally {
    /**
     * finally: A guaranteed cleanup block. 
     * It runs no matter what—whether the request succeeded, failed, or threw an unexpected error.
     * isSubmitting.value = false: Turns off the loading state and re-enables buttons.
     * Placing this inside finally ensures the UI never gets permanently stuck in a
     *  "loading" or "disabled" state if the request fails.
     */
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100/90 dark:bg-zinc-950 text-base-content p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <div v-if="pending" class="flex justify-center p-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <div v-else-if="error || !order" class="alert alert-error">
        <span>{{ error?.statusMessage || 'Kunde inte läsa in ordern' }}</span>
      </div>

      <template v-else>
        <!-- Top Action Bar -->
        <OrderPackHeader
          :order="order"
          :is-submitting="isSubmitting"
          :total-fulfilled-units="totalFulfilledUnits"
          :can-dispatch="canDispatch"
          :is-unpackable="isOrderUnpackable"
          @cancel="isCancelModalOpen = true"
          @pack-all="packAllItems"
          @save="submitPacking(false)"
          @dispatch="submitPacking(true)"
        />

        <!-- Warning Banner for Unpackable / Cancelled / Unpaid Orders -->
        <div
          v-if="unpackableBanner"
          role="alert"
          class="rounded-2xl p-4 sm:p-5 border-2 shadow-sm flex items-start gap-3.5 transition-colors"
          :class="{
            'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 text-rose-950 dark:text-rose-100': unpackableBanner.type === 'error',
            'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100': unpackableBanner.type === 'warning',
            'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800/80 text-sky-950 dark:text-sky-100': unpackableBanner.type === 'info',
            'bg-slate-100 dark:bg-zinc-800/90 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200': unpackableBanner.type === 'neutral',
          }"
        >
          <div
            class="p-2 rounded-xl shrink-0 mt-0.5"
            :class="{
              'bg-rose-200/80 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300': unpackableBanner.type === 'error',
              'bg-amber-200/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300': unpackableBanner.type === 'warning',
              'bg-sky-200/80 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300': unpackableBanner.type === 'info',
              'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300': unpackableBanner.type === 'neutral',
            }"
          >
            <Icon :name="unpackableBanner.icon" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-bold tracking-tight">
              {{ unpackableBanner.title }}
            </h3>
            <p class="text-xs mt-1 leading-relaxed opacity-90">
              {{ unpackableBanner.message }}
            </p>
          </div>
        </div>

        <!-- Overdue Aging Notice Banner (Packing SLA Threshold Exceeded) -->
        <div
          v-if="isOrderStale"
          role="alert"
          class="rounded-2xl p-4 sm:p-5 border-2 shadow-sm flex items-start gap-3.5 bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100 transition-colors"
        >
          <div class="p-2 rounded-xl shrink-0 mt-0.5 bg-rose-200/80 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
            <Icon name="lucide:clock-alert" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-sm font-bold tracking-tight">
                {{ t('admin.orders.pack.staleBanner.title', 'Försenad order – Packningsfrist överskriden') }}
              </h3>
              <span class="badge badge-error badge-sm text-white font-mono font-bold">
                {{ elapsedDaysSincePlacement }} {{ t('admin.orders.pack.staleBanner.daysElapsed', 'dagar sedan beställning') }}
              </span>
            </div>
            <p class="text-xs mt-1 leading-relaxed opacity-90">
              {{ t('admin.orders.pack.staleBanner.description', {
                days: elapsedDaysSincePlacement,
                threshold: packingThresholdDays
              }, `Denna order har väntat på packning i ${elapsedDaysSincePlacement} dagar, vilket överskrider butikens mål på ${packingThresholdDays} dagar. Vänligen prioritera packning eller kontakta kunden vid fördröjning.`) }}
            </p>
          </div>
        </div>

        <!-- Customer & Delivery Cards -->
        <OrderPackCustomerCard :customer="order.customer" />

        <div v-if="errorMessage" class="alert alert-error">
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Main Grid: Items & Settlement -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-4">
            <OrderPackTable
              :items="localItems"
              :currency="order.currency"
              :is-read-only="isOrderUnpackable"
              @toggle-picked="toggleItemPicked"
              @open-shortage="activeShortageItem = $event"
              @reset-item="resetLineItem"
            />


            <!-- Detailed Shortage & Settlement Audit Trail -->
            <OrderPackAuditTrail
              :adjustments="order.shortageAdjustments"
              :currency="order.currency"
            />
          </div>

          <div class="space-y-4">
            <OrderPackSettlementCard
              :order="order"
              :pricing="livePricing"
              :authorized-total-minor="order.pricing?.authorizedTotalMinor"
              :currency="order.currency"
              :payment-provider="order.paymentProvider"
            />
          </div>
        </div>

        <!-- Modals -->
        <OrderShortageModal
          :is-open="!!activeShortageItem"
          :item="activeShortageItem"
          :currency="order.currency"
          @close="activeShortageItem = null"
          @apply="onApplyShortage"
        />

        <OrderCancelModal
          :is-open="isCancelModalOpen"
          :order-reference="order.orderReference"
          :is-submitting="isSubmitting"
          @close="isCancelModalOpen = false"
          @confirm="onConfirmCancel"
        />
      </template>
    </div>
  </div>
</template>