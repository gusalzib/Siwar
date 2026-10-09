<!-- pages/admin/orders/index.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  middleware: 'admin',
})

const { t } = useI18n()

const searchQuery = ref('')
const selectedFulfillmentStatus = ref('all')
const selectedPaymentStatus = ref('all')

const {
  data: orders,
  pending: isLoading,
  refresh: refreshOrders,
} = await useFetch<any[]>('/api/admin/orders', {
  query: computed(() => ({
    search: searchQuery.value || undefined,
    fulfillmentStatus:
      selectedFulfillmentStatus.value !== 'all' ? selectedFulfillmentStatus.value : undefined,
    paymentStatus:
      selectedPaymentStatus.value !== 'all' ? selectedPaymentStatus.value : undefined,
  })),
})

function formatMoney(amountMinor?: number, currency = 'SEK') {
  if (amountMinor === undefined || amountMinor === null) return '—'
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function resetFilters() {
  searchQuery.value = ''
  selectedFulfillmentStatus.value = 'all'
  selectedPaymentStatus.value = 'all'
}

// Quick counters for the header metrics
const pendingPackingCount = computed(
  () => orders.value?.filter((o) => o.fulfillmentStatus === 'PENDING_PACKING').length || 0
)
const dispatchedCount = computed(
  () => orders.value?.filter((o) => o.fulfillmentStatus === 'DISPATCHED').length || 0
)
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header & Stats Summary -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-base-content">
            {{ t('admin.orders.title', 'Orderhantering') }}
          </h1>
          <p class="text-sm text-base-content/60">
            {{ t('admin.orders.subtitle', 'Packa ordrar, hantera varubrist och granska betalningar') }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="stats shadow-sm bg-base-100 border border-base-200">
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs font-semibold">{{ t('admin.orders.stats.pendingPacking') }}</div>
              <div class="stat-value text-xl text-warning">{{ pendingPackingCount }}</div>
            </div>
            <div class="stat py-2 px-4">
              <div class="stat-title text-xs font-semibold">{{ t('admin.orders.stats.dispatched') }}</div>
              <div class="stat-value text-xl text-success">{{ dispatchedCount }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card bg-base-100 border border-base-200 shadow-sm">
        <div class="card-body p-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Search -->
            <div class="form-control">
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="t('admin.orders.filters.searchPlaceholder')"
                  class="input input-bordered input-sm w-full pl-9"
                />
                <Icon
                  name="lucide:search"
                  class="absolute left-3 top-2.5 size-4 text-base-content/40"
                />
              </div>
            </div>

            <!-- Fulfillment Status Filter -->
            <div class="form-control">
              <select v-model="selectedFulfillmentStatus" class="select select-bordered select-sm w-full">
                <option value="all">{{ t('admin.orders.filters.allFulfillmentStatuses') }}</option>
                <option value="PENDING_PACKING">{{ t('admin.orders.filters.pendingPacking') }}</option>
                <option value="PACKED">{{ t('admin.orders.filters.packed') }}</option>
                <option value="DISPATCHED">{{ t('admin.orders.filters.dispatched') }}</option>
                <option value="CANCELLED">{{ t('admin.orders.filters.cancelled') }}</option>
              </select>
            </div>

            <!-- Payment Status Filter -->
            <div class="form-control">
              <select v-model="selectedPaymentStatus" class="select select-bordered select-sm w-full">
                <option value="all">{{ t('admin.orders.filters.allPaymentStatuses') }}</option>
                <option value="AUTHORIZED">{{ t('admin.orders.filters.authorized') }}</option>
                <option value="CAPTURED">{{ t('admin.orders.filters.captured') }}</option>
                <option value="PARTIALLY_CAPTURED">{{ t('admin.orders.filters.partiallyCaptured') }}</option>
                <option value="PAID">{{ t('admin.orders.filters.paid') }}</option>
              </select>
            </div>

            <!-- Reset Filter CTA -->
            <div class="flex items-center justify-end">
              <button
                v-if="searchQuery || selectedFulfillmentStatus !== 'all' || selectedPaymentStatus !== 'all'"
                type="button"
                class="btn btn-ghost btn-sm text-xs gap-1"
                @click="resetFilters"
              >
                <Icon name="lucide:rotate-ccw" class="size-3.5" />
                {{ t('admin.orders.filters.resetFilters') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Orders Data Table -->
      <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
        <div class="card-body p-0">
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr class="bg-base-200/50 text-xs">
                  <th>{{ t('admin.orders.table.reference') }}</th>
                  <th>{{ t('admin.orders.table.customer') }}</th>
                  <th class="text-center">{{ t('admin.orders.table.items') }}</th>
                  <th>{{ t('admin.orders.table.fulfillmentStatus') }}</th>
                  <th>{{ t('admin.orders.table.payment') }}</th>
                  <th class="text-end">{{ t('admin.orders.table.amount') }}</th>
                  <th class="text-end">{{ t('admin.orders.table.date') }}</th>
                  <th class="text-center">{{ t('admin.orders.table.action') }}</th>
                </tr>
              </thead>
              <tbody>
                <!-- Loading -->
                <tr v-if="isLoading">
                  <td colspan="8" class="text-center py-12">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                  </td>
                </tr>

                <!-- Empty State -->
                <tr v-else-if="!orders || orders.length === 0">
                  <td colspan="8" class="text-center py-12 text-base-content/60">
                    <Icon name="lucide:inbox" class="size-8 mx-auto mb-2 opacity-40" />
                    <p class="font-semibold">{{ t('admin.orders.emptyState') }}</p>
                  </td>
                </tr>

                <!-- Orders Rows -->
                <tr v-for="order in orders" :key="order.id" class="hover">
                  <!-- Order Reference -->
                  <td class="font-mono font-bold text-sm">
                    {{ order.orderReference }}
                    <span
                      v-if="order.shortagesCount > 0"
                      class="badge badge-warning badge-xs ml-1"
                      :title="t('admin.orders.badges.hasShortages')"
                    >
                      {{ t('admin.orders.badges.shortage') }} ({{ order.shortagesCount }})
                    </span>
                  </td>

                  <!-- Customer Details -->
                  <td>
                    <div class="font-semibold text-sm">{{ order.customer.fullName }}</div>
                    <div class="text-xs text-base-content/60 flex items-center gap-1.5 mt-0.5">
                      <span>{{ order.customer.phone }}</span>
                      &bull;
                      <span class="badge badge-ghost badge-xs font-semibold">
                        {{ order.customer.fulfillmentMethod }}
                      </span>
                    </div>
                  </td>

                  <!-- Items Count -->
                  <td class="text-center font-mono text-xs">
                    <span
                      v-if="order.fulfillmentStatus === 'PENDING_PACKING'"
                      class="badge badge-neutral badge-sm font-mono"
                    >
                      {{ order.itemsCount }} {{ t('admin.orders.badges.pieces') }}
                    </span>
                    <span
                      v-else
                      class="badge badge-sm font-mono"
                      :class="order.fulfilledItemsCount < order.itemsCount ? 'badge-warning' : 'badge-success text-white'"
                    >
                      {{ order.fulfilledItemsCount }} / {{ order.itemsCount }}
                    </span>
                  </td>

                  <!-- Fulfillment Status -->
                  <td>
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
                  </td>

                  <!-- Payment Status & Method -->
                  <td>
                    <div class="text-xs font-semibold">{{ order.paymentProvider }}</div>
                    <span
                      class="badge badge-outline badge-xs mt-0.5"
                      :class="{
                        'badge-warning': order.paymentStatus === 'AUTHORIZED',
                        'badge-success': order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID',
                        'badge-info': order.paymentStatus === 'PARTIALLY_CAPTURED',
                      }"
                    >
                      {{ order.paymentStatus }}
                    </span>
                  </td>

                  <!-- Total Amount -->
                  <td class="text-end font-mono text-sm">
                    <div class="font-bold">
                      {{ formatMoney(order.capturedTotalMinor ?? order.grandTotalMinor, order.currency) }}
                    </div>
                    <div
                      v-if="order.paymentStatus === 'PARTIALLY_CAPTURED'"
                      class="text-[11px] text-base-content/50 line-through"
                    >
                      {{ formatMoney(order.authorizedTotalMinor, order.currency) }}
                    </div>
                  </td>

                  <!-- Created Date -->
                  <td class="text-end font-mono text-xs text-base-content/70">
                    {{ new Date(order.createdAt).toLocaleDateString('sv-SE') }}
                  </td>

                  <!-- Action: Pack CTA -->
                  <td class="text-center">
                    <NuxtLink
                      :to="`/admin/orders/${order.id}/pack`"
                      class="btn btn-sm"
                      :class="order.fulfillmentStatus === 'PENDING_PACKING' ? 'btn-primary text-white' : 'btn-ghost'"
                    >
                      <Icon
                        :name="order.fulfillmentStatus === 'DISPATCHED' ? 'lucide:eye' : 'lucide:box'"
                        class="size-4"
                      />
                      <span>{{ order.fulfillmentStatus === 'DISPATCHED' ? t('admin.orders.actions.view') : t('admin.orders.actions.pack') }}</span>
                    </NuxtLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>