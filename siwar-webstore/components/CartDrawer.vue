<!-- components/CartDrawer.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore, type CartItem } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

const cartStore = useCartStore()
const preferences = usePreferencesStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()

// Localized toast notification for inventory boundary breaches (AC-1)
const warningMessage = ref<string | null>(null)
let warningTimer: ReturnType<typeof setTimeout> | null = null

function showWarning(messageKey: string, params: Record<string, any> = {}) {
  warningMessage.value = t(messageKey, params)
  if (warningTimer) clearTimeout(warningTimer)
  warningTimer = setTimeout(() => {
    warningMessage.value = null
  }, 4000)
}

// Multilingual title resolver
function getLocalized(field?: { ar?: string; sv?: string; en?: string }): string {
  if (!field) return ''
  const current = field[locale.value as 'ar' | 'sv' | 'en']
  return current || field.sv || field.en || field.ar || ''
}

// Format minor integer currency units
function formatPrice(minorUnits: number): string {
  const major = (minorUnits / 100).toFixed(2)
  return preferences.currency === 'SEK' ? `${major.replace('.', ',')} kr` : `${major} ${preferences.currency}`
}

// AC-1: Stepper actions enforcing online available stock
function handleIncrement(item: CartItem) {
  const result = cartStore.incrementQuantity(item.productId)
  if (result === 'EXCEEDS_AVAILABLE_STOCK') {
    showWarning('cart.validation.EXCEEDS_AVAILABLE_STOCK', { count: item.availableStock })
  }
}

function handleDecrement(item: CartItem) {
  cartStore.decrementQuantity(item.productId)
}

function handleRemove(productId: string) {
  cartStore.removeItem(productId)
}

function closeDrawer() {
  cartStore.toggleDrawer(false)
}

function proceedToCheckout() {
  closeDrawer()
  navigateTo(localePath('/kassa'))
}
</script>

<!-- components/CartDrawer.vue -->
<template>
  <!-- Full Screen Teleport to avoid navbar / layout stacking context traps -->
  <Teleport to="body">
    <div
      v-if="cartStore.isDrawerOpen"
      class="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <!-- Backdrop Overlay (closes on click) -->
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        @click="closeDrawer"
      ></div>

      <!-- Slide-Over Drawer Panel -->
      <aside
        class="relative w-full sm:w-[440px] h-full bg-base-100 text-base-content shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-in-out ltr:animate-slide-in-right rtl:animate-slide-in-left"
      >
        <!-- Drawer Header -->
        <header class="flex items-center justify-between p-4 sm:p-5 border-b border-base-200">
          <div class="flex items-center gap-2">
            <Icon name="lucide:shopping-bag" class="size-5 text-primary" />
            <h2 class="text-lg font-bold">
              {{ t('cart.title', 'Varukorg') }}
              <span class="text-sm font-normal text-base-content/60">
                ({{ cartStore.totalItemCount }})
              </span>
            </h2>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-circle btn-sm"
            @click="closeDrawer"
          >
            <Icon name="lucide:x" class="size-5" />
          </button>
        </header>

        <!-- AC-1: Stock Boundary Warning Alert Banner -->
        <div v-if="warningMessage" class="p-3">
          <div class="alert alert-warning text-xs py-2 shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="lucide:alert-triangle" class="size-4 shrink-0" />
              <span>{{ warningMessage }}</span>
            </div>
            <button
              type="button"
              @click="warningMessage = null"
              class="btn btn-ghost btn-xs btn-circle"
            >
              <Icon name="lucide:x" class="size-3" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="cartStore.items.length === 0"
          class="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <div class="size-20 rounded-full bg-base-200 flex items-center justify-center mb-4">
            <Icon name="lucide:shopping-cart" class="size-10 text-base-content/30" />
          </div>
          <p class="font-bold text-base">{{ t('cart.emptyTitle', 'Din varukorg är tom') }}</p>
          <p class="text-xs text-base-content/60 mt-1 max-w-xs">
            {{ t('cart.emptySubtitle', 'Upptäck vårt sortiment av kryddor, sötsaker och delikatesser.') }}
          </p>
          <button
            type="button"
            class="btn btn-primary btn-sm mt-6 text-white"
            @click="closeDrawer(); navigateTo(localePath('/catalog'))"
          >
            {{ t('cart.exploreCatalog', 'Utforska sortimentet') }}
          </button>
        </div>

        <!-- Active Cart Item List -->
        <div v-else class="flex-1 overflow-y-auto divide-y divide-base-200 p-4 space-y-4">
          <div
            v-for="item in cartStore.items"
            :key="item.productId"
            class="flex gap-3 pt-3 first:pt-0"
          >
            <!-- Thumbnail Image -->
            <div class="relative size-20 shrink-0 rounded-lg bg-base-200 overflow-hidden border border-base-200">
              <img
                v-if="item.thumbnailUrl"
                :src="item.thumbnailUrl"
                :alt="getLocalized(item.name)"
                class="size-full object-cover"
                loading="lazy"
              />
              <div v-else class="size-full flex items-center justify-center text-base-content/30">
                <Icon name="lucide:image" class="size-6" />
              </div>
            </div>

            <!-- Item Details & Stepper -->
            <div class="flex-1 flex flex-col justify-between min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-sm font-semibold truncate text-base-content">
                  {{ getLocalized(item.name) }}
                </h3>
                <button
                  type="button"
                  class="text-base-content/40 hover:text-error transition-colors p-0.5"
                  @click="handleRemove(item.productId)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </button>
              </div>

              <!-- Unit Price & Moms Tier -->
              <div class="text-xs text-base-content/60">
                {{ formatPrice(item.price[preferences.currency] ?? item.price.SEK) }}
                <span class="text-[10px] text-base-content/40">({{ item.momsRate }}% moms)</span>
              </div>

              <!-- Quantity Controls & Line Total -->
              <div class="flex items-center justify-between mt-2">
                <div class="join border border-base-300 rounded-lg">
                  <button
                    type="button"
                    class="join-item btn btn-xs btn-ghost px-2"
                    @click="handleDecrement(item)"
                  >
                    -
                  </button>
                  <span class="join-item px-3 flex items-center text-xs font-bold">
                    {{ item.quantity }}
                  </span>
                  <button
                    type="button"
                    class="join-item btn btn-xs btn-ghost px-2"
                    :disabled="item.quantity >= item.availableStock"
                    @click="handleIncrement(item)"
                  >
                    +
                  </button>
                </div>

                <div class="font-bold text-sm text-base-content">
                  {{ formatPrice((item.price[preferences.currency] ?? item.price.SEK) * item.quantity) }}
                </div>
              </div>
            </div>
          </div>
        </div>

<!-- Drawer Footer: Subtotals, Shipping, Threshold, Separated VAT & Grand Total -->
<footer v-if="cartStore.items.length > 0" class="border-t border-base-200 p-4 sm:p-5 bg-base-100 space-y-4">
  <!-- 1. Primary Line Item Subtotal & Shipping Fees -->
  <div class="space-y-2 text-sm">
    <!-- 1.1 Subtotal (Without shipping or moms) -->
    <div class="flex justify-between items-center text-base-content/80">
      <span>{{ t('cart.subtotalNet', 'Delsumma (exkl. moms)') }}</span>
      <span class="font-medium text-base-content">{{ formatPrice(cartStore.productsNetMinor) }}</span>
    </div>

    <!-- 1.2 Shipping Cost with Gross Weight -->
    <div class="flex justify-between items-center text-base-content/80">
      <div class="flex items-center gap-1.5">
        <span>{{ t('cart.shipping', 'Frakt') }}</span>
        <span class="badge badge-ghost badge-xs font-mono text-[10px] text-base-content/60">
          {{ (cartStore.totalGrossWeightGrams / 1000).toFixed(1) }} kg
        </span>
      </div>
      <span :class="cartStore.shippingFeeMinor === 0 ? 'text-success font-bold' : 'font-medium text-base-content'">
        {{ cartStore.shippingFeeMinor === 0 ? t('cart.free', 'Gratis') : formatPrice(cartStore.shippingFeeMinor) }}
      </span>
    </div>
  </div>

  <!-- 2. Free Shipping Eligibility Banner -->
  <div
    class="rounded-xl p-3 text-xs flex items-center gap-2.5 transition-colors border"
    :class="cartStore.isFreeShippingQualified
      ? 'bg-success/10 border-success/30 text-success'
      : 'bg-primary/5 border-primary/20 text-base-content/80'"
  >
    <Icon
      :name="cartStore.isFreeShippingQualified ? 'lucide:check-circle-2' : 'lucide:truck'"
      class="size-4 shrink-0 text-primary"
    />
    <div class="flex-1 font-medium leading-tight">
      <span v-if="cartStore.isFreeShippingQualified" class="font-bold text-success">
        {{ t('cart.freeShippingReached') }}
      </span>
      <span v-else>
        {{ t('cart.addMoreForFreeShipping', { amount: formatPrice(cartStore.remainingForFreeShippingMinor) }) }}
      </span>
    </div>
  </div>

  <!-- 3. Explicit VAT / Moms Audit Section -->
  <div class="rounded-xl bg-base-200/50 border border-base-200 p-3 space-y-1.5 text-xs">
    <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/40 mb-1">
      {{ t('cart.momsHeading', 'Momsöversikt') }}
    </div>

    <!-- 12% Food Items Moms -->
    <div v-if="cartStore.momsBreakdown.itemsMoms12Minor > 0" class="flex justify-between text-base-content/70">
      <span>{{ t('cart.moms12', 'Moms på livsmedel (12%)') }}</span>
      <span class="font-mono">{{ formatPrice(cartStore.momsBreakdown.itemsMoms12Minor) }}</span>
    </div>

    <!-- 25% General Merchandise Items Moms (Only rendered if 25% products exist in cart) -->
    <div v-if="cartStore.momsBreakdown.itemsMoms25Minor > 0" class="flex justify-between text-base-content/70">
      <span>{{ t('cart.moms25Items', 'Moms på varor (25%)') }}</span>
      <span class="font-mono">{{ formatPrice(cartStore.momsBreakdown.itemsMoms25Minor) }}</span>
    </div>

    <!-- 25% Shipping Moms (Explicitly shown separately whenever shipping is applied) -->
    <div v-if="cartStore.shippingFeeMinor > 0" class="flex justify-between text-base-content/70">
      <span>{{ t('cart.moms25Shipping', 'Moms på frakt (25%)') }}</span>
      <span class="font-mono">{{ formatPrice(cartStore.momsBreakdown.shippingMoms25Minor) }}</span>
    </div>

    <!-- Consolidated Total Moms (Varav moms totalt) -->
    <div class="border-t border-base-300 pt-1.5 mt-1 flex justify-between font-semibold text-base-content">
      <span>{{ t('cart.totalMoms', 'Varav moms totalt') }}</span>
      <span class="font-mono font-bold">{{ formatPrice(cartStore.momsBreakdown.totalMomsMinor) }}</span>
    </div>
  </div>

  <!-- 4. Grand Total -->
  <div class="pt-1 flex justify-between items-baseline">
    <div class="flex flex-col">
      <span class="text-sm font-bold text-base-content">{{ t('cart.grandTotal', 'Totalt att betala') }}</span>
      <span class="text-[11px] text-base-content/50 leading-none">Inkl. moms & frakt</span>
    </div>
    <span class="text-xl font-black text-primary font-mono tracking-tight">
      {{ formatPrice(cartStore.grandTotalMinor) }}
    </span>
  </div>

  <!-- 5. Checkout CTA Button -->
  <button
    type="button"
    class="w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
    @click="proceedToCheckout"
  >
    <span>{{ t('cart.checkoutBtn') }}</span>
    <Icon name="lucide:arrow-right" class="size-5 rtl:rotate-180" />
  </button>
</footer>
      </aside>
    </div>
  </Teleport>
</template>