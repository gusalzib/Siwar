<!-- components/admin/orders/pack/OrderPackTable.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LineItemState } from '~/composables/useOrderPacking'

interface Props {
  items: LineItemState[]
  currency: string,
  isReadOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'SEK',
  isReadOnly: false,
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
  <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl overflow-hidden">
    <div class="divide-y divide-slate-200 dark:divide-zinc-700/80">
      <div
        v-for="item in items"
        :key="item.productId"
        class="p-4 sm:p-5 md:p-6 space-y-4 hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 transition-colors duration-150 cursor-pointer"
        :class="{ 'bg-brand-50/20 dark:bg-brand-900/10': item.isPacked, 'opacity-60': item.fulfilledQuantity === 0 }"
        @click="!isReadOnly && item.fulfilledQuantity > 0 ? emit('togglePicked', item) : null"
      >
        <!-- Top: Checkbox, Product Image, Name, SKU, Status -->
        <div class="flex items-start gap-3.5 sm:gap-4">
          <input
            type="checkbox"
            class="checkbox checkbox-md border-2 border-slate-400 dark:border-zinc-500 bg-white dark:bg-zinc-800 checked:bg-brand-600 checked:border-brand-600 shrink-0 mt-1 transition-all shadow-xs cursor-pointer"
            :disabled="item.fulfilledQuantity === 0 || isReadOnly"
            :checked="item.isPacked"
            @click.stop="emit('togglePicked', item)"
          />

          <!-- Product Image to the left of the product name -->
          <div class="size-14 sm:size-16 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="getLocalizedName(item.name)"
              class="size-full object-cover"
              loading="lazy"
            />
            <div v-else class="size-full flex items-center justify-center text-base-content/30">
              <Icon name="lucide:image" class="size-6" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm sm:text-base text-base-content leading-snug">
              {{ getLocalizedName(item.name) }}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span v-if="item.sku" class="text-xs font-mono text-base-content/80 font-medium bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                SKU: {{ item.sku }}
              </span>
              <span v-if="item.discount" class="badge badge-error badge-xs text-white font-black font-mono">
                -{{ item.discount }}%
              </span>
              <span v-if="item.shortageStatus === 'REDUCED'" class="badge badge-warning badge-xs font-bold">
                {{ t('admin.orders.pack.badges.reduced') }}
              </span>
              <span v-else-if="item.shortageStatus === 'REMOVED'" class="badge badge-error badge-xs text-white font-bold">
                {{ t('admin.orders.pack.badges.outOfStock') }}
              </span>
              <span v-else-if="item.shortageStatus === 'SUBSTITUTED'" class="badge badge-info badge-xs text-white font-bold">
                {{ t('admin.orders.pack.badges.substituted') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Middle: Quantity & Price Breakdown Grid -->
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-zinc-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-center text-xs">
          <div>
            <div class="text-base-content/80 font-semibold text-[11px] mb-0.5 uppercase tracking-wider">{{ t('admin.orders.pack.table.ordered') }}</div>
            <div class="font-mono font-bold text-sm text-base-content">{{ item.quantity }} st</div>
          </div>
          <div>
            <div class="text-base-content/80 font-semibold text-[11px] mb-0.5 uppercase tracking-wider">{{ t('admin.orders.pack.table.packed') }}</div>
            <span
              class="font-mono font-black text-sm px-2.5 py-1 rounded-md inline-block"
              :class="{
                'bg-success/20 text-success': item.fulfilledQuantity === item.quantity,
                'bg-warning/25 text-warning-content font-black': item.fulfilledQuantity > 0 && item.fulfilledQuantity < item.quantity,
                'bg-error/20 text-error font-black': item.fulfilledQuantity === 0,
              }"
            >
              {{ item.fulfilledQuantity }} st
            </span>
          </div>
          <div class="hidden sm:block">
            <div class="text-base-content/80 font-semibold text-[11px] mb-0.5 uppercase tracking-wider">{{ t('admin.orders.pack.table.unitPrice') }}</div>
            <div class="font-mono text-sm" :class="item.discount ? 'text-error font-bold' : 'text-base-content'">
              <span v-if="item.discount && item.originalUnitPriceMinor" class="line-through text-xs text-base-content/40 block">
                {{ formatMoney(item.originalUnitPriceMinor, currency) }}
              </span>
              {{ formatMoney(item.unitPriceMinor, currency) }}
            </div>
          </div>
          <div>
            <div class="text-base-content/80 font-semibold text-[11px] mb-0.5 uppercase tracking-wider">{{ t('admin.orders.pack.table.rowTotal') }}</div>
            <div class="font-mono font-bold text-sm" :class="item.discount ? 'text-error' : 'text-base-content'">
              {{ formatMoney(item.unitPriceMinor * item.fulfilledQuantity, currency) }}
            </div>
          </div>
        </div>

        <!-- Bottom: Shortage Action Button -->
        <div class="flex justify-end pt-1" @click.stop>
          <button
            v-if="item.shortageStatus === 'NONE'"
            type="button"
            :disabled="isReadOnly"
            class="btn btn-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-2 border-amber-500/50 gap-1.5 font-bold shadow-xs transition-colors"
            @click.stop="emit('openShortage', item)"
          >
            <Icon name="lucide:alert-circle" class="size-4 text-amber-600 dark:text-amber-400" />
            <span>{{ t('admin.orders.pack.actions.shortage') }}</span>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-2 border-slate-300 dark:border-zinc-600 text-base-content gap-1.5 font-bold shadow-xs transition-colors"
            :title="t('admin.orders.pack.actions.resetLineTooltip')"
            :disabled="isReadOnly"
            @click.stop="emit('resetItem', item)"
          >
            <Icon name="lucide:undo-2" class="size-4" />
            <span>{{ t('admin.orders.pack.actions.resetLine') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>