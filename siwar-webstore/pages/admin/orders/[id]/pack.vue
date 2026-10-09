<!-- pages/admin/orders/[id]/pack.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * definePageMeta
 * Enforces the 'admin' middleware so that only authenticated admin users can access this page.
 */
definePageMeta({
  middleware: 'admin',
})

// Extract the 'id' parameter from the current route (e.g. /admin/orders/123 -> id = '123')
const route = useRoute()
const router = useRouter()

// Extract the translation function (t) and the active locale (locale)
const { t, locale } = useI18n()
const orderId = route.params.id as string

/**
 * LineItemState Interface
 * Represents the local, mutable state of a single product line item in the order during the packing process.
 * - productId: Unique identifier for the product.
 * - sku: Stock Keeping Unit (optional).
 * - name: Multi-language product name.
 * - quantity: The original quantity ordered by the customer.
 * - fulfilledQuantity: The actual quantity being packed/shipped (can be adjusted downward due to shortages).
 * - unitPriceMinor: The price per unit in minor currency units (e.g., öre for SEK).
 * - momsRate: Applicable Swedish VAT rate (12% for food, 25% for standard goods).
 * - shortageStatus: Tracks if the line was altered ('NONE', 'REDUCED', 'REMOVED', or 'SUBSTITUTED').
 * - isPacked: Tracks whether the warehouse worker has physically verified and packed this item.
 */
interface LineItemState {
  productId: string
  sku?: string
  name: { ar: string; sv: string; en: string }
  quantity: number
  fulfilledQuantity: number
  unitPriceMinor: number
  momsRate: 12 | 25
  shortageStatus: 'NONE' | 'REDUCED' | 'REMOVED' | 'SUBSTITUTED'
  isPacked: boolean
}

/**
 * ShortageActionDraft Interface
 * Represents an action taken by the admin when there isn't enough physical stock to fulfill the ordered quantity.
 * - productId: The ID of the product being adjusted.
 * - action: The type of shortage adjustment.
 * - adjustedQuantity: The new quantity to fulfill (0 for REMOVE_LINE).
 * - substitutedProduct: Details of the replacement product if the action is 'SUBSTITUTE_ITEM'.
 * - note: Optional internal note explaining the reason for the shortage.
 */
interface ShortageActionDraft {
  productId: string
  action: 'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'
  adjustedQuantity: number
  substitutedProduct?: {
    _id: string
    sku?: string
    name: { ar: string; sv: string; en: string }
    priceMinor: number
    momsRate: 12 | 25
  }
  note?: string
}

/**
 * Data Fetching
 * useFetch makes a GET request to our backend API to retrieve the full order document from MongoDB.
 * - order: The reactive order data.
 * - pending: Loading state boolean.
 * - error: Any fetch errors.
 * - refresh: Function to manually re-fetch data.
 */
const { data: order, pending, error, refresh } = await useFetch<any>(`/api/admin/orders/${orderId}`)

/**
 * Local State Variables
 * - localItems: The mutable clone of the order's items, manipulated locally before saving.
 * - pendingActions: A Map tracking all shortage actions applied by the admin, keyed by productId.
 * - isSubmitting: Tracks whether a save or dispatch API request is currently in flight.
 * - errorMessage: Stores any API error messages returned during submission to display to the user.
 */
const localItems = ref<LineItemState[]>([])
const pendingActions = ref<Map<string, ShortageActionDraft>>(new Map())
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

/**
 * Initialization Watcher
 * Watches the `order` object. When the order loads from the API, it populates `localItems` with a deep-copied, mutable version of the data.
 */
watch(
  order,
  (newOrder) => {
    if (newOrder?.items) {
      // Determine if order was already saved as PACKED or DISPATCHED
      const isAlreadyPackedStatus =
        newOrder.fulfillmentStatus === 'PACKED' ||
        newOrder.fulfillmentStatus === 'DISPATCHED'

      localItems.value = newOrder.items.map((i: any) => {
        const idStr = String(i.productId)
        // Check if we already have this item in our local state to prevent overwriting 'isPacked' on re-fetch
        const existing = localItems.value.find((local) => local.productId === idStr)

        return {
          ...i,
          productId: idStr,
          // Fallback to original quantity if fulfilledQuantity is missing (e.g. legacy orders)
          fulfilledQuantity:
            typeof i.fulfilledQuantity === 'number' ? i.fulfilledQuantity : i.quantity,
          shortageStatus: i.shortageStatus || 'NONE',
          // Preserve current local packed state; if fresh, set to true if order is already completely PACKED
          isPacked: existing ? existing.isPacked : isAlreadyPackedStatus,
        }
      })
    }
  },
  { immediate: true } // Execute the watcher immediately upon component creation
)

/**
 * Modal State Variables
 * These control the HTML5 <dialog> modal used for declaring stock shortages.
 */
const shortageDialog = ref<HTMLDialogElement | null>(null) // Template ref for the <dialog> element
const activeItem = ref<LineItemState | null>(null) // The item currently being adjusted in the modal
const selectedActionType = ref<'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'>('REDUCE_QUANTITY') // The selected tab in the modal
const modalAdjustedQuantity = ref(1) // Input binding for the new quantity
const modalNote = ref('') // Input binding for the reason note

// State variables specifically for the "Substitute Item" workflow
const substituteSearchQuery = ref('')
const substituteResults = ref<any[]>([])
const selectedSubstitute = ref<any | null>(null)
const isSearchingSubstitute = ref(false)

/**
 * openShortageModal
 * Opens the shortage resolution dialog for a specific line item and resets the form state.
 * @param item - The LineItemState object that needs to be adjusted.
 */
function openShortageModal(item: LineItemState) {
  activeItem.value = item
  selectedActionType.value = 'REDUCE_QUANTITY'
  modalAdjustedQuantity.value = Math.max(0, item.fulfilledQuantity - 1)
  modalNote.value = ''
  selectedSubstitute.value = null
  substituteSearchQuery.value = ''
  substituteResults.value = []
  
  if (shortageDialog.value) {
    shortageDialog.value.showModal() // Native HTML5 dialog method
  }
}

/**
 * closeModal
 * Closes the shortage resolution dialog and clears the active item context.
 */
function closeModal() {
  if (shortageDialog.value) {
    shortageDialog.value.close()
  }
  activeItem.value = null
}

/**
 * searchSubstitutes
 * Queries the backend for active products matching the search query to use as a substitute.
 */
async function searchSubstitutes() {
  if (!substituteSearchQuery.value.trim()) return
  isSearchingSubstitute.value = true
  try {
    const res = await $fetch<any[]>('/api/admin/products/search', {
      query: { q: substituteSearchQuery.value },
    })
    substituteResults.value = res
  } catch (err) {
    console.error('Failed to search products:', err)
  } finally {
    isSearchingSubstitute.value = false
  }
}

/**
 * selectSubstituteProduct
 * Sets the selected product from the substitute search results.
 * @param product - The product object returned from the search API.
 */
function selectSubstituteProduct(product: any) {
  selectedSubstitute.value = product
}

/**
 * applyShortageAction
 * Processes the inputs from the modal and applies the shortage action to the local line item.
 * It also queues a ShortageActionDraft in `pendingActions` to be sent to the backend upon save.
 */
function applyShortageAction() {
  if (!activeItem.value) return

  const pId = activeItem.value.productId
  const targetLine = localItems.value.find((i) => i.productId === pId)
  if (!targetLine) return

  if (selectedActionType.value === 'REMOVE_LINE') {
    // Zero out the item
    targetLine.fulfilledQuantity = 0
    targetLine.shortageStatus = 'REMOVED'
    targetLine.isPacked = true // Automatically mark as "packed" so it doesn't block dispatch
    
    pendingActions.value.set(pId, {
      productId: pId,
      action: 'REMOVE_LINE',
      adjustedQuantity: 0,
      note: modalNote.value,
    })
  } else if (selectedActionType.value === 'REDUCE_QUANTITY') {
    // Reduce the quantity to the specified amount
    const newQty = Math.max(0, Math.min(modalAdjustedQuantity.value, targetLine.quantity))
    targetLine.fulfilledQuantity = newQty
    targetLine.shortageStatus = newQty === 0 ? 'REMOVED' : 'REDUCED'
    
    pendingActions.value.set(pId, {
      productId: pId,
      action: 'REDUCE_QUANTITY',
      adjustedQuantity: newQty,
      note: modalNote.value,
    })
  } else if (selectedActionType.value === 'SUBSTITUTE_ITEM' && selectedSubstitute.value) {
    // Replace the original item with the selected substitute product
    const sub = selectedSubstitute.value
    // Handle localized price objects
    const subPriceMinor = sub.price?.[order.value.currency] ?? sub.price?.SEK ?? 0
    
    targetLine.productId = sub._id.toString()
    targetLine.sku = sub.sku
    targetLine.name = sub.name
    targetLine.fulfilledQuantity = modalAdjustedQuantity.value
    targetLine.unitPriceMinor = subPriceMinor
    targetLine.momsRate = sub.momsRate || 12
    targetLine.shortageStatus = 'SUBSTITUTED'

    pendingActions.value.set(pId, {
      productId: pId,
      action: 'SUBSTITUTE_ITEM',
      adjustedQuantity: modalAdjustedQuantity.value,
      substitutedProduct: {
        _id: sub._id.toString(),
        sku: sub.sku,
        name: sub.name,
        priceMinor: subPriceMinor,
        momsRate: sub.momsRate || 12,
      },
      note: modalNote.value,
    })
  }

  closeModal()
}

/**
 * resetLineItem
 * Reverts a line item back to its original ordered state and removes any pending shortage actions.
 * @param productId - The ID of the product to reset.
 */
function resetLineItem(productId: string) {
  const original = order.value.items.find((i: any) => i.productId.toString() === productId)
  const current = localItems.value.find((i) => i.productId === productId)
  if (original && current) {
    current.fulfilledQuantity = original.quantity
    current.shortageStatus = 'NONE'
    current.unitPriceMinor = original.unitPriceMinor
    current.name = original.name
    current.sku = original.sku
    pendingActions.value.delete(productId) // Un-queue the shortage action
  }
}

/**
 * packAllItems
 * A convenience function that loops through all items in the order and sets `isPacked = true` 
 * for any item that is still meant to be fulfilled (quantity > 0).
 */
function packAllItems() {
  for (const item of localItems.value) {
    if (item.fulfilledQuantity > 0) {
      item.isPacked = true
    }
  }
}

/**
 * toggleItemPicked
 * Toggles the physical packing verification status for a specific line item.
 * @param item - The LineItemState object being toggled.
 */
function toggleItemPicked(item: LineItemState) {
  item.isPacked = !item.isPacked
}

/**
 * isFullyPacked
 * A computed property that evaluates to `true` if and only if EVERY item in the order is either:
 * A) Dropped from the order completely (fulfilledQuantity === 0)
 * B) Physically verified and ticked as packed (isPacked === true)
 */
const isFullyPacked = computed(() => {
  if (!localItems.value || localItems.value.length === 0) return false
  return localItems.value.every((item) => item.fulfilledQuantity === 0 || item.isPacked === true)
})

/**
 * canDispatch
 * Determines whether the "Slutför och Skicka" (Dispatch) button should be enabled.
 * Returns false if a network request is in flight, if the order is already dispatched, or if not fully packed.
 */
const canDispatch = computed(() => {
  if (isSubmitting.value) return false
  if (order.value?.fulfillmentStatus === 'DISPATCHED') return false
  return isFullyPacked.value
})

/**
 * livePricing
 * A computed property that dynamically recalculates the order's financial totals 
 * based on the mutable `localItems` array. It splits VAT classes (Moms) and identifies 
 * how much money needs to be refunded or released from the payment hold.
 */
const livePricing = computed(() => {
  if (!order.value) {
    return { fulfilledItemsTotal: 0, grandTotal: 0, moms12Amount: 0, moms25Amount: 0, totalMoms: 0, releaseAmount: 0 }
  }

  let itemsTotal = 0
  let moms12Gross = 0
  let moms25Gross = 0

  // Tally up the row totals based on fulfilled quantities and their respective VAT rates
  for (const line of localItems.value) {
    const lineGross = line.unitPriceMinor * line.fulfilledQuantity
    itemsTotal += lineGross
    if (line.momsRate === 12) {
      moms12Gross += lineGross
    } else {
      moms25Gross += lineGross
    }
  }

  // Shipping fees are 25% VAT and are dropped entirely if the order has 0 items
  const shippingFee = itemsTotal > 0 ? order.value.pricing.shippingFeeMinor : 0
  moms25Gross += shippingFee

  // Reverse calculate the exact VAT amount included in the gross totals
  const moms12Amount = Math.round((moms12Gross * 12) / 112)
  const moms25Amount = Math.round((moms25Gross * 25) / 125)
  const totalMoms = moms12Amount + moms25Amount
  const grandTotal = itemsTotal + shippingFee
  
  // Calculate if the new grand total is lower than the authorized hold, requiring a partial release
  const releaseAmount = Math.max(0, order.value.pricing.authorizedTotalMinor - grandTotal)

  return {
    fulfilledItemsTotal: itemsTotal,
    shippingFee,
    grandTotal,
    moms12Amount,
    moms25Amount,
    totalMoms,
    releaseAmount,
  }
})

/**
 * formatMoney
 * Formats minor currency units (e.g. 1000 öre) into major currency strings (e.g. "10.00 SEK").
 * @param amountMinor - The integer value in minor units.
 * @param currency - The currency code (default SEK).
 */
function formatMoney(amountMinor: number, currency = 'SEK') {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

/**
 * getLocalizedName
 * Extracts the correct translation from a multilingual object based on the user's active locale.
 * Falls back sequentially through Swedish, English, and Arabic if the exact match is missing.
 * @param nameObj - The translation dictionary for the product name.
 */
function getLocalizedName(nameObj?: { ar: string; sv: string; en: string }) {
  if (!nameObj) return ''
  const current = locale.value as 'ar' | 'sv' | 'en'
  return nameObj[current] || nameObj.sv || nameObj.en || nameObj.ar || ''
}

/**
 * copyDeliveryAddress
 * Copies the customer's delivery address to the clipboard.
 */
const addressCopied = ref(false)
const customerCopied = ref(false)

function copyDeliveryAddress() {
  if (!order.value?.customer?.address) return
  const addr = order.value.customer.address
  const text = `${order.value.customer.fullName}\n${addr.street}\n${addr.postalCode} ${addr.city}`
  navigator.clipboard.writeText(text)
  addressCopied.value = true
  setTimeout(() => {
    addressCopied.value = false
  }, 2000)
}

function copyCustomerDetails() {
  if (!order.value?.customer) return
  const cust = order.value.customer
  const text = `${cust.fullName}\n${cust.email}\n${cust.phone}`
  navigator.clipboard.writeText(text)
  customerCopied.value = true
  setTimeout(() => {
    customerCopied.value = false
  }, 2000)
}

/**
 * submitPacking
 * POSTs the final packing state and all pending shortage actions to the backend to complete the workflow.
 * @param markDispatched - If false, just saves progress as PACKED. If true, triggers payment capture and sets status to DISPATCHED.
 */
async function submitPacking(markDispatched: boolean) {
  isSubmitting.value = true
  errorMessage.value = null

  try {
    const payload = {
      actions: Array.from(pendingActions.value.values()),
      markDispatched,
    }

    await $fetch(`/api/admin/orders/${orderId}/pack`, {
      method: 'POST',
      body: payload,
    })

    // Navigate back to the orders list upon success
    await router.push('/admin/orders')
  } catch (err: any) {
    // Extract and display backend validation/settlement errors
    errorMessage.value = err.data?.statusMessage || err.message || 'Failed to complete packing'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Loading & Error States -->
      <div v-if="pending" class="flex justify-center p-12">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <div v-else-if="error || !order" class="alert alert-error">
        <Icon name="lucide:alert-triangle" class="size-6" />
        <span>{{ error?.statusMessage || t('admin.orders.pack.errors.loadFailed') }}</span>
      </div>

      <template v-else>
        <!-- Top Header: Clean title and primary actions -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-200 shadow-sm">
          <div class="flex items-center gap-3">
            <NuxtLink to="/admin/orders" class="btn btn-ghost btn-circle btn-sm">
              <Icon name="lucide:arrow-left" class="size-5" />
            </NuxtLink>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold font-mono text-base-content">{{ order.orderReference }}</h1>
                <span
                  class="badge badge-sm font-semibold"
                  :class="{
                    'badge-warning': order.fulfillmentStatus === 'PENDING_PACKING',
                    'badge-info text-white': order.fulfillmentStatus === 'PACKED',
                    'badge-success text-white': order.fulfillmentStatus === 'DISPATCHED',
                    'badge-error text-white': order.fulfillmentStatus === 'CANCELLED',
                  }"
                >
                  {{ order.fulfillmentStatus }}
                </span>
                <span class="badge badge-outline badge-sm font-semibold">
                  {{ order.paymentProvider }}
                </span>
              </div>
              <p class="text-xs text-base-content/50 mt-1 font-mono">
                {{ t('admin.orders.pack.summary.createdAt', 'Skapad:') }} {{ new Date(order.createdAt).toLocaleString('sv-SE') }}
              </p>
            </div>
          </div>

          <!-- Header Action Buttons -->
          <div class="flex flex-wrap items-center gap-2.5 justify-end">
            <button
              type="button"
              class="btn btn-sm bg-transparent hover:bg-base-200 text-base-content px-3 border-2 border-brand-500 hover:border-brand-600 shadow-sm transition-colors active:scale-95"
              :disabled="order.fulfillmentStatus === 'DISPATCHED' || isSubmitting"
              @click="packAllItems"
            >
              <Icon name="lucide:check-check" class="size-4" />
              <span>{{ t('admin.orders.pack.actions.markAllPacked', 'Markera alla som packade') }}</span>
            </button>

            <button
              type="button"
              class="btn btn-sm bg-transparent hover:bg-base-200 text-base-content px-3 border-2 border-brand-500 hover:border-brand-300 shadow-sm transition-colors"
              :disabled="isSubmitting || order.fulfillmentStatus === 'DISPATCHED'"
              @click="submitPacking(false)"
            >
              <Icon name="lucide:save" class="size-4" />
              <span>{{ t('admin.orders.pack.actions.savePacked', 'Spara packstatus') }}</span>
            </button>

            <button
              type="button"
              class="btn btn-sm bg-brand-600 hover:bg-brand-700 text-white border-transparent px-3 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              :disabled="!canDispatch"
              @click="submitPacking(true)"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-xs"></span>
              <Icon v-else name="lucide:truck" class="size-4" />
              <span>{{ t('admin.orders.pack.actions.dispatch', 'Slutför och Skicka') }}</span>
            </button>
          </div>
        </div>

        <!-- Customer & Shipping Details Banner (New) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Customer Details -->
          <div class="card bg-base-100 border border-base-200 shadow-sm p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 font-bold text-sm text-base-content">
                <Icon name="lucide:user" class="size-4 text-primary" />
                <span>{{ t('admin.orders.pack.customer.title', 'Kunduppgifter') }}</span>
              </div>
            </div>
            <div class="text-sm space-y-1">
              <div class="font-semibold text-base-content">{{ order.customer.fullName }}</div>
              <div class="flex items-center gap-2 text-xs text-base-content/70">
                <Icon name="lucide:mail" class="size-3.5" />
                <a :href="`mailto:${order.customer.email}`" class="hover:underline hover:text-primary">
                  {{ order.customer.email }}
                </a>
              </div>
              <div class="flex items-center gap-2 text-xs text-base-content/70">
                <Icon name="lucide:phone" class="size-3.5" />
                <a :href="`tel:${order.customer.phone}`" class="font-mono hover:underline hover:text-primary">
                  {{ order.customer.phone }}
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
                  :name="order.customer.fulfillmentMethod === 'DELIVERY' ? 'lucide:truck' : 'lucide:store'"
                  class="size-4 text-primary"
                />
                <span>
                  {{ order.customer.fulfillmentMethod === 'DELIVERY' ? t('admin.orders.pack.shipping.delivery', 'Leveransadress') : t('admin.orders.pack.shipping.pickup', 'Utlämning i butik') }}
                </span>
              </div>
              <span
                class="badge badge-sm font-semibold"
                :class="order.customer.fulfillmentMethod === 'DELIVERY' ? 'badge-info text-white' : 'badge-ghost'"
              >
                {{ order.customer.fulfillmentMethod === 'DELIVERY' ? t('admin.orders.pack.shipping.deliveryBadge', 'Postpaket (Delivery)') : t('admin.orders.pack.shipping.pickupBadge', 'Hämta i butik (Pickup)') }}
              </span>
            </div>

            <!-- Case A: Delivery Address Displayed with Copy Button -->
            <div v-if="order.customer.fulfillmentMethod === 'DELIVERY' && order.customer.address" class="text-sm space-y-1">
              <div class="font-medium text-base-content">
                {{ order.customer.address.street }}
              </div>
              <div class="text-xs text-base-content/70 font-mono">
                {{ order.customer.address.postalCode }} {{ order.customer.address.city }}
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

        <!-- Alert Banner on Error -->
        <div v-if="errorMessage" class="alert alert-error">
          <Icon name="lucide:alert-circle" class="size-5" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Main Layout: 2 Columns -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left: Packing Items Table & Mobile Card View (2 cols) -->
<div class="lg:col-span-2 space-y-4">
  <div class="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
    
    <!-- 1. MOBILE & TABLET VIEW (< md: 768px): Responsive Packing Cards -->
    <div class="block md:hidden divide-y divide-base-200">
      <div
        v-for="item in localItems"
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
            @click.stop="toggleItemPicked(item)"
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
              {{ formatMoney(item.unitPriceMinor * item.fulfilledQuantity, order.currency) }}
            </div>
          </div>
        </div>

        <!-- Bottom: Shortage Action Button -->
        <div class="flex justify-end pt-1">
          <button
            v-if="item.shortageStatus === 'NONE'"
            type="button"
            class="btn btn-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 gap-1.5 font-bold shadow-xs transition-colors"
            @click="openShortageModal(item)"
          >
            <Icon name="lucide:alert-circle" class="size-4 text-amber-600 dark:text-amber-400" />
            <span>{{ t('admin.orders.pack.actions.shortage') }}</span>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-outline border-base-300 hover:bg-base-200 text-base-content gap-1.5 font-semibold"
            @click="resetLineItem(item.productId)"
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
          <tr v-for="item in localItems" :key="item.productId" class="hover transition-colors">
            <!-- Checkbox -->
            <td class="w-14 text-center py-4 px-3">
              <input
                type="checkbox"
                class="checkbox checkbox-sm border-2 border-base-content/40 bg-base-100 checked:bg-brand-600 checked:border-brand-600 transition-colors"
                :disabled="item.fulfilledQuantity === 0"
                :checked="item.isPacked"
                @click.stop="toggleItemPicked(item)"
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
              {{ formatMoney(item.unitPriceMinor, order.currency) }}
            </td>

            <!-- Row Total -->
            <td class="text-end font-mono font-bold text-sm text-base-content py-4 px-4 whitespace-nowrap">
              {{ formatMoney(item.unitPriceMinor * item.fulfilledQuantity, order.currency) }}
            </td>

            <!-- Shortage Button -->
            <td class="text-center py-4 px-4 whitespace-nowrap">
              <button
                v-if="item.shortageStatus === 'NONE'"
                type="button"
                class="btn btn-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 gap-1 font-bold shadow-xs transition-colors"
                @click="openShortageModal(item)"
              >
                <Icon name="lucide:alert-circle" class="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>{{ t('admin.orders.pack.actions.shortage') }}</span>
              </button>
              <button
                v-else
                type="button"
                class="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content gap-1 font-semibold"
                :title="t('admin.orders.pack.actions.resetLineTooltip')"
                @click="resetLineItem(item.productId)"
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

  <!-- Historical Audit Trail Card -->
  <div v-if="order.shortageAdjustments?.length" class="card bg-base-100 border border-base-200 shadow-sm p-5 space-y-3">
    <h3 class="card-title text-sm font-bold flex items-center gap-2 text-base-content">
      <Icon name="lucide:history" class="size-4 text-brand-600" />
      {{ t('admin.orders.pack.history.title') }}
    </h3>
    <ul class="divide-y divide-base-200 text-xs">
      <li v-for="(adj, idx) in order.shortageAdjustments" :key="idx" class="py-2.5 flex justify-between items-start">
        <div>
          <span class="font-bold text-base-content">{{ adj.action }}</span>
          <span class="text-base-content/50 ml-2 font-mono">
            {{ new Date(adj.timestamp).toLocaleString('sv-SE') }}
          </span>
          <p v-if="adj.note" class="text-base-content/70 italic mt-0.5">"{{ adj.note }}"</p>
        </div>
        <div class="font-mono text-end font-semibold text-base-content">
          {{ adj.originalQuantity }} &rarr; {{ adj.adjustedQuantity }} st
        </div>
      </li>
    </ul>
  </div>
</div>

          <!-- Right: Financial Settlement Card (1 col) -->
          <div class="space-y-4">
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
                      {{ formatMoney(order.pricing.authorizedTotalMinor, order.currency) }}
                    </span>
                  </div>

                  <div class="flex justify-between">
                    <span class="text-base-content/70">{{ t('admin.orders.pack.summary.fulfilledItems') }}</span>
                    <span class="font-mono">
                      {{ formatMoney(livePricing.fulfilledItemsTotal, order.currency) }}
                    </span>
                  </div>

                  <div class="flex justify-between">
                    <span class="text-base-content/70">{{ t('admin.orders.pack.summary.shippingFee') }}</span>
                    <span class="font-mono">
                      {{ formatMoney(livePricing.shippingFee, order.currency) }}
                    </span>
                  </div>

                  <div class="divider my-1"></div>

                  <div class="flex justify-between text-base font-bold">
                    <span>{{ t('admin.orders.pack.summary.actualAmount') }}</span>
                    <span class="font-mono text-primary">
                      {{ formatMoney(livePricing.grandTotal, order.currency) }}
                    </span>
                  </div>

                  <!-- Released / Refunded Funds Notification -->
                  <div
                    v-if="livePricing.releaseAmount > 0"
                    class="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs space-y-1"
                  >
                    <div class="font-bold text-warning-content flex items-center gap-1.5">
                      <Icon name="lucide:corner-down-left" class="size-3.5" />
                      {{ t('admin.orders.pack.summary.releaseAmount') }}
                    </div>
                    <div class="font-mono font-bold text-sm text-warning-content">
                      {{ formatMoney(livePricing.releaseAmount, order.currency) }}
                    </div>
                    <p class="text-[11px] text-base-content/70 leading-relaxed">
                      {{
                        order.paymentProvider === 'STRIPE'
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
                      <span>{{ formatMoney(livePricing.moms12Amount, order.currency) }}</span>
                    </div>
                    <div class="flex justify-between font-mono">
                      <span>{{ t('admin.orders.pack.summary.moms25') }}</span>
                      <span>{{ formatMoney(livePricing.moms25Amount, order.currency) }}</span>
                    </div>
                    <div class="flex justify-between font-mono font-semibold text-base-content border-t border-base-200/50 pt-1">
                      <span>{{ t('admin.orders.pack.summary.totalMoms') }}</span>
                      <span>{{ formatMoney(livePricing.totalMoms, order.currency) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Shortage Action Modal -->
        <dialog ref="shortageDialog" class="modal">
          <div class="modal-box max-w-lg bg-base-100 border border-base-200 shadow-2xl p-6 sm:p-8">
            <h3 class="font-bold text-lg flex items-center gap-2">
              <Icon name="lucide:alert-triangle" class="size-5 text-warning" />
              {{ t('admin.orders.pack.modal.title') }}
            </h3>

            <p class="text-xs text-base-content/70 mt-1">
              {{ getLocalizedName(activeItem?.name) }}
            </p>

            <div class="space-y-6 mt-6">
              <!-- Select Action Type -->
              <div class="form-control">
                <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.actionLabel') }}</label>
                <div class="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="selectedActionType === 'REDUCE_QUANTITY' ? 'bg-brand-600 hover:bg-brand-700 text-white border-brand-600' : 'btn-outline border-brand-500 text-base-content hover:bg-brand-50 hover:border-brand-600 hover:text-brand-800'"
                    @click="selectedActionType = 'REDUCE_QUANTITY'"
                  >
                    {{ t('admin.orders.pack.modal.reduceQty') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="selectedActionType === 'REMOVE_LINE' ? 'bg-error hover:bg-error/90 text-white border-transparent' : 'btn-outline border-base-300 text-base-content'"
                    @click="selectedActionType = 'REMOVE_LINE'"
                  >
                    {{ t('admin.orders.pack.modal.removeLine') }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="selectedActionType === 'SUBSTITUTE_ITEM' ? 'bg-brand-600 hover:bg-brand-700 text-white border-brand-600' : 'btn-outline border-brand-500 text-base-content hover:bg-brand-50 hover:border-brand-600 hover:text-brand-800'"
                    @click="selectedActionType = 'SUBSTITUTE_ITEM'"
                  >
                    {{ t('admin.orders.pack.modal.substituteItem') }}
                  </button>
                </div>
              </div>

              <!-- Option 1: Reduce Quantity Input -->
              <div v-if="selectedActionType === 'REDUCE_QUANTITY'" class="form-control">
                <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.newQty') }}</label>
                <input
                  v-model.number="modalAdjustedQuantity"
                  type="number"
                  min="0"
                  :max="activeItem ? activeItem.quantity - 1 : 0"
                  class="input input-bordered input-sm w-full font-mono"
                />
              </div>

              <!-- Option 2: Substitution Product Search -->
              <div v-if="selectedActionType === 'SUBSTITUTE_ITEM'" class="space-y-3">
                <div class="form-control">
                  <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.searchSubstitute') }}</label>
                  <div class="join w-full">
                    <input
                      v-model="substituteSearchQuery"
                      type="text"
                      :placeholder="t('admin.orders.pack.modal.searchPlaceholder')"
                      class="input input-bordered input-sm join-item w-full"
                      @keydown.enter.prevent="searchSubstitutes"
                    />
                    <button
                      class="btn btn-sm btn-primary join-item text-white"
                      :disabled="isSearchingSubstitute"
                      @click="searchSubstitutes"
                    >
                      <span v-if="isSearchingSubstitute" class="loading loading-spinner loading-xs"></span>
                      <Icon v-else name="lucide:search" class="size-4" />
                    </button>
                  </div>
                </div>

                <!-- Search Results List -->
                <div v-if="substituteResults.length > 0" class="max-h-40 overflow-y-auto border border-base-200 rounded-lg divide-y">
                  <div
                    v-for="prod in substituteResults"
                    :key="prod._id"
                    class="p-2 text-xs flex justify-between items-center cursor-pointer hover:bg-base-200"
                    :class="{ 'bg-primary/10 border-l-4 border-primary': selectedSubstitute?._id === prod._id }"
                    @click="selectSubstituteProduct(prod)"
                  >
                    <div>
                      <div class="font-bold">{{ getLocalizedName(prod.name) }}</div>
                      <div class="text-[10px] text-base-content/50 font-mono">SKU: {{ prod.sku || 'N/A' }}</div>
                    </div>
                    <div class="font-mono font-semibold">
                      {{ formatMoney(prod.price?.[order.currency] ?? prod.price?.SEK ?? 0, order.currency) }}
                    </div>
                  </div>
                </div>

                <div v-if="selectedSubstitute" class="form-control">
                  <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.substituteQty') }}</label>
                  <input
                    v-model.number="modalAdjustedQuantity"
                    type="number"
                    min="1"
                    class="input input-bordered input-sm w-full font-mono"
                  />
                </div>
              </div>

              <!-- Note / Reason -->
              <div class="form-control">
                <label class="label text-xs font-semibold">{{ t('admin.orders.pack.modal.noteLabel') }}</label>
                <textarea
                  v-model="modalNote"
                  rows="2"
                  :placeholder="t('admin.orders.pack.modal.notePlaceholder')"
                  class="textarea textarea-bordered textarea-sm w-full"
                ></textarea>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="modal-action mt-8">
              <button class="btn btn-ghost btn-sm" @click="closeModal">{{ t('admin.orders.pack.modal.cancel') }}</button>
              <button
                class="btn btn-sm bg-brand-600 hover:bg-brand-700 text-white border-transparent disabled:opacity-50"
                :disabled="selectedActionType === 'SUBSTITUTE_ITEM' && !selectedSubstitute"
                @click="applyShortageAction"
              >
                {{ t('admin.orders.pack.modal.apply') }}
              </button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      </template>
    </div>
  </div>
</template>