<!-- pages/order/confirmation/[id].vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t, locale } = useI18n()
const localePath = useLocalePath()
const orderId = route.params.id as string

const { data: order, pending, error } = await useFetch<any>(`/api/orders/${orderId}`)

// Fetch dynamic store settings from DB
const { data: storeInfo } = await useFetch<any>('/api/settings', {
  lazy: true,
})

const storeName = computed(() => {
  if (storeInfo.value?.storeName) {
    const cur = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
    return storeInfo.value.storeName[cur] || storeInfo.value.storeName.sv || storeInfo.value.storeName.en || 'SIWAR'
  }
  return 'SIWAR'
})

const storeCompany = computed(() => {
  const comp = storeInfo.value?.company
  return {
    name: comp?.name || 'Siwar Butik AB',
    orgNumber: comp?.orgNumber || '559123-4567',
    vatNumber: comp?.vatNumber || 'SE559123456701',
  }
})

const storeContact = computed(() => {
  const cont = storeInfo.value?.contact
  return {
    email: cont?.email || 'orders@siwar.se',
    phone: cont?.phone || '+46 720 457 454',
  }
})

const storeAddress = computed(() => {
  const addr = storeInfo.value?.address
  return {
    street: addr?.street || 'Åttingsstigen 41',
    postalCode: addr?.postalCode || '302 54',
    city: addr?.city || 'Halmstad',
    country: addr?.country || 'Sverige',
  }
})

const formattedReceiptAddress = computed(() => {
  return `${storeAddress.value.street}, ${storeAddress.value.postalCode} ${storeAddress.value.city}`
})

const pickupAddress = computed(() => {
  const pAddr = storeInfo.value?.pickup?.address || storeInfo.value?.address
  return {
    street: pAddr?.street || storeAddress.value.street,
    postalCode: pAddr?.postalCode || storeAddress.value.postalCode,
    city: pAddr?.city || storeAddress.value.city,
    country: pAddr?.country || storeAddress.value.country,
  }
})

const formattedPickupAddress = computed(() => {
  return `${pickupAddress.value.street}, ${pickupAddress.value.postalCode} ${pickupAddress.value.city}`
})

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

const milestoneStep = computed(() => {
  if (!order.value) return 1
  if (order.value.fulfillmentStatus === 'DISPATCHED') return 3
  if (order.value.fulfillmentStatus === 'PACKED') return 2
  return 1
})

const postNordTrackingUrl = computed(() => {
  if (!order.value?.trackingCode) return ''
  return `https://www.postnord.se/vara-verktyg/spara-brev-paket-och-pall?shipmentId=${encodeURIComponent(order.value.trackingCode)}`
})

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
        <NuxtLink :to="localePath('/')" class="btn btn-ghost btn-sm gap-2">
          <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
          <span>{{ t('order.backToHome', 'Tillbaka till butiken') }}</span>
        </NuxtLink>
        <button type="button" class="btn btn-sm text-white px-4 bg-brand-600 hover:bg-brand-700 font-bold border-none shadow-xs gap-2 rounded-xl" @click="printReceipt">
          <Icon name="lucide:printer" class="size-4" />
          <span>{{ t('order.printReceipt', 'Skriv ut kvitto') }}</span>
        </button>
      </div>

      <!-- Live Fulfillment Timeline & Carrier Tracking (no-print) -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-md rounded-3xl p-6 sm:p-8 space-y-6 no-print">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="size-11 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 shadow-xs">
              <Icon :name="order.customer.fulfillmentMethod === 'DELIVERY' ? 'lucide:truck' : 'lucide:store'" class="size-6" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-black text-base-content tracking-tight">
                {{ t('order.milestones.title', 'Orderstatus & Följesedel') }}
              </h2>
              <p class="text-xs text-base-content/70">
                {{ order.customer.fulfillmentMethod === 'DELIVERY' ? (t('checkout.delivery') || 'Hemleverans / Ombud') : (t('checkout.pickup') || 'Hämta i butik') }}
              </p>
            </div>
          </div>

          <div>
            <span
              class="badge font-bold font-mono text-xs py-2.5 px-3 border-none"
              :class="{
                'badge-warning text-zinc-900': order.fulfillmentStatus === 'PENDING_PACKING',
                'bg-blue-600 text-white': order.fulfillmentStatus === 'PACKED',
                'badge-success text-white': order.fulfillmentStatus === 'DISPATCHED',
                'badge-error text-white': order.fulfillmentStatus === 'CANCELLED',
              }"
            >
              <template v-if="order.fulfillmentStatus === 'PENDING_PACKING'">
                {{ t('order.milestones.pendingPacking', 'Mottagen') }}
              </template>
              <template v-else-if="order.fulfillmentStatus === 'PACKED'">
                {{ t('order.milestones.packed', 'Färdigpackad') }}
              </template>
              <template v-else-if="order.fulfillmentStatus === 'DISPATCHED'">
                {{ t('order.milestones.dispatched', 'Skickad / Hämtad') }}
              </template>
              <template v-else>
                {{ t('order.milestones.cancelled', 'Avbruten') }}
              </template>
            </span>
          </div>
        </div>

        <!-- 3-Step Milestone Stepper -->
        <div class="relative py-2">
          <div class="grid grid-cols-3 gap-2 relative z-10 text-center">
            <!-- Step 1: Mottagen -->
            <div class="flex flex-col items-center space-y-2">
              <div
                class="size-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm"
                :class="milestoneStep >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'"
              >
                <Icon name="lucide:check" class="size-5 text-white" />
              </div>
              <div>
                <div class="text-xs font-bold text-base-content">
                  {{ t('order.milestones.pendingPacking', 'Mottagen') }}
                </div>
                <div v-if="order.createdAt" class="text-[10px] text-base-content/60 font-mono mt-0.5">
                  {{ new Date(order.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'en' ? 'en-US' : 'sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                </div>
              </div>
            </div>

            <!-- Step 2: Färdigpackad -->
            <div class="flex flex-col items-center space-y-2">
              <div
                class="size-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm"
                :class="milestoneStep >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 border border-slate-300 dark:border-zinc-700'"
              >
                <Icon v-if="milestoneStep >= 2" name="lucide:check" class="size-5 text-white" />
                <span v-else>2</span>
              </div>
              <div>
                <div class="text-xs font-bold text-base-content">
                  {{ t('order.milestones.packed', 'Färdigpackad') }}
                </div>
                <div v-if="order.packedAt" class="text-[10px] text-base-content/60 font-mono mt-0.5">
                  {{ new Date(order.packedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'en' ? 'en-US' : 'sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                </div>
              </div>
            </div>

            <!-- Step 3: Skickad / Hämtad -->
            <div class="flex flex-col items-center space-y-2">
              <div
                class="size-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm"
                :class="milestoneStep >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 border border-slate-300 dark:border-zinc-700'"
              >
                <Icon v-if="milestoneStep >= 3" name="lucide:check" class="size-5 text-white" />
                <span v-else>3</span>
              </div>
              <div>
                <div class="text-xs font-bold text-base-content">
                  {{ order.customer.fulfillmentMethod === 'DELIVERY' ? t('order.milestones.dispatched', 'Skickad') : t('order.milestones.dispatched', 'Hämtad') }}
                </div>
                <div v-if="order.dispatchedAt" class="text-[10px] text-base-content/60 font-mono mt-0.5">
                  {{ new Date(order.dispatchedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'en' ? 'en-US' : 'sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Progress Bar Line -->
          <div class="absolute top-7 start-12 end-12 h-1 bg-slate-200 dark:bg-zinc-800 -z-0">
            <div
              class="h-full bg-brand-500 transition-all duration-500"
              :style="{ width: milestoneStep === 1 ? '15%' : milestoneStep === 2 ? '50%' : '100%' }"
            ></div>
          </div>
        </div>

        <!-- Carrier Tracking Block (Delivery) -->
        <div
          v-if="order.customer.fulfillmentMethod === 'DELIVERY'"
          class="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 space-y-3"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="text-xs font-bold text-base-content/60 uppercase tracking-wider">
                {{ t('order.tracking.carrier', 'Transportör') }}: PostNord
              </div>
              <div v-if="order.trackingCode" class="mt-1 flex items-center gap-2">
                <span class="text-xs font-semibold text-base-content/70">{{ t('order.tracking.kolliId', 'Kolli-ID') }}:</span>
                <span class="font-mono font-bold text-sm text-base-content bg-white dark:bg-zinc-700 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-zinc-600 shadow-2xs">
                  {{ order.trackingCode }}
                </span>
              </div>
              <div v-else class="text-xs text-base-content/70 mt-1">
                {{ t('order.tracking.waitingNotice', 'Spårningslänk blir aktiv så snart paketet har skannats av PostNord.') }}
              </div>
            </div>

            <div v-if="order.trackingCode">
              <a
                :href="postNordTrackingUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn bg-brand-600 hover:bg-brand-700 text-white font-bold btn-sm gap-2 rounded-xl border-none shadow-xs"
              >
                <Icon name="lucide:external-link" class="size-4 text-white" />
                <span>{{ t('order.tracking.trackButton', 'Spåra försändelse hos PostNord') }}</span>
              </a>
            </div>
          </div>
        </div>

        <!-- In-Store Pickup Block (Store Pickup) -->
        <div
          v-else-if="order.customer.fulfillmentMethod === 'PICKUP'"
          class="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 space-y-3"
        >
          <div class="flex items-start gap-3">
            <div class="size-9 rounded-xl bg-brand-100 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="lucide:map-pin" class="size-5" />
            </div>
            <div class="space-y-1.5 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold text-base-content">
                  {{ t('order.pickup.title', 'Instruktioner för upphämtning i butik') }}
                </h3>
                <span
                  class="badge badge-xs font-bold border-none"
                  :class="milestoneStep >= 2 ? 'badge-success text-white' : 'badge-warning text-zinc-900'"
                >
                  {{ milestoneStep >= 2 ? t('order.pickup.readyBadge', 'Redo för avhämtning') : t('order.pickup.preparingBadge', 'Förbereds i butik') }}
                </span>
              </div>
              <p class="text-xs text-base-content/70">
                {{ t('order.pickup.location', { address: formattedPickupAddress }, `Plats: ${formattedPickupAddress}`) }}
              </p>
              <p class="text-xs text-base-content/80 font-medium">
                {{ t('order.pickup.bringInstructions', { orderRef: order.orderReference }) }}
              </p>
              <div class="pt-1">
                <NuxtLink
                  :to="localePath('/oppettider')"
                  class="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <Icon name="lucide:clock" class="size-3.5" />
                  <span>{{ t('order.pickup.viewHours', 'Se butikens öppettider & karta') }}</span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Receipt Container (Auditable & Printable) -->
      <div class="receipt-card bg-base-100 border border-base-200 shadow-sm rounded-2xl p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0">
        <!-- Store Header & Order Reference -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-200 pb-6">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-base-content uppercase">{{ storeCompany.name || storeName }}</h1>
            <p class="text-xs text-base-content/60 font-mono mt-0.5">Org.nr: {{ storeCompany.orgNumber }} | momsreg: {{ storeCompany.vatNumber }}</p>
            <p class="text-xs text-base-content/60">{{ formattedReceiptAddress }}</p>
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
              Hämtas personligen i butik ({{ storeAddress.city }})
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
          <p>Vid frågor kontakta kundservice på {{ storeContact.email }}</p>
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