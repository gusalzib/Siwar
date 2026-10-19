<!-- pages/admin/orders/[id]/pack.vue -->
<script setup lang="ts">
import type { LineItemState, ShortageActionDraft } from '~/composables/useOrderPacking'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const orderId = route.params.id as string
const { data: order, pending, error, refresh } = await useFetch<any>(`/api/admin/orders/${orderId}`)

const {
  localItems,
  isSubmitting,
  errorMessage,
  totalFulfilledUnits,
  canDispatch,
  livePricing,
  toggleItemPicked,
  packAllItems,
  resetLineItem,
  applyShortageAction,
  submitPacking,
} = useOrderPacking(order, refresh)

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
          @cancel="isCancelModalOpen = true"
          @pack-all="packAllItems"
          @save="submitPacking(false)"
          @dispatch="submitPacking(true)"
        />

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
              :is-read-only="order.fulfillmentStatus === 'DISPATCHED' || order.fulfillmentStatus === 'CANCELLED'"
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