<!-- pages/checkout/payment.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
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
const activeOrderId = ref<string | null>(null)
const isInitializing = ref(true)
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)
const isCancelling = ref(false)

// Exit & Navigation Guard States (Task 40-48)
const isPaymentCommitted = ref(false)
const hasConfirmedLeave = ref(false)
const isLeaveModalOpen = ref(false)
const pendingRouteTarget = ref<any | null>(null)

// Swish artifacts
const swishQrUrl = ref<string | null>(null)
const swishToken = ref<string | null>(null)

// Stripe instances
let stripe: Stripe | null = null
let elements: StripeElements | null = null

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isPaymentCommitted.value || hasConfirmedLeave.value || !activeOrderReference.value) return

  if (navigator.sendBeacon && activeOrderReference.value) {
    const payload = JSON.stringify({
      orderReference: activeOrderReference.value,
      status: 'ABANDONED',
    })
    const blob = new Blob([payload], { type: 'application/json' })
    navigator.sendBeacon('/api/checkout/cancel-session', blob)
  }

  e.preventDefault()
  e.returnValue = ''
  return ''
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

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

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
})

async function initializeSession(draft: any) {
  isInitializing.value = true
  errorMessage.value = null

  // Safety timer: Don't leave user stuck on spinner if browser network hangs
  let timerId: any = setTimeout(() => {
    if (isInitializing.value) {
      isInitializing.value = false
      errorMessage.value = t(
        'checkout.mountFailed',
        'Kunde inte ansluta till betaltjänsten. Kontrollera din anslutning eller annonsblockerare och försök igen.'
      )
    }
  }, 10000)

  const clearTimer = () => {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  try {
    const activeCurrency = preferences.currency || 'SEK'

    // 1. Check for an active session to prevent re-creating intents on language toggles
    const rawCachedSession = sessionStorage.getItem('siwar_active_payment_session')
    let sessionData: any = null

    if (rawCachedSession) {
      try {
        const cached = JSON.parse(rawCachedSession)
        // Reuse if same provider, currency, storefront language, and exact total
        if (
          cached.provider === provider.value &&
          cached.currency === activeCurrency &&
          cached.locale === locale.value &&
          cached.totalMinor === cartStore.grandTotalMinor
        ) {
          sessionData = cached
        }
      } catch {
        sessionStorage.removeItem('siwar_active_payment_session')
      }
    }

    // 2. Only call backend if no valid cached session exists
    if (!sessionData) {
      sessionData = await $fetch<any>('/api/checkout/create-session', {
        method: 'POST',
        body: {
          provider: provider.value,
          locale: locale.value,
          currency: activeCurrency,
          items: cartStore.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shippingFeeMinor: draft.shippingFeeMinor || 0,
          customer: draft.customer,
        },
      })
      sessionData.locale = locale.value
      // Cache session details
      sessionStorage.setItem('siwar_active_payment_session', JSON.stringify(sessionData))
    }

    activeOrderReference.value = sessionData.orderReference
    activeOrderId.value = sessionData.orderId || null

    // 3. Mount UI artifacts
    if (provider.value === 'SWISH') {
      swishQrUrl.value = sessionData.qrSvgUrl
      swishToken.value = sessionData.swishToken
      clearTimer()
      isInitializing.value = false
    } else if (provider.value === 'STRIPE') {
      const publishableKey = sessionData.publishableKey || (config.public.stripePublishableKey as string)
      if (!publishableKey) {
        throw new Error('Stripe publishable key is missing. Please ensure STRIPE_PUBLISHABLE_KEY is set in your Railway environment variables.')
      }

      stripe = await loadStripe(publishableKey)
      if (!stripe) {
        throw new Error('Could not load Stripe SDK. Please check your network or ad blocker.')
      }

      if (sessionData.clientSecret) {
        // Pass active locale to render Elements in Arabic, Swedish, or English
        const stripeLocale = locale.value === 'ar' ? 'ar' : locale.value === 'sv' ? 'sv' : 'en'
        elements = stripe.elements({
          clientSecret: sessionData.clientSecret,
          locale: stripeLocale,
        })
        const paymentElement = elements.create('payment')

        // Listen for mount errors from Stripe's iframe
        paymentElement.on('loaderror', (event: any) => {
          clearTimer()
          isInitializing.value = false
          console.error('Stripe Payment Element load error:', event?.error)
          const msg = event?.error?.message || ''
          if (msg.toLowerCase().includes('blocked') || msg.toLowerCase().includes('failed to load') || msg.toLowerCase().includes('network')) {
            errorMessage.value = t(
              'checkout.adBlockerWarning',
              'Kunde inte ladda kortbetalningen. Om du använder en annonsblockerare (t.ex. uBlock Origin eller Brave Shields), vänligen inaktivera den för denna sida och försök igen.'
            )
          } else {
            errorMessage.value = msg || t('checkout.stripeTimeoutError', 'Kunde inte starta betalning.')
          }
        })

        // Listen for successful mount ready event
        paymentElement.on('ready', () => {
          clearTimer()
          isInitializing.value = false
        })

        paymentElement.mount('#stripe-element-mount')
      } else {
        clearTimer()
        isInitializing.value = false
        throw new Error('No clientSecret received from Stripe session.')
      }
    }
  } catch (err: any) {
    clearTimer()
    isInitializing.value = false
    console.error('Payment initialization error:', err)
    errorMessage.value =
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      t('checkout.genericError', 'Kunde inte starta betalning.')
  }
}

// Retrying purges any broken cached session and re-requests a clean session
function retryMount() {
  sessionStorage.removeItem('siwar_active_payment_session')
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

  const targetId = activeOrderId.value || activeOrderReference.value || ''
  const returnUrl = targetId
    ? `${window.location.origin}${localePath(`/order/confirmation/${targetId}`)}`
    : `${window.location.origin}${localePath('/order/confirmation')}`

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: returnUrl,
    },
    redirect: 'if_required',
  })

  if (error) {
    errorMessage.value = error.message || t('checkout.cardFailed', 'Kortbetalningen nekades.')
    isProcessing.value = false
  } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
    isPaymentCommitted.value = true
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    cartStore.clearCart()
    sessionStorage.removeItem('siwar_checkout_payload')
    sessionStorage.removeItem('siwar_active_payment_session') // Purge session cache
    const finalId = activeOrderId.value || activeOrderReference.value || paymentIntent.id
    await router.push(localePath(`/order/confirmation/${finalId}`))
  }
}

// Navigation leave guard
onBeforeRouteLeave((to, from, next) => {
  if (isPaymentCommitted.value || hasConfirmedLeave.value || !activeOrderReference.value) {
    return next()
  }
  pendingRouteTarget.value = to
  isLeaveModalOpen.value = true
  next(false)
})

const isAbandoning = ref(false)

async function confirmLeavePayment() {
  isAbandoning.value = true
  try {
    if (activeOrderReference.value) {
      await $fetch('/api/checkout/cancel-session', {
        method: 'POST',
        body: { orderReference: activeOrderReference.value, status: 'ABANDONED' },
      })
    }
  } catch (err) {
    console.error('Error marking session as abandoned:', err)
  } finally {
    hasConfirmedLeave.value = true
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    sessionStorage.removeItem('siwar_checkout_payload')
    sessionStorage.removeItem('siwar_active_payment_session')
    isAbandoning.value = false
    isLeaveModalOpen.value = false
    if (pendingRouteTarget.value) {
      const target = pendingRouteTarget.value
      pendingRouteTarget.value = null
      router.push(target)
    } else {
      router.push(localePath('/kassa'))
    }
  }
}

function cancelLeavePayment() {
  isLeaveModalOpen.value = false
  pendingRouteTarget.value = null
}

const isCancelModalOpen = ref(false)

function openCancelModal() {
  isCancelModalOpen.value = true
}

function closeCancelModal() {
  isCancelModalOpen.value = false
}

async function confirmCancelOrder() {
  isCancelling.value = true
  try {
    if (activeOrderReference.value) {
      await $fetch('/api/checkout/cancel-session', {
        method: 'POST',
        body: { orderReference: activeOrderReference.value, status: 'CANCELLED' },
      })
    }
  } catch (err) {
    console.error('Error cancelling order:', err)
  } finally {
    hasConfirmedLeave.value = true
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    sessionStorage.removeItem('siwar_checkout_payload')
    sessionStorage.removeItem('siwar_active_payment_session') // Purge session cache
    isCancelling.value = false
    isCancelModalOpen.value = false
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
        <div v-show="provider === 'STRIPE'" class="space-y-4">
          <div id="stripe-element-mount" :class="{ 'opacity-0 h-0 overflow-hidden pointer-events-none': isInitializing }"></div>
          <button
            v-if="!isInitializing"
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
            @click="openCancelModal"
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

    <!-- Cancellation Confirmation Modal -->
    <ConfirmModal
      :is-open="isCancelModalOpen"
      :title="t('checkout.cancelModalTitle', 'Avbryta beställning?')"
      :message="t('checkout.cancelModalWarning', 'Är du säker på att du vill avbryta din betalningssession?')"
      icon="lucide:alert-triangle"
      variant="danger"
      :confirm-text="t('checkout.confirmCancelOrder', 'Avbryt beställning')"
      :cancel-text="t('checkout.keepShopping', 'Fortsätt handla')"
      :is-submitting="isCancelling"
      confirm-icon="lucide:x-circle"
      @confirm="confirmCancelOrder"
      @close="closeCancelModal"
    />

    <!-- Leave Payment Navigation Confirmation Modal -->
    <ConfirmModal
      :is-open="isLeaveModalOpen"
      :title="t('checkout.leavePaymentModalTitle', 'Lämna betalningen?')"
      :message="t('checkout.leavePaymentWarning', 'Är du säker på att du vill lämna betalningen? Din beställning är inte slutförd ännu.')"
      icon="lucide:alert-triangle"
      variant="warning"
      :confirm-text="t('checkout.confirmLeavePayment', 'Lämna sidan')"
      :cancel-text="t('checkout.stayOnPayment', 'Stanna kvar')"
      :is-submitting="isAbandoning"
      confirm-icon="lucide:log-out"
      @confirm="confirmLeavePayment"
      @close="cancelLeavePayment"
    />
  </div>
</template>