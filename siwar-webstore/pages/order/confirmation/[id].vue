<!-- pages/order/confirmation/[id].vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t, locale } = useI18n()
const orderId = route.params.id as string

const { data: order, pending, error } = await useFetch<any>(`/api/orders/${orderId}`)

function formatMoney(amountMinor: number, currency = 'SEK') {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function printReceipt() {
  window.print()
}

function getLocalizedName(nameObj?: { ar: string; sv: string; en: string }) {
  if (!nameObj) return ''
  const cur = locale.value as 'ar' | 'sv' | 'en'
  return nameObj[cur] || nameObj.sv || nameObj.en || nameObj.ar || ''
}

const totalDiscountSavings = computed(() => {
  if (!order.value?.items) return 0
  return order.value.items.reduce((acc: number, it: any) => {
    const orig = it.originalUnitPriceMinor || it.unitPriceMinor
    const diff = orig - it.unitPriceMinor
    const q = it.fulfilledQuantity ?? it.quantity
    return acc + (diff > 0 ? diff * q : 0)
  }, 0)
})
</script>

<template>
  <div class="min-h-screen bg-base-100 py-8 px-4 sm:px-6 lg:px-8">
    <div v-if="pending" class="flex justify-center p-16">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else-if="error || !order" class="max-w-xl mx-auto alert alert-error text-white">
      <Icon name="lucide:alert-circle" class="size-5" />
      <span>{{ error?.statusMessage || t('order.notFound', 'Ordern hittades inte.') }}</span>
    </div>

    <div v-else class="max-w-3xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-full">
      <!-- Screen-Only Actions -->
      <div class="flex items-center justify-between no-print">
        <NuxtLink to="/" class="btn btn-ghost btn-sm gap-2">
          <Icon name="lucide:arrow-left" class="size-4" />
          <span>{{ t('order.backToHome', 'Tillbaka till butiken') }}</span>
        </NuxtLink>
        <button type="button" class="btn btn-primary btn-sm text-white gap-2" @click="printReceipt">
          <Icon name="lucide:printer" class="size-4" />
          <span>{{ t('order.printReceipt', 'Skriv ut kvitto') }}</span>
        </button>
      </div>

      <!-- Receipt Container (Auditable & Printable) -->
      <div class="receipt-card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0">
        <!-- Store Header & Order Reference -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 pb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-base-content">SIWAR</h1>
            <p class="text-xs text-base-content/60 font-mono mt-0.5">Org.nr: 559123-4567 | momsreg: SE559123456701</p>
            <p class="text-xs text-base-content/60">Storgatan 12, 302 43 Halmstad</p>
          </div>
          <div class="sm:text-right">
            <span class="badge badge-success text-white font-mono font-bold text-xs">
              {{ order.paymentStatus }}
            </span>
            <div class="text-xl font-bold font-mono text-base-content mt-1">{{ order.orderReference }}</div>
            <div class="text-xs text-base-content/60 font-mono">
              {{ new Date(order.createdAt).toLocaleString('sv-SE') }}
            </div>
          </div>
        </div>

        <!-- Customer & Delivery Meta -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-base-content/50">Kund</span>
            <div class="font-bold text-base-content mt-1">{{ order.customer.fullName }}</div>
            <div class="text-base-content/70 text-xs">{{ order.customer.email }}</div>
            <div class="text-base-content/70 text-xs font-mono">{{ order.customer.phone }}</div>
          </div>
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-base-content/50">Leverans</span>
            <div class="font-semibold text-base-content mt-1">
              {{ order.customer.fulfillmentMethod === 'DELIVERY' ? 'Hemleverans / Ombud' : 'Hämta i butik' }}
            </div>
            <div v-if="order.customer.fulfillmentMethod === 'DELIVERY' && order.customer.address" class="text-xs text-base-content/70">
              <div>{{ order.customer.address.street }}</div>
              <div class="font-mono">{{ order.customer.address.postalCode }} {{ order.customer.address.city }}</div>
            </div>
            <div v-else class="text-xs text-base-content/60">
              Hämtas personligen i butik (Halmstad)
            </div>
          </div>
        </div>

        <!-- Immutable Line Items Table -->
        <div class="overflow-x-auto">
          <table class="table w-full text-sm">
            <thead>
              <tr class="border-b border-base-200 text-xs text-base-content/60">
                <th>Artikel</th>
                <th class="text-center">Moms</th>
                <th class="text-center">Antal</th>
                <th class="text-end">A-pris</th>
                <th class="text-end">Belopp</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-base-200/60 font-mono text-xs">
              <tr v-for="item in order.items" :key="item.productId">
                <td class="font-sans">
                  <div class="font-bold text-sm text-base-content">{{ getLocalizedName(item.name) }}</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span v-if="item.sku" class="text-[11px] text-base-content/50 font-mono">SKU: {{ item.sku }}</span>
                    <span v-if="item.discount" class="badge badge-error badge-xs text-white font-black font-mono">
                      -{{ item.discount }}%
                    </span>
                  </div>
                </td>
                <td class="text-center">{{ item.momsRate }}%</td>
                <td class="text-center font-bold">{{ item.fulfilledQuantity ?? item.quantity }} st</td>
                <td class="text-end">
                  <div v-if="item.discount && item.originalUnitPriceMinor" class="text-[11px] text-base-content/40 line-through">
                    {{ formatMoney(item.originalUnitPriceMinor, order.currency) }}
                  </div>
                  <div :class="{ 'text-error font-bold': item.discount }">
                    {{ formatMoney(item.unitPriceMinor, order.currency) }}
                  </div>
                </td>
                <td class="text-end font-bold" :class="{ 'text-error': item.discount }">
                  {{ formatMoney(item.unitPriceMinor * (item.fulfilledQuantity ?? item.quantity), order.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Dual-Moms Tax Audit Ledger & Totals (AC-3) -->
        <div class="border-t border-base-200 pt-4 space-y-4">
          <div class="flex flex-col sm:flex-row justify-between gap-6">
            <!-- Skatteverket Tax Ledger Table -->
            <div class="flex-1 bg-base-200/40 p-4 rounded-xl text-xs space-y-2">
              <div class="font-bold text-base-content border-b border-base-300 pb-1">Momsunderlag & Skattespecifikation</div>
              <table class="w-full font-mono text-[11px]">
                <thead>
                  <tr class="text-base-content/60 border-b border-base-300">
                    <th class="text-start pb-1">Momssats</th>
                    <th class="text-end pb-1">Netto</th>
                    <th class="text-end pb-1">Moms</th>
                    <th class="text-end pb-1">Brutto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-base-200">
                  <tr>
                    <td class="py-1">Livsmedel (12%)</td>
                    <td class="text-end">{{ formatMoney(order.pricing.taxSplit?.moms12?.netAmountMinor || 0, order.currency) }}</td>
                    <td class="text-end">{{ formatMoney(order.pricing.taxSplit?.moms12?.momsAmountMinor || 0, order.currency) }}</td>
                    <td class="text-end">
                      {{ formatMoney((order.pricing.taxSplit?.moms12?.netAmountMinor || 0) + (order.pricing.taxSplit?.moms12?.momsAmountMinor || 0), order.currency) }}
                    </td>
                  </tr>
                  <tr>
                    <td class="py-1">Standard / Frakt (25%)</td>
                    <td class="text-end">{{ formatMoney(order.pricing.taxSplit?.moms25?.netAmountMinor || 0, order.currency) }}</td>
                    <td class="text-end">{{ formatMoney(order.pricing.taxSplit?.moms25?.momsAmountMinor || 0, order.currency) }}</td>
                    <td class="text-end">
                      {{ formatMoney((order.pricing.taxSplit?.moms25?.netAmountMinor || 0) + (order.pricing.taxSplit?.moms25?.momsAmountMinor || 0), order.currency) }}
                    </td>
                  </tr>
                  <tr class="font-bold border-t border-base-300">
                    <td class="py-1">Totalt varav moms:</td>
                    <td></td>
                    <td class="text-end text-brand-600">
                      {{ formatMoney(order.pricing.taxSplit?.totalMomsMinor || 0, order.currency) }}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Grand Totals -->
            <div class="w-full sm:w-64 space-y-2 text-sm">
              <div class="flex justify-between text-base-content/70">
                <span>Delsumma varor:</span>
                <span class="font-mono">{{ formatMoney(order.pricing.itemsTotalMinor, order.currency) }}</span>
              </div>
              <div v-if="totalDiscountSavings > 0" class="flex justify-between text-error font-semibold">
                <span>Rabatt / Erbjudande:</span>
                <span class="font-mono">-{{ formatMoney(totalDiscountSavings, order.currency) }}</span>
              </div>
              <div class="flex justify-between text-base-content/70">
                <span>Fraktkostnad:</span>
                <span class="font-mono">{{ formatMoney(order.pricing.shippingFeeMinor, order.currency) }}</span>
              </div>
              <div class="divider my-1"></div>
              <div class="flex justify-between font-bold text-lg text-base-content">
                <span>Totalt betalt:</span>
                <span class="font-mono text-brand-600 font-black">
                  {{ formatMoney(order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor, order.currency) }}
                </span>
              </div>
              <div class="text-[11px] text-base-content/50 font-mono text-end">
                Betalningsmetod: {{ order.paymentProvider }}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Notice -->
        <div class="border-t border-base-200 pt-4 text-center text-xs text-base-content/50">
          <p>Kvitto genererat elektroniskt och är giltigt som bokföringsunderlag.</p>
          <p>Vid frågor kontakta kundservice på order@siwar.se</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body {
    background: #fff !important;
    color: #000 !important;
  }
  .no-print {
    display: none !important;
  }
  .receipt-card {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
}
</style>