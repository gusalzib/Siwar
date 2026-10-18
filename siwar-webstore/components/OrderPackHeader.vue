<!-- components/admin/orders/pack/OrderPackHeader.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  order: any
  isSubmitting: boolean
  totalFulfilledUnits: number
  canDispatch: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'packAll'): void
  (e: 'save'): void
  (e: 'dispatch'): void
}>()

const { t } = useI18n()
const localePath = useLocalePath()

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm">
    <div class="flex items-center gap-3">
      <NuxtLink :to="localePath('/admin/orders')" class="btn btn-ghost btn-circle btn-sm">
        <Icon name="lucide:arrow-left" class="size-5" />
      </NuxtLink>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold font-mono text-base-content">{{ order.orderReference }}</h1>
          <span
            class="badge badge-sm font-semibold"
            :class="{
              'badge-warning': order.fulfillmentStatus === 'PENDING_PACKING',
              'badge-info text-white': order.fulfillmentStatus === 'PACKED',
              'badge-success text-white': order.fulfillmentStatus === 'DISPATCHED',
              'badge-error text-white': order.fulfillmentStatus === 'CANCELLED',
            }"
          >
            {{ order.fulfillmentStatus }}
          </span>
          <span class="badge badge-outline badge-sm font-semibold border-slate-400 dark:border-zinc-500">
            {{ order.paymentProvider }}
          </span>
        </div>
        <p class="text-xs text-base-content/80 mt-1 font-mono font-medium">
          <ClientOnly>
            <span>{{ t('admin.orders.pack.summary.createdAt', 'Skapad:') }} {{ formatDate(order.createdAt) }}</span>
            <template #fallback>
              <span>{{ t('admin.orders.pack.summary.createdAt', 'Skapad:') }} {{ formatDate(order.createdAt) }}</span>
            </template>
          </ClientOnly>
        </p>
      </div>
    </div>

    <!-- Header Action Buttons -->
    <div class="flex flex-wrap items-center gap-2.5 justify-start lg:justify-end">
      <!-- Manual Cancel Action -->
      <button
        v-if="order.fulfillmentStatus !== 'DISPATCHED' && order.fulfillmentStatus !== 'CANCELLED'"
        type="button"
        class="btn btn-sm btn-ghost text-error hover:bg-error/10 gap-1.5 transition-colors"
        :disabled="isSubmitting"
        @click="emit('cancel')"
      >
        <Icon name="lucide:ban" class="size-4" />
        <span>{{ t('admin.orders.pack.actions.cancelOrder', 'Avbryt order') }}</span>
      </button>

      <!-- Mark All Packed -->
      <button
        type="button"
        class="btn btn-sm bg-transparent hover:bg-base-200 text-base-content px-3 border-2 border-brand-500 hover:border-brand-600 shadow-sm transition-colors active:scale-95"
        :disabled="order.fulfillmentStatus === 'DISPATCHED' || order.fulfillmentStatus === 'CANCELLED' || isSubmitting"
        @click="emit('packAll')"
      >
        <Icon name="lucide:check-check" class="size-4" />
        <span>{{ t('admin.orders.pack.actions.markAllPacked', 'Markera alla som packade') }}</span>
      </button>

      <button
        type="button"
        class="btn btn-sm bg-transparent hover:bg-base-200 text-base-content px-3 border-2 border-brand-500 hover:border-brand-300 shadow-sm transition-colors"
        :disabled="isSubmitting || order.fulfillmentStatus === 'DISPATCHED' || order.fulfillmentStatus === 'CANCELLED'"
        @click="emit('save')"
      >
        <Icon name="lucide:save" class="size-4" />
        <span>{{ t('admin.orders.pack.actions.savePacked', 'Spara packstatus') }}</span>
      </button>

      <button
        v-if="totalFulfilledUnits === 0"
        type="button"
        class="btn btn-sm bg-error hover:bg-error/90 text-white border-transparent px-3 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        :disabled="isSubmitting || order.fulfillmentStatus === 'CANCELLED'"
        @click="emit('dispatch')"
      >
        <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
        <Icon v-else name="lucide:x-circle" class="size-4" />
        <span>{{ t('admin.orders.pack.actions.cancelEmptyOrder', 'Avbryt order (Hela ordern saknas)') }}</span>
      </button>
      <button
        v-else
        type="button"
        class="btn btn-sm bg-brand-600 hover:bg-brand-700 text-white border-transparent px-3 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        :disabled="!canDispatch"
        @click="emit('dispatch')"
      >
        <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
        <Icon v-else name="lucide:truck" class="size-4" />
        <span>{{ t('admin.orders.pack.actions.dispatch', 'Slutför och Skicka') }}</span>
      </button>
    </div>
  </div>
</template>