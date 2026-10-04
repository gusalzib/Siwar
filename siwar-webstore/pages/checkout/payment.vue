<!-- pages/checkout/payment.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'
import { useCartStore } from '../../stores/cart'
import { usePreferencesStore } from '../../stores/preferences'
import type { PaymentProviderType } from '../../types/payment'

const cartStore = useCartStore()
const preferences = usePreferencesStore()
const config = useRuntimeConfig()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()

const selectedMethod = ref<PaymentProviderType>('STRIPE')
const isInitializing = ref(false)
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)

// Swish session state (AC-3)
const swishQrUrl = ref<string | null>(null)
const swishToken = ref<string | null>(null)

// Stripe session state
let stripe: Stripe | null = null
let elements: StripeElements | null = null
const stripeClientSecret = ref<string | null>(null)

// AC-1: Swish strictly available in SEK
const isSwishAllowed = computed(() => preferences.currency === 'SEK')

onMounted(async () => {
  cartStore.hydrateCart()
  if (cartStore.items.length === 0) {
    return router.replace(localePath('/catalog'))
  }

  if (!isSwishAllowed.value) {
    selectedMethod.value = 'STRIPE'
  }

  await initializeSession()
})

async function initializeSession() {
  isInitializing.value = true
  errorMessage.value = null
  swishQrUrl.value = null

  try {
    const rawDraft = sessionStorage.getItem('siwar_checkout_payload')
    const draft = rawDraft ? JSON.parse(rawDraft) : { customer: {}, shippingFeeMinor: 0 }

    const response = await $fetch<any>('/api/checkout/create-session', {
      method: 'POST',
      body: {
        provider: selectedMethod.value,
        currency: preferences.currency || 'SEK',
        items: cartStore.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingFeeMinor: draft.shippingFeeMinor || 0,
        customer: draft.customer,
      },
    })

    if (selectedMethod.value === 'SWISH') {
      swishQrUrl.value = response.qrSvgUrl
      swishToken.value = response.swishToken
    } else if (selectedMethod.value === 'STRIPE') {
      stripeClientSecret.value = response.clientSecret
      stripe = await loadStripe(config.public.stripePublishableKey)
      if (stripe && stripeClientSecret.value) {
        elements = stripe.elements({ clientSecret: stripeClientSecret.value })
        const paymentElement = elements.create('payment')
        paymentElement.mount('#stripe-element-mount')
      }
    }
  } catch (err: any) {
    errorMessage.value = err.statusMessage || t('checkout.genericError', 'Kunde inte starta betalning.')
  } finally {
    isInitializing.value = false
  }
}

async function handleConfirmCardPayment() {
  if (!stripe || !elements || isProcessing.value) return
  isProcessing.value = true
  errorMessage.value = null

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}${localePath('/order/confirmation')}`,
    },
    redirect: 'if_required',
  })

  if (error) {
    errorMessage.value = error.message || t('checkout.cardFailed', 'Kortbetalningen nekades.')
    isProcessing.value = false
  } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
    // AC-2: Funds successfully held
    cartStore.clearCart()
    sessionStorage.removeItem('siwar_checkout_payload')
    await router.push(localePath(`/order/confirmation?intent_id=${paymentIntent.id}`))
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 py-10 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-black text-base-content">{{ t('checkout.choosePayment', 'Välj betalsätt') }}</h1>

      <!-- Method Toggles -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Stripe Option -->
        <label
          class="card border-2 p-4 cursor-pointer flex flex-row items-center justify-between"
          :class="selectedMethod === 'STRIPE' ? 'border-primary bg-primary/5' : 'border-base-200'"
        >
          <div class="flex items-center gap-3">
            <input
              type="radio"
              value="STRIPE"
              v-model="selectedMethod"
              @change="initializeSession"
              class="radio radio-primary radio-sm"
            />
            <div>
              <div class="font-bold text-sm">{{ t('checkout.cardPayment', 'Kortbetalning') }}</div>
              <div class="text-xs text-base-content/60">SEK, EUR, USD</div>
            </div>
          </div>
          <Icon name="lucide:credit-card" class="size-6 text-primary" />
        </label>

        <!-- Swish Option (AC-1) -->
        <label
          class="card border-2 p-4 flex flex-row items-center justify-between"
          :class="[
            !isSwishAllowed ? 'opacity-40 cursor-not-allowed bg-base-200/50' : 'cursor-pointer',
            selectedMethod === 'SWISH' ? 'border-primary bg-primary/5' : 'border-base-200'
          ]"
        >
          <div class="flex items-center gap-3">
            <input
              type="radio"
              value="SWISH"
              v-model="selectedMethod"
              :disabled="!isSwishAllowed"
              @change="initializeSession"
              class="radio radio-primary radio-sm"
            />
            <div>
              <div class="font-bold text-sm">Swish Handel</div>
              <div class="text-xs text-base-content/60">
                {{ isSwishAllowed ? t('checkout.swishAvailable', 'Endast i SEK') : t('checkout.swishSEKOnly', 'Endast tillgängligt i SEK') }}
              </div>
            </div>
          </div>
          <!-- <img src="/icons/swish-logo.svg" alt="Swish" class="h-6 w-auto" /> -->
           <div class="flex items-center gap-1.5 font-black text-sm tracking-tight text-[#EC663C]">
                <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
                        fill="#EC663C"
                        fill-opacity="0.1"
                    />
                    <path
                        d="M7.5 13.5C7.5 11.57 9.07 10 11 10H16.5M16.5 10.5C16.5 12.43 14.93 14 13 14H7.5"
                        stroke="#EC663C"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                <span class="text-xs uppercase font-extrabold text-base-content/80">Swish</span>
            </div>
        </label>
      </div>

      <!-- Payment Containers -->
      <div class="card bg-base-100 border border-base-200 p-6 shadow-sm">
        <div v-if="isInitializing" class="flex flex-col items-center justify-center py-10 space-y-2">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="text-xs text-base-content/60">{{ t('checkout.initializing', 'Initierar betalning...') }}</span>
        </div>

        <!-- Stripe Element (AC-2 & SAQ A) -->
        <div v-show="selectedMethod === 'STRIPE' && !isInitializing" class="space-y-4">
          <div id="stripe-element-mount"></div>
          <button
            type="button"
            class="btn btn-primary w-full text-white font-bold"
            :disabled="isProcessing"
            @click="handleConfirmCardPayment"
          >
            <span v-if="isProcessing" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ t('checkout.authorizePayment', 'Slutför reservation') }}</span>
          </button>
        </div>

        <!-- Swish QR Code Container (AC-3) -->
        <div v-if="selectedMethod === 'SWISH' && !isInitializing" class="flex flex-col items-center text-center py-4 space-y-4">
          <div class="text-sm font-semibold text-base-content">{{ t('checkout.scanSwishQR', 'Skanna QR-koden med Swish-appen') }}</div>
          <div v-if="swishQrUrl" class="p-3 bg-white border border-base-300 rounded-xl shadow-sm">
            <img :src="swishQrUrl" alt="Swish BankID QR" class="size-60" />
          </div>
          <a
            v-if="swishToken"
            :href="`swish://paymentrequest?token=${swishToken}`"
            class="btn btn-outline btn-sm sm:hidden w-full mt-2"
          >
            {{ t('checkout.openSwishApp', 'Öppna Swish') }}
          </a>
        </div>

        <!-- Error Banner -->
        <div v-if="errorMessage" class="alert alert-error text-xs mt-4">
          <span>{{ errorMessage }}</span>
        </div>
      </div>
    </div>
  </div>
</template>