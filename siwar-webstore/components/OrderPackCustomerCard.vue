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
    <div class="card bg-base-100 border border-base-200 shadow-sm p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 font-bold text-sm text-base-content">
          <Icon name="lucide:user" class="size-4 text-primary" />
          <span>{{ t('admin.orders.pack.customer.title', 'Kunduppgifter') }}</span>
        </div>
      </div>
      <div class="text-sm space-y-1">
        <div class="font-semibold text-base-content">{{ customer.fullName }}</div>
        <div v-if="customer.email" class="flex items-center gap-2 text-xs text-base-content/70">
          <Icon name="lucide:mail" class="size-3.5" />
          <a :href="`mailto:${customer.email}`" class="hover:underline hover:text-primary">
            {{ customer.email }}
          </a>
        </div>
        <div v-if="customer.phone" class="flex items-center gap-2 text-xs text-base-content/70">
          <Icon name="lucide:phone" class="size-3.5" />
          <a :href="`tel:${customer.phone}`" class="font-mono hover:underline hover:text-primary">
            {{ customer.phone }}
          </a>
        </div>
        <div class="pt-2">
          <button
            type="button"
            class="btn btn-xs btn-outline gap-1"
            @click="copyCustomerDetails"
          >
            <Icon :name="customerCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
            <span>{{ customerCopied ? t('admin.orders.pack.actions.copied', 'Kopierad!') : t('admin.orders.pack.actions.copyCustomer', 'Kopiera kunduppgifter') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delivery / Pickup Address -->
    <div class="card bg-base-100 border border-base-200 shadow-sm p-4">
      <div class="flex items-center justify-between mb-2">
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
          :class="customer.fulfillmentMethod === 'DELIVERY' ? 'badge-info text-white' : 'badge-ghost'"
        >
          {{ customer.fulfillmentMethod === 'DELIVERY' ? t('admin.orders.pack.shipping.deliveryBadge', 'Postpaket (Delivery)') : t('admin.orders.pack.shipping.pickupBadge', 'Hämta i butik (Pickup)') }}
        </span>
      </div>

      <!-- Case A: Delivery Address Displayed with Copy Button -->
      <div v-if="customer.fulfillmentMethod === 'DELIVERY' && customer.address" class="text-sm space-y-1">
        <div class="font-medium text-base-content">
          {{ customer.address.street }}
        </div>
        <div class="text-xs text-base-content/70 font-mono">
          {{ customer.address.postalCode }} {{ customer.address.city }}
        </div>
        <div class="pt-2">
          <button
            type="button"
            class="btn btn-xs btn-outline gap-1"
            @click="copyDeliveryAddress"
          >
            <Icon :name="addressCopied ? 'lucide:check' : 'lucide:copy'" class="size-3" />
            <span>{{ addressCopied ? t('admin.orders.pack.actions.copied', 'Kopierad!') : t('admin.orders.pack.actions.copyAddress', 'Kopiera adress') }}</span>
          </button>
        </div>
      </div>

      <!-- Case B: Pickup Notice -->
      <div v-else class="text-xs text-base-content/60 space-y-1">
        <p>{{ t('admin.orders.pack.shipping.pickupNotice1', 'Kunden hämtar varorna i den fysiska butiken.') }}</p>
        <p class="font-semibold text-base-content">{{ t('admin.orders.pack.shipping.pickupNotice2', 'Ingen fraktsedel behövs.') }}</p>
      </div>
    </div>
  </div>
</template>
