<!-- pages/admin/orders/[id]/print-slip.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router'

definePageMeta({
  layout: false, // Disables standard admin header and sidebar
  middleware: 'admin',
})

const route = useRoute()
const localePath = useLocalePath()
const orderId = route.params.id as string
const { data: order, pending, error } = await useFetch<any>(`/api/admin/orders/${orderId}`)

function onPrint() {
  window.print()
}
</script>

<template>
  <div class="print-container p-6 max-w-4xl mx-auto font-sans text-black">
    <!-- Non-printable top action bar -->
    <div class="no-print flex items-center justify-between pb-6 border-b border-gray-200 mb-6">
      <NuxtLink :to="localePath(`/admin/orders/${orderId}/pack`)" class="text-sm font-semibold text-gray-600 hover:text-black">
        &larr; Tillbaka till orderpackning
      </NuxtLink>
      <button type="button" class="bg-black text-white px-4 py-2 rounded text-sm font-bold cursor-pointer" @click="onPrint">
        Skriv ut följesedel (Ctrl+P)
      </button>
    </div>

    <div v-if="pending" class="text-center py-12">Laddar följesedel...</div>
    <div v-else-if="error || !order" class="text-red-600 py-12">Kunde inte hämta orderinformation.</div>

    <div v-else class="space-y-6 text-sm">
      <!-- Header -->
      <div class="flex justify-between items-start border-b-2 border-black pb-4">
        <div>
          <h1 class="text-2xl font-black tracking-tight">SIWAR PACKSEDEL</h1>
          <p class="text-xs text-gray-600">Storgatan 12, Halmstad | order@siwar.se</p>
        </div>
        <div class="text-right">
          <div class="text-xl font-bold font-mono">{{ order.orderReference }}</div>
          <div class="text-xs text-gray-600 font-mono">
            Datum: {{ new Date(order.createdAt).toLocaleDateString('sv-SE') }}
          </div>
        </div>
      </div>

      <!-- Customer & Fulfillment Routing -->
      <div class="grid grid-cols-2 gap-6 border-b border-gray-300 pb-4">
        <div>
          <h2 class="text-xs font-bold uppercase text-gray-500 mb-1">Mottagare</h2>
          <div class="font-bold text-base">{{ order.customer.fullName }}</div>
          <div>Tel: {{ order.customer.phone }}</div>
          <div class="text-xs text-gray-600">{{ order.customer.email }}</div>
        </div>
        <div>
          <h2 class="text-xs font-bold uppercase text-gray-500 mb-1">Leveranstyp</h2>
          <div class="font-bold text-base uppercase">
            {{ order.customer.fulfillmentMethod === 'DELIVERY' ? 'Paketleverans (PostNord)' : 'HÄMTA I BUTIK (PICKUP)' }}
          </div>
          <div v-if="order.customer.fulfillmentMethod === 'DELIVERY' && order.customer.address" class="text-sm mt-1">
            <div>{{ order.customer.address.street }}</div>
            <div class="font-mono">{{ order.customer.address.postalCode }} {{ order.customer.address.city }}</div>
          </div>
          <div v-else class="text-xs text-gray-600 mt-1 italic">
            Varorna läggs på hyllan för kundavhämtning.
          </div>
        </div>
      </div>

      <!-- Line Items Checklist -->
      <div>
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b-2 border-black text-xs font-bold uppercase">
              <th class="w-10 text-center py-2">Plockad</th>
              <th class="py-2">Artikel</th>
              <th class="py-2 font-mono">SKU</th>
              <th class="text-end py-2">A-pris</th>
              <th class="text-center py-2">Beställt</th>
              <th class="text-center py-2">Plockat</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-300">
            <tr v-for="item in order.items" :key="item.productId" class="py-2">
              <td class="text-center py-3">
                <div class="w-5 h-5 border border-black inline-block rounded-xs"></div>
              </td>
              <td class="py-3">
                <div class="font-bold">{{ item.name?.sv || item.name?.en || item.name?.ar }}</div>
                <div class="text-xs text-gray-500 font-sans" dir="rtl">{{ item.name?.ar }}</div>
                <div v-if="item.discount" class="mt-1">
                  <span class="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded font-mono">
                    Kampanjrabatt -{{ item.discount }}%
                  </span>
                </div>
              </td>
              <td class="py-3 font-mono text-xs">{{ item.sku || '-' }}</td>
              <td class="py-3 font-mono text-xs text-end">
                <span v-if="item.discount && item.originalUnitPriceMinor" class="line-through text-gray-400 block text-[10px]">
                  {{ (item.originalUnitPriceMinor / 100).toFixed(2) }}
                </span>
                <span :class="{ 'font-bold text-red-700': item.discount }">
                  {{ (item.unitPriceMinor / 100).toFixed(2) }} {{ order.currency }}
                </span>
              </td>
              <td class="text-center py-3 font-mono font-bold">{{ item.quantity }} st</td>
              <td class="text-center py-3 font-mono">______</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Financial Totals Summary on Följesedel -->
      <div class="flex justify-end pt-2 border-t border-gray-300">
        <div class="w-64 space-y-1 text-xs">
          <div class="flex justify-between text-gray-600">
            <span>Delsumma varor:</span>
            <span class="font-mono">{{ (order.pricing.itemsTotalMinor / 100).toFixed(2) }} {{ order.currency }}</span>
          </div>
          <div class="flex justify-between text-gray-600">
            <span>Fraktkostnad:</span>
            <span class="font-mono">{{ (order.pricing.shippingFeeMinor / 100).toFixed(2) }} {{ order.currency }}</span>
          </div>
          <div class="border-t border-gray-300 pt-1 flex justify-between font-bold text-sm text-black">
            <span>Totalt betalt:</span>
            <span class="font-mono">{{ ((order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor) / 100).toFixed(2) }} {{ order.currency }}</span>
          </div>
          <div class="text-[10px] text-gray-500 font-mono text-right">
            Betalning: {{ order.paymentProvider }} ({{ order.paymentStatus }})
          </div>
        </div>
      </div>

      <!-- Packing Notes / Shortage Adjustments -->
      <div v-if="order.shortageAdjustments?.length" class="border border-gray-300 p-3 rounded text-xs bg-gray-50">
        <span class="font-bold">Noteringar om sortimentsjusteringar:</span>
        <ul class="list-disc pl-4 mt-1">
          <li v-for="(adj, i) in order.shortageAdjustments" :key="i">
            {{ adj.action }}: {{ adj.originalQuantity }} &rarr; {{ adj.adjustedQuantity }} st
            <span v-if="adj.note">({{ adj.note }})</span>
          </li>
        </ul>
      </div>

      <!-- Staff Signature Area -->
      <div class="grid grid-cols-2 gap-8 pt-8 border-t border-gray-300 text-xs">
        <div>
          <div class="border-b border-black h-8"></div>
          <span class="text-gray-500">Packad av (namn / signatur)</span>
        </div>
        <div>
          <div class="border-b border-black h-8"></div>
          <span class="text-gray-500">Kontrollerad och klar datum / tid</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  @page {
    margin: 12mm;
    size: auto;
  }
  body {
    background: #fff !important;
    color: #000 !important;
  }
  .no-print {
    display: none !important;
  }
  .print-container {
    padding: 0 !important;
    max-width: 100% !important;
  }
}
</style>