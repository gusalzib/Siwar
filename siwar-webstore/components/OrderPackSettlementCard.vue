<!-- components/admin/orders/pack/OrderPackSettlementCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  order?: any
  livePricing?: any
  pricing?: any
  authorizedTotalMinor?: number
  currency?: string
  paymentProvider?: string
}

const props = withDefaults(defineProps<Props>(), {
  currency: 'SEK',
  paymentProvider: 'STRIPE',
})

const { t } = useI18n()

const effectivePricing = computed(() => props.pricing || props.livePricing || props.order?.pricing)
const effectiveAuthorizedTotal = computed(() => {
  if (typeof props.authorizedTotalMinor === 'number') return props.authorizedTotalMinor
  if (props.order?.pricing?.authorizedTotalMinor) return props.order.pricing.authorizedTotalMinor
  return 0
})
const effectiveCurrency = computed(() => props.order?.currency || props.currency || 'SEK')
const effectivePaymentProvider = computed(() => props.order?.paymentProvider || props.paymentProvider || 'STRIPE')

function formatMoney(amountMinor?: number, currency = effectiveCurrency.value) {
  const value = typeof amountMinor === 'number' && !isNaN(amountMinor) ? amountMinor : 0
  return `${(value / 100).toFixed(2)} ${currency}`
}
</script>

<template>
  <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm sticky top-6 rounded-2xl">
    <div class="card-body p-6 space-y-4">
      <h2 class="card-title text-base font-bold border-b-2 border-slate-200 dark:border-zinc-700 pb-3 flex items-center justify-between text-base-content">
        <span>{{ t('admin.orders.pack.summary.title') }}</span>
        <Icon name="lucide:credit-card" class="size-5 text-primary" />
      </h2>

      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-base-content/85 font-medium">{{ t('admin.orders.pack.summary.authorized') }}</span>
          <span class="font-mono font-bold text-base-content">
            {{ formatMoney(effectiveAuthorizedTotal, effectiveCurrency) }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-base-content/85 font-medium">{{ t('admin.orders.pack.summary.fulfilledItems') }}</span>
          <span class="font-mono font-semibold text-base-content">
            {{ formatMoney(effectivePricing?.fulfilledItemsTotal ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-base-content/85 font-medium">{{ t('admin.orders.pack.summary.shippingFee') }}</span>
          <span class="font-mono font-semibold text-base-content">
            {{ formatMoney(effectivePricing?.shippingFee ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <div class="border-t-2 border-slate-200 dark:border-zinc-700 my-2"></div>

        <div class="flex justify-between text-base font-bold text-base-content">
          <span>{{ t('admin.orders.pack.summary.actualAmount') }}</span>
          <span class="font-mono text-primary font-black text-lg">
            {{ formatMoney(effectivePricing?.grandTotal ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <!-- Warning when substitute exceeds authorized amount -->
        <div
          v-if="(effectivePricing?.grandTotal ?? 0) > effectiveAuthorizedTotal"
          class="p-3 bg-warning/15 border-2 border-warning/50 rounded-xl text-xs space-y-1 text-warning-content font-medium"
        >
          <div class="font-bold flex items-center gap-1.5 text-warning-content">
            <Icon name="lucide:alert-circle" class="size-4 text-warning" />
            <span>{{ t('admin.orders.pack.summary.exceedsAuthorizedWarningTitle', 'Ersättningsvaran överstiger auktoriserat belopp') }}</span>
          </div>
          <p class="text-[11px] leading-relaxed">
            {{ t('admin.orders.pack.summary.exceedsAuthorizedWarningDesc', { amount: formatMoney(effectiveAuthorizedTotal, effectiveCurrency) }) }}
          </p>
        </div>

        <!-- Released / Refunded Funds Notification -->
        <div
          v-if="(effectivePricing?.releaseAmount ?? 0) > 0"
          class="p-3 bg-amber-500/10 dark:bg-amber-950/40 border-2 border-amber-500/30 dark:border-amber-700/50 rounded-xl text-xs space-y-1"
        >
          <div class="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <Icon name="lucide:corner-down-left" class="size-3.5" />
            {{ t('admin.orders.pack.summary.releaseAmount') }}
          </div>
          <div class="font-mono font-black text-sm text-amber-900 dark:text-amber-200">
            {{ formatMoney(effectivePricing?.releaseAmount ?? 0, effectiveCurrency) }}
          </div>
          <p class="text-[11px] text-base-content/80 leading-relaxed font-medium">
            {{
              effectivePaymentProvider === 'STRIPE'
                ? t('admin.orders.pack.summary.stripeNote')
                : t('admin.orders.pack.summary.swishNote')
            }}
          </p>
        </div>

        <!-- Statutory Moms Breakdown -->
        <div class="pt-3 border-t-2 border-slate-200 dark:border-zinc-700 space-y-1.5 text-xs text-base-content/80 font-medium">
          <div class="font-bold text-base-content mb-1 text-xs uppercase tracking-wider">{{ t('admin.orders.pack.summary.momsCalc') }}</div>
          <div class="flex justify-between font-mono">
            <span>{{ t('admin.orders.pack.summary.moms12') }}</span>
            <span class="font-semibold">{{ formatMoney(effectivePricing?.moms12Amount ?? 0, effectiveCurrency) }}</span>
          </div>
          <div class="flex justify-between font-mono">
            <span>{{ t('admin.orders.pack.summary.moms25') }}</span>
            <span class="font-semibold">{{ formatMoney(effectivePricing?.moms25Amount ?? 0, effectiveCurrency) }}</span>
          </div>
          <div class="flex justify-between font-mono font-bold text-base-content border-t border-slate-200 dark:border-zinc-700 pt-1">
            <span>{{ t('admin.orders.pack.summary.totalMoms') }}</span>
            <span class="font-black">{{ formatMoney(effectivePricing?.totalMoms ?? 0, effectiveCurrency) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>