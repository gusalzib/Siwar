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
  <div class="min-h-screen bg-slate-100/90 dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 text-base-content">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header & Stats Summary -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-base-content">
            {{ t('admin.orders.title', 'Orderhantering') }}
          </h1>
          <p class="text-sm text-base-content/80 mt-1 font-medium">
            {{ t('admin.orders.subtitle', 'Packa ordrar, hantera varubrist och granska betalningar') }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="stats shadow-sm bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl">
            <div class="stat py-2.5 px-5">
              <div class="stat-title text-xs font-bold uppercase tracking-wider text-base-content/80">{{ t('admin.orders.stats.pendingPacking') }}</div>
              <div class="stat-value text-2xl font-black text-amber-600 dark:text-amber-400">{{ pendingPackingCount }}</div>
            </div>
            <div class="stat py-2.5 px-5 border-l-2 border-slate-200 dark:border-zinc-700/80">
              <div class="stat-title text-xs font-bold uppercase tracking-wider text-base-content/80">{{ t('admin.orders.stats.dispatched') }}</div>
              <div class="stat-value text-2xl font-black text-success">{{ dispatchedCount }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl">
        <div class="card-body p-4 sm:p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <!-- Search -->
            <div class="form-control">
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="t('admin.orders.filters.searchPlaceholder')"
                  class="input w-full pl-9 h-10 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs"
                />
                <Icon
                  name="lucide:search"
                  class="absolute left-3 top-3 size-4 text-base-content/60"
                />
              </div>
            </div>

            <!-- Fulfillment Status Filter -->
            <div class="form-control">
              <select v-model="selectedFulfillmentStatus" class="select w-full h-10 min-h-[40px] px-3.5 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs font-medium">
                <option value="all">{{ t('admin.orders.filters.allFulfillmentStatuses') }}</option>
                <option value="PENDING_PACKING">{{ t('admin.orders.filters.pendingPacking') }}</option>
                <option value="PACKED">{{ t('admin.orders.filters.packed') }}</option>
                <option value="DISPATCHED">{{ t('admin.orders.filters.dispatched') }}</option>
                <option value="CANCELLED">{{ t('admin.orders.filters.cancelled') }}</option>
              </select>
            </div>

            <!-- Payment Status Filter -->
            <div class="form-control">
              <select v-model="selectedPaymentStatus" class="select w-full h-10 min-h-[40px] px-3.5 border-2 border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-base-content rounded-xl focus:border-brand-500 text-sm shadow-xs font-medium">
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
                class="btn btn-ghost btn-sm text-xs font-bold gap-1.5 text-base-content/80 hover:text-base-content"
                @click="resetFilters"
              >
                <Icon name="lucide:rotate-ccw" class="size-3.5" />
                {{ t('admin.orders.filters.resetFilters') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Orders Data Table & Mobile Cards -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl overflow-hidden">
        <!-- 1. MOBILE & TABLET VIEW (< md: 768px): Responsive Order Cards -->
        <div class="block lg:hidden divide-y divide-slate-200 dark:divide-zinc-700/80">
          <!-- Loading -->
          <div v-if="isLoading" class="text-center py-16">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>

          <!-- Empty State -->
          <div v-else-if="!orders || orders.length === 0" class="text-center py-16 text-base-content/70">
            <Icon name="lucide:inbox" class="size-10 mx-auto mb-2 opacity-50" />
            <p class="font-bold text-sm">{{ t('admin.orders.emptyState') }}</p>
          </div>

          <!-- Order Cards -->
          <div
            v-for="order in orders"
            :key="order.id"
            class="p-5 sm:p-6 space-y-4 hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 transition-colors duration-150"
          >
            <!-- Top: Order Reference, Customer, Badges & Date -->
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-mono font-bold text-base text-base-content">
                    {{ order.orderReference }}
                  </span>
                  <span
                    v-if="order.shortagesCount > 0"
                    class="badge badge-warning badge-xs font-bold"
                    :title="t('admin.orders.badges.hasShortages')"
                  >
                    {{ t('admin.orders.badges.shortage') }} ({{ order.shortagesCount }})
                  </span>
                </div>
                <div class="font-bold text-sm text-base-content mt-1 truncate">
                  {{ order.customer.fullName }}
                </div>
                <div class="text-xs text-base-content/80 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="font-mono">{{ order.customer.phone }}</span>
                  <span>&bull;</span>
                  <span class="badge badge-ghost badge-xs font-semibold border-slate-300 dark:border-zinc-600">
                    {{ order.customer.fulfillmentMethod }}
                  </span>
                </div>
              </div>

              <!-- Fulfillment Badge & Date -->
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span
                  class="badge badge-sm font-bold"
                  :class="{
                    'badge-warning': order.fulfillmentStatus === 'PENDING_PACKING',
                    'badge-info text-white': order.fulfillmentStatus === 'PACKED',
                    'badge-success text-white': order.fulfillmentStatus === 'DISPATCHED',
                    'badge-error text-white': order.fulfillmentStatus === 'CANCELLED',
                  }"
                >
                  {{ order.fulfillmentStatus }}
                </span>
                <span class="font-mono text-xs text-base-content/70 font-medium">
                  {{ new Date(order.createdAt).toLocaleDateString('sv-SE') }}
                </span>
              </div>
            </div>

            <!-- Middle: Items, Payment & Total Grid (OrderPackTable style) -->
            <div class="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-zinc-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-center text-xs">
              <!-- Items Column -->
              <div>
                <div class="text-base-content/80 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                  {{ t('admin.orders.table.items') }}
                </div>
                <div>
                  <span
                    v-if="order.fulfillmentStatus === 'PENDING_PACKING'"
                    class="badge badge-neutral badge-xs sm:badge-sm font-mono font-bold"
                  >
                    {{ order.itemsCount }} {{ t('admin.orders.badges.pieces') }}
                  </span>
                  <span
                    v-else
                    class="badge badge-xs sm:badge-sm font-mono font-bold"
                    :class="order.fulfilledItemsCount < order.itemsCount ? 'badge-warning font-black' : 'badge-success text-white'"
                  >
                    {{ order.fulfilledItemsCount }} / {{ order.itemsCount }}
                  </span>
                </div>
              </div>

              <!-- Payment Column -->
              <div>
                <div class="text-base-content/80 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                  {{ t('admin.orders.table.payment') }}
                </div>
                <div class="truncate">
                  <span
                    class="badge badge-outline badge-xs font-bold border-slate-400 dark:border-zinc-500"
                    :class="{
                      'badge-warning': order.paymentStatus === 'AUTHORIZED',
                      'badge-success': order.paymentStatus === 'CAPTURED' || order.paymentStatus === 'PAID',
                      'badge-info': order.paymentStatus === 'PARTIALLY_CAPTURED',
                    }"
                  >
                    {{ order.paymentStatus }}
                  </span>
                </div>
              </div>

              <!-- Amount Column -->
              <div>
                <div class="text-base-content/80 font-semibold text-[11px] mb-1 uppercase tracking-wider">
                  {{ t('admin.orders.table.amount') }}
                </div>
                <div class="font-mono font-black text-xs sm:text-sm text-base-content">
                  {{ formatMoney(order.capturedTotalMinor ?? order.grandTotalMinor, order.currency) }}
                </div>
                <div
                  v-if="order.paymentStatus === 'PARTIALLY_CAPTURED'"
                  class="text-[10px] text-base-content/60 font-semibold line-through"
                >
                  {{ formatMoney(order.authorizedTotalMinor, order.currency) }}
                </div>
              </div>
            </div>

            <!-- Bottom: Action Button -->
            <div class="flex justify-end pt-1">
              <NuxtLink
                :to="`/admin/orders/${order.id}/pack`"
                class="btn btn-sm w-full sm:w-auto px-5 font-bold shadow-xs gap-1.5"
                :class="order.fulfillmentStatus === 'PENDING_PACKING' ? 'bg-brand-600 hover:bg-brand-700 text-white border-transparent' : 'btn-ghost border-2 border-slate-300 dark:border-zinc-600 text-base-content'"
              >
                <Icon
                  :name="order.fulfillmentStatus === 'DISPATCHED' ? 'lucide:eye' : 'lucide:box'"
                  class="size-4"
                />
                <span>{{ order.fulfillmentStatus === 'DISPATCHED' ? t('admin.orders.actions.view') : t('admin.orders.actions.pack') }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- 2. DESKTOP VIEW (≥ md: 768px): Spacious Table -->
        <div class="hidden lg:block overflow-x-auto">
          <table class="table w-full border-collapse">
            <thead>
              <tr class="bg-slate-100/90 dark:bg-zinc-800/90 border-b-2 border-slate-200 dark:border-zinc-700 text-xs font-bold text-base-content uppercase tracking-wider">
                <th class="py-4 px-5">{{ t('admin.orders.table.reference') }}</th>
                <th class="py-4 px-5">{{ t('admin.orders.table.customer') }}</th>
                <th class="text-center py-4 px-4">{{ t('admin.orders.table.items') }}</th>
                <th class="py-4 px-5">{{ t('admin.orders.table.fulfillmentStatus') }}</th>
                <th class="py-4 px-5">{{ t('admin.orders.table.payment') }}</th>
                <th class="text-end py-4 px-5">{{ t('admin.orders.table.amount') }}</th>
                <th class="text-end py-4 px-5">{{ t('admin.orders.table.date') }}</th>
                <th class="text-center py-4 px-5">{{ t('admin.orders.table.action') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-zinc-700/80">
              <!-- Loading -->
              <tr v-if="isLoading">
                <td colspan="8" class="text-center py-16">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="!orders || orders.length === 0">
                <td colspan="8" class="text-center py-16 text-base-content/70">
                  <Icon name="lucide:inbox" class="size-10 mx-auto mb-2 opacity-50" />
                  <p class="font-bold text-sm">{{ t('admin.orders.emptyState') }}</p>
                </td>
              </tr>

              <!-- Orders Rows -->
              <tr
                v-for="order in orders"
                :key="order.id"
                class="hover:bg-brand-50/70 dark:hover:bg-zinc-800/80 transition-colors duration-150"
              >
                <!-- Order Reference -->
                <td class="py-4 px-5 font-mono font-bold text-sm text-base-content">
                  {{ order.orderReference }}
                  <span
                    v-if="order.shortagesCount > 0"
                    class="badge badge-warning badge-xs ml-1 font-bold"
                    :title="t('admin.orders.badges.hasShortages')"
                  >
                    {{ t('admin.orders.badges.shortage') }} ({{ order.shortagesCount }})
                  </span>
                </td>

                <!-- Customer Details -->
                <td class="py-4 px-5">
                  <div class="font-bold text-sm text-base-content">{{ order.customer.fullName }}</div>
                  <div class="text-xs text-base-content/80 font-medium flex items-center gap-1.5 mt-0.5">
                    <span class="font-mono">{{ order.customer.phone }}</span>
                    &bull;
                    <span class="badge badge-ghost badge-xs font-semibold border-slate-300 dark:border-zinc-600">
                      {{ order.customer.fulfillmentMethod }}
                    </span>
                  </div>
                </td>

                <!-- Items Count -->
                <td class="text-center py-4 px-4 font-mono text-xs">
                  <span
                    v-if="order.fulfillmentStatus === 'PENDING_PACKING'"
                    class="badge badge-neutral badge-sm font-mono font-bold"
                  >
                    {{ order.itemsCount }} {{ t('admin.orders.badges.pieces') }}
                  </span>
                  <span
                    v-else
                    class="badge badge-sm font-mono font-bold"
                    :class="order.fulfilledItemsCount < order.itemsCount ? 'badge-warning font-black' : 'badge-success text-white'"
                  >
                    {{ order.fulfilledItemsCount }} / {{ order.itemsCount }}
                  </span>
                </td>

                <!-- Fulfillment Status -->
                <td class="py-4 px-5">
                  <span
                    class="badge badge-sm font-bold"
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
                <td class="py-4 px-5">
                  <div class="text-xs font-bold text-base-content">{{ order.paymentProvider }}</div>
                  <span
                    class="badge badge-outline badge-xs mt-0.5 font-bold border-slate-400 dark:border-zinc-500"
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
                <td class="text-end py-4 px-5 font-mono text-sm">
                  <div class="font-black text-base text-base-content">
                    {{ formatMoney(order.capturedTotalMinor ?? order.grandTotalMinor, order.currency) }}
                  </div>
                  <div
                    v-if="order.paymentStatus === 'PARTIALLY_CAPTURED'"
                    class="text-[11px] text-base-content/60 font-semibold line-through"
                  >
                    {{ formatMoney(order.authorizedTotalMinor, order.currency) }}
                  </div>
                </td>

                <!-- Created Date -->
                <td class="text-end py-4 px-5 font-mono text-xs text-base-content/80 font-medium">
                  {{ new Date(order.createdAt).toLocaleDateString('sv-SE') }}
                </td>

                <!-- Action: Pack CTA -->
                <td class="text-center py-4 px-5">
                  <NuxtLink
                    :to="`/admin/orders/${order.id}/pack`"
                    class="btn btn-sm px-4 font-bold shadow-xs gap-1.5"
                    :class="order.fulfillmentStatus === 'PENDING_PACKING' ? 'bg-brand-600 hover:bg-brand-700 text-white border-transparent' : 'btn-ghost border border-slate-300 dark:border-zinc-600 text-base-content'"
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
</template>