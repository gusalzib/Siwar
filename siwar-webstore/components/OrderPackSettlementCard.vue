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
  <div class="card bg-base-100 border border-base-200 shadow-sm sticky top-6">
    <div class="card-body p-6 space-y-4">
      <h2 class="card-title text-base font-bold border-b border-base-200 pb-3 flex items-center justify-between">
        <span>{{ t('admin.orders.pack.summary.title') }}</span>
        <Icon name="lucide:credit-card" class="size-5 text-primary" />
      </h2>

      <div class="space-y-2.5 text-sm">
        <div class="flex justify-between">
          <span class="text-base-content/70">{{ t('admin.orders.pack.summary.authorized') }}</span>
          <span class="font-mono font-semibold">
            {{ formatMoney(effectiveAuthorizedTotal, effectiveCurrency) }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-base-content/70">{{ t('admin.orders.pack.summary.fulfilledItems') }}</span>
          <span class="font-mono">
            {{ formatMoney(effectivePricing?.fulfilledItemsTotal ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <div class="flex justify-between">
          <span class="text-base-content/70">{{ t('admin.orders.pack.summary.shippingFee') }}</span>
          <span class="font-mono">
            {{ formatMoney(effectivePricing?.shippingFee ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <div class="divider my-1"></div>

        <div class="flex justify-between text-base font-bold">
          <span>{{ t('admin.orders.pack.summary.actualAmount') }}</span>
          <span class="font-mono text-primary">
            {{ formatMoney(effectivePricing?.grandTotal ?? 0, effectiveCurrency) }}
          </span>
        </div>

        <!-- Warning when substitute exceeds authorized amount -->
        <div
          v-if="(effectivePricing?.grandTotal ?? 0) > effectiveAuthorizedTotal"
          class="p-3 bg-warning/15 border border-warning/40 rounded-xl text-xs space-y-1 text-warning-content"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Icon name="lucide:alert-circle" class="size-4 text-warning" />
            <span>{{ t('admin.orders.pack.summary.exceedsAuthorizedWarningTitle', 'Ersättningsvaran överstiger auktoriserat belopp') }}</span>
          </div>
          <p class="text-[11px] opacity-80 leading-relaxed">
            {{ t('admin.orders.pack.summary.exceedsAuthorizedWarningDesc', { amount: formatMoney(effectiveAuthorizedTotal, effectiveCurrency) }) }}
          </p>
        </div>

        <!-- Released / Refunded Funds Notification -->
        <div
          v-if="(effectivePricing?.releaseAmount ?? 0) > 0"
          class="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs space-y-1"
        >
          <div class="font-bold text-warning-content flex items-center gap-1.5">
            <Icon name="lucide:corner-down-left" class="size-3.5" />
            {{ t('admin.orders.pack.summary.releaseAmount') }}
          </div>
          <div class="font-mono font-bold text-sm text-warning-content">
            {{ formatMoney(effectivePricing?.releaseAmount ?? 0, effectiveCurrency) }}
          </div>
          <p class="text-[11px] text-base-content/70 leading-relaxed">
            {{
              effectivePaymentProvider === 'STRIPE'
                ? t('admin.orders.pack.summary.stripeNote')
                : t('admin.orders.pack.summary.swishNote')
            }}
          </p>
        </div>

        <!-- Statutory Moms Breakdown -->
        <div class="pt-3 border-t border-base-200 space-y-1.5 text-xs text-base-content/60">
          <div class="font-bold text-base-content mb-1">{{ t('admin.orders.pack.summary.momsCalc') }}</div>
          <div class="flex justify-between font-mono">
            <span>{{ t('admin.orders.pack.summary.moms12') }}</span>
            <span>{{ formatMoney(effectivePricing?.moms12Amount ?? 0, effectiveCurrency) }}</span>
          </div>
          <div class="flex justify-between font-mono">
            <span>{{ t('admin.orders.pack.summary.moms25') }}</span>
            <span>{{ formatMoney(effectivePricing?.moms25Amount ?? 0, effectiveCurrency) }}</span>
          </div>
          <div class="flex justify-between font-mono font-semibold text-base-content border-t border-base-200/50 pt-1">
            <span>{{ t('admin.orders.pack.summary.totalMoms') }}</span>
            <span>{{ formatMoney(effectivePricing?.totalMoms ?? 0, effectiveCurrency) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>