<!-- pages/checkout/payment.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'
import type { PaymentProviderType } from '~/types/payment'

const cartStore = useCartStore()
const preferences = usePreferencesStore()
const config = useRuntimeConfig()
const router = useRouter()
const localePath = useLocalePath()
const { t, locale } = useI18n()

const provider = ref<PaymentProviderType>('STRIPE')
const activeOrderReference = ref<string | null>(null)
const isInitializing = ref(true)
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)
const isCancelling = ref(false)

// Swish artifacts
const swishQrUrl = ref<string | null>(null)
const swishToken = ref<string | null>(null)

// Stripe instances
let stripe: Stripe | null = null
let elements: StripeElements | null = null

onMounted(async () => {
  cartStore.hydrateCart()
  if (cartStore.items.length === 0) {
    return router.replace(localePath('/catalog'))
  }

  const rawDraft = sessionStorage.getItem('siwar_checkout_payload')
  if (!rawDraft) {
    return router.replace(localePath('/kassa'))
  }

  const draft = JSON.parse(rawDraft)
  provider.value = draft.paymentMethod || 'STRIPE'

  await initializeSession(draft)
})

async function initializeSession(draft: any) {
  isInitializing.value = true
  errorMessage.value = null


  // Safety timer: Don't leave user stuck on spinner if browser network hangs
  const mountTimer = setTimeout(() => {
    if (isInitializing.value) {
      isInitializing.value = false
      errorMessage.value = t(
        'checkout.mountFailed',
        'Kunde inte ansluta till betaltjänsten. Kontrollera din anslutning och försök igen.'
      )
    }
  }, 8000)

  try {
    const activeCurrency = preferences.currency || 'SEK'

    // 1. Check for an active session to prevent re-creating intents on language toggles
    /**
     * Before adding this check, we had an issue where if a user switches languages multiple times
     * while on the payment page, a new payment intent was created for each language switch.
     * This resulted in a lot of "failed" payment attempts in the Stripe dashboard.
     * 
     * By checking for an existing session, we can restore the state and prevent this issue.
     * 
     * Note: We intentionally do not save the order in the draft to avoid this issue,
     * and also because we want to use the session data from the session creation API,
     * which includes the correct locale.
     */
    const rawCachedSession = sessionStorage.getItem('siwar_active_payment_session')
    let sessionData: any = null

    if (rawCachedSession) {
      const cached = JSON.parse(rawCachedSession)
      // Reuse if same provider and currency
      if (cached.provider === provider.value && cached.currency === activeCurrency) {
        sessionData = cached
      }
    }

    // 2. Only call backend if no valid cached session exists
    if (!sessionData) {
      sessionData = await $fetch<any>('/api/checkout/create-session', {
        method: 'POST',
        body: {
          provider: provider.value,
          currency: activeCurrency,
          items: cartStore.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shippingFeeMinor: draft.shippingFeeMinor || 0,
          customer: draft.customer,
        },
      })
      // Cache session details
      sessionStorage.setItem('siwar_active_payment_session', JSON.stringify(sessionData))
    }

    activeOrderReference.value = sessionData.orderReference

    // 3. Mount UI artifacts
    if (provider.value === 'SWISH') {
      swishQrUrl.value = sessionData.qrSvgUrl
      swishToken.value = sessionData.swishToken
    } else if (provider.value === 'STRIPE') {
      stripe = await loadStripe(config.public.stripePublishableKey)
      if (stripe && sessionData.clientSecret) {
        // Pass active locale to render Elements in Arabic, Swedish, or English
        const stripeLocale = locale.value === 'ar' ? 'ar' : locale.value === 'sv' ? 'sv' : 'en'
        elements = stripe.elements({
          clientSecret: sessionData.clientSecret,
          locale: stripeLocale,
        })
        const paymentElement = elements.create('payment')

        // Listen for mount errors from Stripe's iframe
        paymentElement.on('loaderror', (event) => {
          clearTimeout(mountTimer)
          isInitializing.value = false
          errorMessage.value = event.error.message || t('checkout.stripeTimeoutError', 'Kunde inte starta betalning.')
        })

        paymentElement.mount('#stripe-element-mount')
      }
    }
  } catch (err: any) {
    errorMessage.value = err.statusMessage || t('checkout.genericError', 'Kunde inte starta betalning.')
  } finally {
    isInitializing.value = false
  }
}


// Retrying just re-runs initializeSession with the SAME draft payload
// It will find the existing session in sessionStorage and simply re-attempt the mount
function retryMount() {
  const rawDraft = sessionStorage.getItem('siwar_checkout_payload')
  if (rawDraft) {
    initializeSession(JSON.parse(rawDraft))
  } else {
    router.replace(localePath('/kassa'))
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
    cartStore.clearCart()
    sessionStorage.removeItem('siwar_checkout_payload')
    sessionStorage.removeItem('siwar_active_payment_session') // Purge session cache
    await router.push(localePath(`/order/confirmation?intent_id=${paymentIntent.id}`))
  }
}


async function handleCancelOrder() {
  if (!confirm(t('checkout.confirmCancel', 'Är du säker på att du vill avbryta köpet?'))) {
    return
  }

  isCancelling.value = true
  try {
    if (activeOrderReference.value) {
      await $fetch('/api/checkout/cancel-session', {
        method: 'POST',
        body: { orderReference: activeOrderReference.value },
      })
    }
  } catch (err) {
    console.error('Error cancelling order:', err)
  } finally {
    sessionStorage.removeItem('siwar_checkout_payload')
    sessionStorage.removeItem('siwar_active_payment_session') // Purge session cache
    isCancelling.value = false
    await router.push(localePath('/catalog'))
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 py-10 px-4 sm:px-6 lg:px-8">
    <div class="max-w-xl mx-auto space-y-6">
      <!-- Header with back navigation -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-black text-base-content">
          {{ provider === 'SWISH' ? 'Swish Handel' : t('checkout.cardPayment', 'Kortbetalning') }}
        </h1>
        <NuxtLink :to="localePath('/kassa')" class="btn btn-ghost btn-sm text-base-content/80 hover:bg-base-200 hover:text-base-content transition-colors">
          {{ t('checkout.changeMethod', '← Ändra betalsätt') }}
        </NuxtLink>
      </div>

      <!-- Payment Form Container -->
      <div class="card bg-base-100 border border-base-200 p-6 shadow-sm">
        <div v-if="isInitializing" class="flex flex-col items-center justify-center py-10 space-y-2">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="text-xs text-base-content/60">{{ t('checkout.initializing', 'Initierar betalning...') }}</span>
        </div>

        <!-- Stripe Element Container -->
        <div v-show="provider === 'STRIPE' && !isInitializing" class="space-y-4">
          <div id="stripe-element-mount"></div>
          <button
            type="button"
            class="btn btn-md w-full !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-none font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
            :disabled="isProcessing"
            @click="handleConfirmCardPayment"
          >
            <span v-if="isProcessing" class="loading loading-spinner loading-sm"></span>
            <span v-else>{{ t('checkout.authorizePayment', 'Slutför reservation') }}</span>
          </button>
        </div>

        <!-- Swish QR Code Container -->
        <div v-if="provider === 'SWISH' && !isInitializing" class="flex flex-col items-center text-center py-4 space-y-4">
          <div class="text-sm font-semibold text-base-content">
            {{ t('checkout.scanSwishQR', 'Skanna QR-koden med Swish-appen') }}
          </div>
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

        <!-- Secondary Cancel Action -->
        <div class="pt-2">
          <button
            type="button"
            class="btn btn-ghost w-full text-base-content/60 hover:bg-error hover:text-error-content transition-colors"
            :disabled="isProcessing || isCancelling"
            @click="handleCancelOrder"
          >
            <span v-if="isCancelling" class="loading loading-spinner loading-xs"></span>
            <span v-else>{{ t('checkout.cancelOrder', 'Avbryt beställning och återgå till butiken') }}</span>
          </button>
        </div>
        <!-- Error message with retry -->
        <div v-if="errorMessage" class="alert alert-error text-xs mt-4 flex items-center justify-between">
          <span>{{ errorMessage }}</span>
          <button
            type="button"
            class="btn btn-xs btn-outline border-error-content/40 hover:bg-error-content/10 shrink-0 ml-2"
            @click="retryMount"
          >
            {{ t('checkout.retry', 'Försök igen') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>