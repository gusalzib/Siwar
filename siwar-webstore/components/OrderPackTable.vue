<!-- components/admin/orders/pack/OrderPackTable.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LineItemState } from '~/composables/useOrderPacking'

interface Props {
  items: LineItemState[]
  currency: string
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'SEK',
})

const emit = defineEmits<{
  (e: 'togglePicked', item: LineItemState): void
  (e: 'openShortage', item: LineItemState): void
  (e: 'resetItem', item: LineItemState): void
}>()

const { t, locale } = useI18n()

function formatMoney(amountMinor: number, currency = props.currency) {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function getLocalizedName(nameObj?: { ar?: string; sv?: string; en?: string }) {
  if (!nameObj) return ''
  const current = locale.value as 'ar' | 'sv' | 'en'
  return nameObj[current] || nameObj.sv || nameObj.en || nameObj.ar || ''
}
</script>

<template>
  <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
    <!-- 1. MOBILE & TABLET VIEW (< md: 768px): Responsive Packing Cards -->
    <div class="block md:hidden divide-y divide-base-200">
      <div
        v-for="item in items"
        :key="item.productId"
        class="p-4 space-y-3 transition-colors"
        :class="{ 'bg-base-200/40': item.isPacked, 'opacity-60': item.fulfilledQuantity === 0 }"
      >
        <!-- Top: Checkbox, Name, SKU, Status -->
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            class="checkbox checkbox-md border-2 border-base-content/40 bg-base-100 checked:bg-brand-600 checked:border-brand-600 shrink-0 mt-0.5"
            :disabled="item.fulfilledQuantity === 0"
            :checked="item.isPacked"
            @click.stop="emit('togglePicked', item)"
          />

          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-base-content leading-snug">
              {{ getLocalizedName(item.name) }}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 mt-1">
              <span v-if="item.sku" class="text-xs font-mono text-base-content/60">
                SKU: {{ item.sku }}
              </span>
              <span v-if="item.shortageStatus === 'REDUCED'" class="badge badge-warning badge-xs font-semibold">
                {{ t('admin.orders.pack.badges.reduced') }}
              </span>
              <span v-else-if="item.shortageStatus === 'REMOVED'" class="badge badge-error badge-xs text-white font-semibold">
                {{ t('admin.orders.pack.badges.outOfStock') }}
              </span>
              <span v-else-if="item.shortageStatus === 'SUBSTITUTED'" class="badge badge-info badge-xs text-white font-semibold">
                {{ t('admin.orders.pack.badges.substituted') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Middle: Quantity & Price Breakdown Grid -->
        <div class="grid grid-cols-3 gap-2 bg-base-200/50 p-2.5 rounded-xl text-center text-xs">
          <div>
            <div class="text-base-content/60 text-[11px] mb-0.5">{{ t('admin.orders.pack.table.ordered') }}</div>
            <div class="font-mono font-bold text-sm text-base-content">{{ item.quantity }} st</div>
          </div>
          <div>
            <div class="text-base-content/60 text-[11px] mb-0.5">{{ t('admin.orders.pack.table.packed') }}</div>
            <span
              class="font-mono font-black text-sm px-2 py-0.5 rounded"
              :class="{
                'bg-success/20 text-success': item.fulfilledQuantity === item.quantity,
                'bg-warning/20 text-warning-content': item.fulfilledQuantity > 0 && item.fulfilledQuantity < item.quantity,
                'bg-error/20 text-error': item.fulfilledQuantity === 0,
              }"
            >
              {{ item.fulfilledQuantity }} st
            </span>
          </div>
          <div>
            <div class="text-base-content/60 text-[11px] mb-0.5">{{ t('admin.orders.pack.table.rowTotal') }}</div>
            <div class="font-mono font-bold text-sm text-base-content">
              {{ formatMoney(item.unitPriceMinor * item.fulfilledQuantity, currency) }}
            </div>
          </div>
        </div>

        <!-- Bottom: Shortage Action Button -->
        <div class="flex justify-end pt-1">
          <button
            v-if="item.shortageStatus === 'NONE'"
            type="button"
            class="btn btn-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 gap-1.5 font-bold shadow-xs transition-colors"
            @click="emit('openShortage', item)"
          >
            <Icon name="lucide:alert-circle" class="size-4 text-amber-600 dark:text-amber-400" />
            <span>{{ t('admin.orders.pack.actions.shortage') }}</span>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-outline border-base-300 hover:bg-base-200 text-base-content gap-1.5 font-semibold"
            @click="emit('resetItem', item)"
          >
            <Icon name="lucide:undo-2" class="size-4" />
            <span>{{ t('admin.orders.pack.actions.resetLine') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. DESKTOP VIEW (≥ md: 768px): Spacious Table -->
    <div class="hidden md:block overflow-x-auto">
      <table class="table table-zebra w-full border-collapse">
        <thead>
          <tr class="bg-base-200/70 border-b border-base-200 text-xs font-bold text-base-content/70">
            <th class="w-14 text-center py-4 px-3">Packad</th>
            <th class="py-4 px-4">{{ t('admin.orders.pack.table.product') }}</th>
            <th class="text-center py-4 px-3">{{ t('admin.orders.pack.table.ordered') }}</th>
            <th class="text-center py-4 px-3">{{ t('admin.orders.pack.table.packed') }}</th>
            <th class="text-end py-4 px-4">{{ t('admin.orders.pack.table.unitPrice') }}</th>
            <th class="text-end py-4 px-4">{{ t('admin.orders.pack.table.rowTotal') }}</th>
            <th class="text-center py-4 px-4">{{ t('admin.orders.pack.table.action') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-base-200">
          <tr v-for="item in items" :key="item.productId" class="hover transition-colors">
            <!-- Checkbox -->
            <td class="w-14 text-center py-4 px-3">
              <input
                type="checkbox"
                class="checkbox checkbox-sm border-2 border-base-content/40 bg-base-100 checked:bg-brand-600 checked:border-brand-600 transition-colors"
                :disabled="item.fulfilledQuantity === 0"
                :checked="item.isPacked"
                @click.stop="emit('togglePicked', item)"
              />
            </td>

            <!-- Product Title & SKU -->
            <td class="py-4 px-4 min-w-[200px]">
              <div class="font-bold text-sm text-base-content">
                {{ getLocalizedName(item.name) }}
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span v-if="item.sku" class="text-xs font-mono text-base-content/60">
                  SKU: {{ item.sku }}
                </span>
                <span v-if="item.shortageStatus === 'REDUCED'" class="badge badge-warning badge-xs font-semibold">
                  {{ t('admin.orders.pack.badges.reduced') }}
                </span>
                <span v-else-if="item.shortageStatus === 'REMOVED'" class="badge badge-error badge-xs text-white font-semibold">
                  {{ t('admin.orders.pack.badges.outOfStock') }}
                </span>
                <span v-else-if="item.shortageStatus === 'SUBSTITUTED'" class="badge badge-info badge-xs text-white font-semibold">
                  {{ t('admin.orders.pack.badges.substituted') }}
                </span>
              </div>
            </td>

            <!-- Ordered Quantity -->
            <td class="text-center font-mono font-bold text-sm text-base-content py-4 px-3">
              {{ item.quantity }}
            </td>

            <!-- Fulfilled Quantity -->
            <td class="text-center py-4 px-3">
              <span
                class="font-mono font-bold px-2.5 py-1 rounded-md text-sm inline-block min-w-[36px]"
                :class="{
                  'bg-success/20 text-success': item.fulfilledQuantity === item.quantity,
                  'bg-warning/20 text-warning-content': item.fulfilledQuantity > 0 && item.fulfilledQuantity < item.quantity,
                  'bg-error/20 text-error': item.fulfilledQuantity === 0,
                }"
              >
                {{ item.fulfilledQuantity }}
              </span>
            </td>

            <!-- Unit Price -->
            <td class="text-end font-mono text-sm text-base-content/70 py-4 px-4 whitespace-nowrap">
              {{ formatMoney(item.unitPriceMinor, currency) }}
            </td>

            <!-- Row Total -->
            <td class="text-end font-mono font-bold text-sm text-base-content py-4 px-4 whitespace-nowrap">
              {{ formatMoney(item.unitPriceMinor * item.fulfilledQuantity, currency) }}
            </td>

            <!-- Shortage Button -->
            <td class="text-center py-4 px-4 whitespace-nowrap">
              <button
                v-if="item.shortageStatus === 'NONE'"
                type="button"
                class="btn btn-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 gap-1 font-bold shadow-xs transition-colors"
                @click="emit('openShortage', item)"
              >
                <Icon name="lucide:alert-circle" class="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>{{ t('admin.orders.pack.actions.shortage') }}</span>
              </button>
              <button
                v-else
                type="button"
                class="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content gap-1 font-semibold"
                :title="t('admin.orders.pack.actions.resetLineTooltip')"
                @click="emit('resetItem', item)"
              >
                <Icon name="lucide:undo-2" class="size-3.5" />
                <span>{{ t('admin.orders.pack.actions.resetLine') }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>