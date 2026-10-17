<!-- components/OrderPackAuditTrail.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IShortageAdjustment } from '~/server/models/Order'

interface Props {
  adjustments?: IShortageAdjustment[]
  currency?: string
}

const props = withDefaults(defineProps<Props>(), {
  adjustments: () => [],
  currency: 'SEK',
})

const { t, locale } = useI18n()

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatMoney(amountMinor?: number) {
  if (typeof amountMinor !== 'number' || isNaN(amountMinor)) return `0.00 ${props.currency}`
  return `${(amountMinor / 100).toFixed(2)} ${props.currency}`
}

function getLocalizedName(nameObj?: { ar?: string; sv?: string; en?: string }) {
  if (!nameObj) return ''
  const current = locale.value as 'ar' | 'sv' | 'en'
  return nameObj[current] || nameObj.sv || nameObj.en || nameObj.ar || ''
}
</script>

<template>
  <div v-if="adjustments && adjustments.length > 0" class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm rounded-2xl overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b-2 border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/80">
      <div class="flex items-center gap-2">
        <Icon name="lucide:history" class="size-4 text-primary" />
        <h3 class="text-sm font-bold text-base-content">
          {{ t('admin.orders.pack.history.title') }}
        </h3>
      </div>
      <span class="badge badge-sm badge-neutral font-mono font-bold">
        {{ adjustments.length }} {{ adjustments.length === 1 ? t('admin.orders.pack.history.event') : t('admin.orders.pack.history.events') }}
      </span>
    </div>

    <!-- Timeline List -->
    <div class="divide-y divide-slate-200 dark:divide-zinc-700/80">
      <div
        v-for="(adj, idx) in adjustments"
        :key="idx"
        class="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors space-y-3"
      >
        <!-- Top Row: Action Badge, PerformedBy, Timestamp -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <!-- Badge color based on action -->
            <span
              class="badge badge-sm font-bold"
              :class="{
                'badge-error text-white': adj.action === 'REMOVE_LINE',
                'badge-warning': adj.action === 'REDUCE_QUANTITY',
                'badge-info text-white': adj.action === 'SUBSTITUTE_ITEM',
              }"
            >
              {{
                adj.action === 'REMOVE_LINE'
                  ? t('admin.orders.pack.history.actions.removeLine')
                  : adj.action === 'REDUCE_QUANTITY'
                    ? t('admin.orders.pack.history.actions.reduceQuantity')
                    : t('admin.orders.pack.history.actions.substituteItem')
              }}
            </span>

            <!-- Performed By User / Staff -->
            <div class="flex items-center gap-1.5 text-xs text-base-content font-medium bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
              <Icon name="lucide:user-check" class="size-3.5 text-base-content/70" />
              <span>{{ adj.performedBy || 'Admin' }}</span>
            </div>
          </div>

          <!-- Timestamp -->
          <div class="text-[11px] font-mono text-base-content/80 font-medium flex items-center gap-1">
            <Icon name="lucide:clock" class="size-3" />
            <ClientOnly>
              <span>{{ formatDate(adj.timestamp) }}</span>
              <template #fallback>
                <span>{{ formatDate(adj.timestamp) }}</span>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Middle Row: Product & Quantities Comparison -->
        <div class="bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3.5 text-xs space-y-2 border border-slate-200 dark:border-zinc-700">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <!-- Original Item Identity -->
            <div class="space-y-0.5">
              <div class="font-bold text-sm text-base-content">
                {{ getLocalizedName(adj.originalName) || t('admin.orders.pack.history.originalProduct') }}
              </div>
              <div class="flex items-center gap-2 text-[11px] text-base-content/80 font-mono font-medium">
                <span v-if="adj.originalSku">SKU: {{ adj.originalSku }}</span>
                <span>{{ t('admin.orders.pack.history.unitPrice') }}: {{ formatMoney(adj.originalUnitPriceMinor) }}</span>
                <span v-if="adj.originalMomsRate">{{ t('admin.orders.pack.history.moms') }}: {{ adj.originalMomsRate }}%</span>
              </div>
            </div>

            <!-- Quantity Transformation -->
            <div class="flex items-center gap-2 font-mono font-bold shrink-0 self-start sm:self-center">
              <span class="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 text-base-content">
                {{ adj.originalQuantity }} {{ t('admin.orders.pack.history.pieces') }}
              </span>
              <Icon name="lucide:arrow-right" class="size-3.5 text-base-content/50" />
              <span
                class="px-2.5 py-1 rounded"
                :class="{
                  'bg-error/20 text-error font-black': adj.adjustedQuantity === 0,
                  'bg-warning/25 text-warning-content font-black': adj.adjustedQuantity > 0,
                }"
              >
                {{ adj.adjustedQuantity }} {{ t('admin.orders.pack.history.pieces') }}
              </span>
            </div>
          </div>

          <!-- If Substitution: Show the replacement product details -->
          <div
            v-if="adj.action === 'SUBSTITUTE_ITEM'"
            class="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-1 text-[11px] text-info-content bg-info/15 border border-info/30 p-2.5 rounded-lg"
          >
            <div class="flex items-center gap-1.5 font-bold">
              <Icon name="lucide:repeat" class="size-3.5 text-info" />
              <span>{{ t('admin.orders.pack.history.substitutedWithSku') }}: <span class="font-mono font-black">{{ adj.substitutedSku || 'N/A' }}</span></span>
            </div>
            <div v-if="adj.substitutedUnitPriceMinor" class="font-mono font-bold">
              {{ t('admin.orders.pack.history.newUnitPrice') }}: {{ formatMoney(adj.substitutedUnitPriceMinor) }}
            </div>
          </div>
        </div>

        <!-- Bottom Row: Staff Note -->
        <div v-if="adj.note" class="text-xs bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Icon name="lucide:message-square" class="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div class="space-y-0.5">
            <span class="font-bold text-[11px] uppercase tracking-wider block opacity-85">
              {{ t('admin.orders.pack.history.noteLabel') }}:
            </span>
            <p class="italic text-[12px] leading-relaxed">"{{ adj.note }}"</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>