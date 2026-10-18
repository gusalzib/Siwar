<!-- components/admin/orders/pack/OrderPackCustomerCard.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  customer?: {
    fullName?: string
    email?: string
    phone?: string
    fulfillmentMethod?: 'DELIVERY' | 'PICKUP'
    address?: {
      street?: string
      postalCode?: string
      city?: string
    }
  }
}

const props = defineProps<Props>()
const { t } = useI18n()

const addressCopied = ref(false)
const customerCopied = ref(false)

function copyCustomerDetails() {
  if (!props.customer) return
  const text = `${props.customer.fullName || ''}\n${props.customer.email || ''}\n${props.customer.phone || ''}`
  navigator.clipboard.writeText(text)
  customerCopied.value = true
  setTimeout(() => {
    customerCopied.value = false
  }, 2000)
}

function copyDeliveryAddress() {
  if (!props.customer?.address) return
  const addr = props.customer.address
  const text = `${props.customer.fullName || ''}\n${addr.street || ''}\n${addr.postalCode || ''} ${addr.city || ''}`
  navigator.clipboard.writeText(text)
  addressCopied.value = true
  setTimeout(() => {
    addressCopied.value = false
  }, 2000)
}
</script>

<template>
  <div v-if="customer" class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- Customer Details -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm p-5 rounded-2xl">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 font-bold text-sm text-base-content">
          <Icon name="lucide:user" class="size-4 text-primary" />
          <span>{{ t('admin.orders.pack.customer.title', 'Kunduppgifter') }}</span>
        </div>
      </div>
      <div class="text-sm space-y-1.5">
        <div class="font-bold text-base text-base-content">{{ customer.fullName }}</div>
        <div v-if="customer.email" class="flex items-center gap-2 text-xs text-base-content/80 font-medium">
          <Icon name="lucide:mail" class="size-3.5 text-base-content/60" />
          <a :href="`mailto:${customer.email}`" class="hover:underline hover:text-primary">
            {{ customer.email }}
          </a>
        </div>
        <div v-if="customer.phone" class="flex items-center gap-2 text-xs text-base-content/80 font-mono font-medium">
          <Icon name="lucide:phone" class="size-3.5 text-base-content/60" />
          <a :href="`tel:${customer.phone}`" class="hover:underline hover:text-primary">
            {{ customer.phone }}
          </a>
        </div>
        <div class="pt-2">
          <button
            type="button"
            class="btn btn-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-base-content border border-slate-300 dark:border-zinc-600 gap-1.5 font-medium px-2.5 py-1 h-auto shadow-xs"
            @click="copyCustomerDetails"
          >
            <Icon :name="customerCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
            <span>{{ customerCopied ? t('admin.orders.pack.actions.copied', 'Kopierad!') : t('admin.orders.pack.actions.copyCustomer', 'Kopiera kunduppgifter') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delivery / Pickup Address -->
    <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700/80 shadow-sm p-5 rounded-2xl">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 font-bold text-sm text-base-content">
          <Icon
            :name="customer.fulfillmentMethod === 'DELIVERY' ? 'lucide:truck' : 'lucide:store'"
            class="size-4 text-primary"
          />
          <span>
            {{ customer.fulfillmentMethod === 'DELIVERY' ? t('admin.orders.pack.shipping.delivery', 'Leveransadress') : t('admin.orders.pack.shipping.pickup', 'Utlämning i butik') }}
          </span>
        </div>
        <span
          class="badge badge-sm font-semibold"
          :class="customer.fulfillmentMethod === 'DELIVERY' ? 'badge-info text-white' : 'badge-ghost border-slate-300 dark:border-zinc-600'"
        >
          {{ customer.fulfillmentMethod === 'DELIVERY' ? t('admin.orders.pack.shipping.deliveryBadge', 'Postpaket (Delivery)') : t('admin.orders.pack.shipping.pickupBadge', 'Hämta i butik (Pickup)') }}
        </span>
      </div>

      <!-- Case A: Delivery Address Displayed with Copy Button -->
      <div v-if="customer.fulfillmentMethod === 'DELIVERY' && customer.address" class="text-sm space-y-1.5">
        <div class="font-bold text-base text-base-content">
          {{ customer.address.street }}
        </div>
        <div class="text-xs text-base-content/80 font-mono font-medium">
          {{ customer.address.postalCode }} {{ customer.address.city }}
        </div>
        <div class="pt-2">
          <button
            type="button"
            class="btn btn-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-base-content border border-slate-300 dark:border-zinc-600 gap-1.5 font-medium px-2.5 py-1 h-auto shadow-xs"
            @click="copyDeliveryAddress"
          >
            <Icon :name="addressCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
            <span>{{ addressCopied ? t('admin.orders.pack.actions.copied', 'Kopierad!') : t('admin.orders.pack.actions.copyAddress', 'Kopiera adress') }}</span>
          </button>
        </div>
      </div>

      <!-- Case B: Pickup Notice -->
      <div v-else class="text-xs text-base-content/80 space-y-1 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
        <p>{{ t('admin.orders.pack.shipping.pickupNotice1', 'Kunden hämtar varorna i den fysiska butiken.') }}</p>
        <p class="font-semibold text-base-content">{{ t('admin.orders.pack.shipping.pickupNotice2', 'Ingen fraktsedel behövs.') }}</p>
      </div>
    </div>
  </div>
</template>
