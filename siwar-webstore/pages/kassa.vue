<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '~/stores/cart'
import { usePreferencesStore } from '~/stores/preferences'

// Nuxt / Routing setup
const router = useRouter()
const cartStore = useCartStore()
const preferences = usePreferencesStore()
const { t, locale } = useI18n()
const localePath = useLocalePath()

// Helper to safely resolve multilingual text without indexing errors
type SupportedLocale = 'ar' | 'sv' | 'en'

// Ensure cart is hydrated on mount
onMounted(() => {
  cartStore.hydrateCart()
  // Redirect to catalog if cart is empty
  if (cartStore.items.length === 0) {
    router.replace('/catalog')
  }
})

function getLocalized(text?: { ar?: string; sv?: string; en?: string }): string {
  if (!text) return ''
  const current = locale.value as SupportedLocale
  return text[current] || text.sv || text.ar || text.en || ''
}

// ---------------------------------------------------------------------------
// Checkout Form State
// ---------------------------------------------------------------------------
export type FulfillmentMethod = 'DELIVERY' | 'PICKUP'

const fulfillmentMethod = ref<FulfillmentMethod>('DELIVERY')

const form = ref({
  fullName: '',
  email: '',
  phone: '',
  // Address fields (Conditional on DELIVERY)
  streetAddress: '',
  postalCode: '',
  city: '',
  // Legal consent (AC-3)
  acceptedTerms: false,
})

const isSubmitting = ref(false)
const stockErrorMessage = ref<string | null>(null)
const touched = ref<Record<string, boolean>>({})

function markTouched(field: string) {
  touched.value[field] = true
}

// ---------------------------------------------------------------------------
// Pricing & Tax Calculations (AC-2 & FR-6)
// ---------------------------------------------------------------------------
/**
 * Effective shipping fee in minor units:
 * 0 if In-Store Pickup is chosen, otherwise uses cartStore shipping fee.
 */
const effectiveShippingFeeMinor = computed<number>(() => {
  if (fulfillmentMethod.value === 'PICKUP') {
    return 0
  }
  return cartStore.shippingFeeMinor
})

/**
 * Explicit 25% Moms included in shipping:
 * round(gross * 25 / 125) -> satisfies AC-2 (e.g., 69 SEK -> 13.80 SEK moms)
 */
const effectiveShippingMomsMinor = computed<number>(() => {
  if (effectiveShippingFeeMinor.value <= 0) return 0
  return Math.round((effectiveShippingFeeMinor.value * 25) / 125)
})

/**
 * Net shipping fee excluding moms
 */
const effectiveShippingNetMinor = computed<number>(() => {
  return effectiveShippingFeeMinor.value - effectiveShippingMomsMinor.value
})

/**
 * Consolidated Grand Total (Products Subtotal + Effective Shipping)
 */
const checkoutGrandTotalMinor = computed<number>(() => {
  return cartStore.cartSubtotalMinor + effectiveShippingFeeMinor.value
})

/**
 * Consolidated Moms Total (Items Moms + Effective Shipping Moms)
 */
const checkoutTotalMomsMinor = computed<number>(() => {
  return (
    cartStore.momsBreakdown.itemsMoms12Minor +
    cartStore.momsBreakdown.itemsMoms25Minor +
    effectiveShippingMomsMinor.value
  )
})

// ---------------------------------------------------------------------------
// Form Validation (AC-1 & AC-3)
// ---------------------------------------------------------------------------
const isNameValid = computed(() => form.value.fullName.trim().length >= 2)
const isEmailValid = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())
)
const isPhoneValid = computed(() =>
  /^[+0-9\s-]{7,15}$/.test(form.value.phone.trim())
)

const isStreetValid = computed(() => {
  if (fulfillmentMethod.value === 'PICKUP') return true
  return form.value.streetAddress.trim().length >= 3
})

const isPostalCodeValid = computed(() => {
  if (fulfillmentMethod.value === 'PICKUP') return true
  // Swedish postal code format validation (5 digits, optional whitespace)
  return /^\d{3}\s?\d{2}$/.test(form.value.postalCode.trim())
})

const isCityValid = computed(() => {
  if (fulfillmentMethod.value === 'PICKUP') return true
  return form.value.city.trim().length >= 2
})

/**
 * Form validity check:
 * Enforces recipient details + legal consent checkbox (AC-3) + conditional address (AC-1)
 */
const isFormComplete = computed(() => {
  const baseValid =
    isNameValid.value &&
    isEmailValid.value &&
    isPhoneValid.value &&
    form.value.acceptedTerms

  if (fulfillmentMethod.value === 'PICKUP') {
    return baseValid
  }

  return (
    baseValid &&
    isStreetValid.value &&
    isPostalCodeValid.value &&
    isCityValid.value
  )
})

// ---------------------------------------------------------------------------
// Currency Formatter Helper
// ---------------------------------------------------------------------------
function formatPrice(minorUnits: number): string {
  const curr = preferences.currency || 'SEK'
  const major = minorUnits / 100
  const activeLocale = locale.value === 'ar' ? 'ar-EG' : 'sv-SE'

  return new Intl.NumberFormat(activeLocale, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(major)
}

// ---------------------------------------------------------------------------
// Pre-Checkout Stock Gate & Submission
// ---------------------------------------------------------------------------
async function handleProceedToPayment() {
  if (!isFormComplete.value || isSubmitting.value) return

  isSubmitting.value = true
  stockErrorMessage.value = null

  try {
    // 1. Atomic Pre-Checkout Inventory Boundary Check (AC-3 from Issue #4)
    const validationPayload = {
      items: cartStore.items.map((item) => ({
        productId: item.productId,
        requestedQuantity: item.quantity,
      })),
    }

    const checkRes = await $fetch<{ isValid: boolean; summaryMessage?: string }>(
      '/api/checkout/validate-stock',
      {
        method: 'POST',
        body: validationPayload,
      }
    ).catch((err) => {
      if (err.statusCode === 409) {
        return err.data
      }
      throw err
    })

    if (!checkRes.isValid) {
      stockErrorMessage.value = t(
        'checkout.stockAdjustedWarning',
        'Vissa varors lagersaldo ändrades i butiken. Varukorgen har justerats.'
      )
      return
    }

    // 2. Ready to pass payload to payment gateway initialization (Issue #10)
    // Save draft checkout order details into session or state
    sessionStorage.setItem(
      'siwar_checkout_payload',
      JSON.stringify({
        customer: {
          fullName: form.value.fullName,
          email: form.value.email,
          phone: form.value.phone,
          fulfillmentMethod: fulfillmentMethod.value,
          address:
            fulfillmentMethod.value === 'DELIVERY'
              ? {
                  street: form.value.streetAddress,
                  postalCode: form.value.postalCode,
                  city: form.value.city,
                }
              : null,
        },
        shippingFeeMinor: effectiveShippingFeeMinor.value,
      })
    )

    // Route to payment selection or trigger payment modal
    await router.push('/checkout/payment')
  } catch (error: any) {
    stockErrorMessage.value =
      error?.statusMessage ||
      t('checkout.genericError', 'Ett oväntat fel inträffade. Försök igen.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <!-- Breadcrumbs -->
      <nav class="text-sm breadcrumbs mb-8 mt-2 overflow-visible">
        <ul class="!flex flex-col sm:!flex-row flex-wrap gap-2 w-full">
          <li class="w-full sm:w-auto">
            <NuxtLink :to="localePath('/')" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
              <Icon name="lucide:home" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('nav.home') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <NuxtLink :to="localePath('/catalog')" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
              <Icon name="lucide:shopping-bag" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('checkout.continueShopping') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:credit-card" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('checkout.title') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Page Title -->
      <div class="mb-8">
        <h1 class="text-3xl font-black tracking-tight text-base-content">
          {{ t('checkout.title', 'Kassa') }}
        </h1>
        <p class="text-sm text-base-content/70 mt-1">
          {{ t('checkout.subtitle', 'Slutför ditt köp snabbt och säkert.') }}
        </p>
      </div>

      <!-- Out-of-Stock Drift Alert Banner -->
      <div
        v-if="stockErrorMessage"
        class="alert alert-warning mb-6 shadow-sm border border-warning/30 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <Icon name="lucide:alert-triangle" class="size-5 shrink-0" />
          <span class="text-sm font-semibold">{{ stockErrorMessage }}</span>
        </div>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          @click="stockErrorMessage = null"
        >
          ✕
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- ================================================================= -->
        <!-- Left Column: Fulfillment & Customer Form                          -->
        <!-- ================================================================= -->
        <div class="lg:col-span-7 space-y-6">
          <!-- 1. Fulfillment Method Selector (AC-1) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm p-5 sm:p-6">
            <h2 class="text-lg font-bold text-base-content flex items-center gap-2 mb-4">
              <Icon name="lucide:truck" class="size-5 text-primary" />
              {{ t('checkout.fulfillmentMethod', 'Leveranssätt') }}
            </h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Parcel Delivery -->
              <label
                class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all"
                :class="
                  fulfillmentMethod === 'DELIVERY'
                    ? 'border-primary bg-primary/5 text-base-content'
                    : 'border-base-200 hover:border-base-300 text-base-content'
                "
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sm" :class="{ 'text-primary': fulfillmentMethod === 'DELIVERY' }">
                    {{ t('checkout.parcelDelivery', 'Postombud / Paket') }}
                  </span>
                  <input
                    type="radio"
                    name="fulfillment"
                    value="DELIVERY"
                    v-model="fulfillmentMethod"
                    class="radio radio-primary radio-sm"
                  />
                </div>
                <span class="text-xs text-base-content/60 mt-1">
                  {{ t('checkout.parcelDeliveryDesc', '1–3 vardagar via PostNord') }}
                </span>
                <span class="text-xs font-semibold mt-2 font-mono">
                  {{
                    cartStore.shippingFeeMinor === 0
                      ? t('cart.free', 'Gratis')
                      : formatPrice(cartStore.shippingFeeMinor)
                  }}
                </span>
              </label>

              <!-- In-Store Pickup -->
              <label
                class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all"
                :class="
                  fulfillmentMethod === 'PICKUP'
                    ? 'border-primary bg-primary/5 text-base-content'
                    : 'border-base-200 hover:border-base-300 text-base-content'
                "
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sm" :class="{ 'text-primary': fulfillmentMethod === 'PICKUP' }">
                    {{ t('checkout.inStorePickup', 'Hämta i butik') }}
                  </span>
                  <input
                    type="radio"
                    name="fulfillment"
                    value="PICKUP"
                    v-model="fulfillmentMethod"
                    class="radio radio-primary radio-sm"
                  />
                </div>
                <span class="text-xs text-base-content/60 mt-1">
                  {{ t('checkout.inStorePickupDesc', 'Klar inom 2 timmar (0 kr)') }}
                </span>
                <span class="text-xs font-semibold mt-2 text-success uppercase">
                  {{ t('cart.free', 'Gratis') }}
                </span>
              </label>
            </div>
          </div>

          <!-- 2. Customer Contact Details -->
          <div class="card bg-base-100 border border-base-200 shadow-sm p-5 sm:p-6 space-y-4">
            <h2 class="text-lg font-bold text-base-content flex items-center gap-2">
              <Icon name="lucide:user" class="size-5 text-primary" />
              {{ t('checkout.recipientHeading', 'Mottagaruppgifter') }}
            </h2>

            <!-- Full Name -->
            <div class="form-control w-full">
              <label class="label py-1">
                <span class="label-text font-medium">{{ t('checkout.fullName', 'För- och efternamn') }} *</span>
              </label>
              <input
                v-model="form.fullName"
                type="text"
                autocomplete="name"
                class="input input-bordered w-full"
                :class="{ 'input-error': touched.fullName && !isNameValid }"
                @blur="markTouched('fullName')"
                placeholder="Lars Svensson"
              />
              <span v-if="touched.fullName && !isNameValid" class="text-error text-xs mt-1">
                {{ t('checkout.validation.nameRequired', 'Vänligen ange ditt fullständiga namn.') }}
              </span>
            </div>

            <!-- Email & Phone (For carrier SMS) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text font-medium">{{ t('checkout.email', 'E-postadress') }} *</span>
                </label>
                <input
                  v-model="form.email"
                  type="email"
                  autocomplete="email"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': touched.email && !isEmailValid }"
                  @blur="markTouched('email')"
                  placeholder="lars@example.se"
                />
                <span v-if="touched.email && !isEmailValid" class="text-error text-xs mt-1">
                  {{ t('checkout.validation.emailRequired', 'Ange en giltig e-postadress.') }}
                </span>
              </div>

              <div class="form-control w-full">
                <label class="label py-1 flex items-center justify-between">
                  <span class="label-text font-medium">{{ t('checkout.phone', 'Mobilnummer (för SMS-avi)') }} *</span>
                </label>
                <input
                  v-model="form.phone"
                  type="tel"
                  autocomplete="tel"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': touched.phone && !isPhoneValid }"
                  @blur="markTouched('phone')"
                  placeholder="070 123 45 67"
                />
                <span v-if="touched.phone && !isPhoneValid" class="text-error text-xs mt-1">
                  {{ t('checkout.validation.phoneRequired', 'Ange ett giltigt mobilnummer för avisering.') }}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. Physical Delivery Address (AC-1: Conditionally shown only when DELIVERY) -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-2"
          >
            <div
              v-if="fulfillmentMethod === 'DELIVERY'"
              class="card bg-base-100 border border-base-200 shadow-sm p-5 sm:p-6 space-y-4"
            >
              <h2 class="text-lg font-bold text-base-content flex items-center gap-2">
                <Icon name="lucide:map-pin" class="size-5 text-primary" />
                {{ t('checkout.deliveryAddressHeading', 'Leveransadress') }}
              </h2>

              <!-- Street Address -->
              <div class="form-control w-full">
                <label class="label py-1">
                  <span class="label-text font-medium">{{ t('checkout.streetAddress', 'Gatuadress') }} *</span>
                </label>
                <input
                  v-model="form.streetAddress"
                  type="text"
                  autocomplete="street-address"
                  class="input input-bordered w-full"
                  :class="{ 'input-error': touched.streetAddress && !isStreetValid }"
                  @blur="markTouched('streetAddress')"
                  placeholder="Storgatan 12, lgh 1101"
                />
                <span v-if="touched.streetAddress && !isStreetValid" class="text-error text-xs mt-1">
                  {{ t('checkout.validation.streetRequired', 'Vänligen fyll i din gatuadress.') }}
                </span>
              </div>

              <!-- Postal Code & City -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="form-control w-full">
                  <label class="label py-1">
                    <span class="label-text font-medium">{{ t('checkout.postalCode', 'Postnummer') }} *</span>
                  </label>
                  <input
                    v-model="form.postalCode"
                    type="text"
                    autocomplete="postal-code"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': touched.postalCode && !isPostalCodeValid }"
                    @blur="markTouched('postalCode')"
                    placeholder="302 43"
                  />
                  <span v-if="touched.postalCode && !isPostalCodeValid" class="text-error text-xs mt-1">
                    {{ t('checkout.validation.postalCodeRequired', 'Ange ett giltigt postnummer (5 siffror).') }}
                  </span>
                </div>

                <div class="form-control w-full">
                  <label class="label py-1">
                    <span class="label-text font-medium">{{ t('checkout.city', 'Ort / Postort') }} *</span>
                  </label>
                  <input
                    v-model="form.city"
                    type="text"
                    autocomplete="address-level2"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': touched.city && !isCityValid }"
                    @blur="markTouched('city')"
                    placeholder="Halmstad"
                  />
                  <span v-if="touched.city && !isCityValid" class="text-error text-xs mt-1">
                    {{ t('checkout.validation.cityRequired', 'Vänligen ange ort.') }}
                  </span>
                </div>
              </div>
            </div>
          </Transition>

          <!-- 4. Legal Compliance & Terms Consent (AC-3 & FR-11) -->
          <div class="card bg-base-100 border border-base-200 shadow-sm p-5 sm:p-6">
            <div class="form-control">
              <label class="label cursor-pointer items-start gap-3">
                <input
                  v-model="form.acceptedTerms"
                  type="checkbox"
                  class="checkbox checkbox-primary mt-1 shrink-0"
                />
                <span class="label-text text-xs leading-relaxed text-base-content/80 select-none">
                  {{ t('checkout.legalConsentPrefix', 'Jag godkänner Siwars') }}
                  <NuxtLink to="/villkor" target="_blank" class="text-primary underline font-semibold">
                    {{ t('checkout.termsOfService', 'Köpvillkor') }}
                  </NuxtLink>
                  {{ t('checkout.legalConsentAnd', 'och bekräftar att') }}
                  <span class="font-semibold text-base-content">
                    {{ t('checkout.perishableExemptionNotice', 'ångerrätten inte gäller för färskvaror och livsmedel') }}
                  </span>
                  {{ t('checkout.legalConsentSuffix', 'i enlighet med 2 kap. 11 § distansavtalslagen.') }}
                </span>
              </label>
            </div>
            <p v-if="!form.acceptedTerms" class="text-[11px] text-error mt-2 font-medium">
              {{ t('checkout.validation.consentRequired', 'Du måste godkänna köpvillkoren och undantaget för ångerrätt för att kunna slutföra köpet.') }}
            </p>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- Right Column: Order Summary & Audited Moms Breakdown             -->
        <!-- ================================================================= -->
        <div class="lg:col-span-5 sticky top-6 space-y-4">
          <div class="card bg-base-100 border border-base-200 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 class="text-lg font-bold text-base-content flex items-center justify-between border-b border-base-200 pb-3">
              <span>{{ t('checkout.orderSummary', 'Orderöversikt') }}</span>
              <span class="text-xs font-normal text-base-content/60">
                {{ cartStore.totalItemCount }} {{ t('cart.itemsCount', 'artiklar') }}
              </span>
            </h2>

            <!-- Line Items Preview -->
            <div class="divide-y divide-base-100 max-h-64 overflow-y-auto pr-1">
                <div
                v-for="item in cartStore.items"
                :key="item.productId"
                class="py-2.5 flex items-center justify-between text-xs"
                >
                <div class="flex items-center gap-2.5">
                    <div class="size-10 rounded-lg bg-base-200 overflow-hidden shrink-0 border border-base-200">
                        <img
                            v-if="item.thumbnailUrl"
                            :src="item.thumbnailUrl"
                            :alt="getLocalized(item.name)"
                            class="size-full object-cover"
                        />
                    </div>
                    <div>
                        <p class="font-medium text-base-content line-clamp-1">
                            {{ getLocalized(item.name) }}
                        </p>
                        <p class="text-base-content/50">
                            {{ item.quantity }} × {{ formatPrice(item.price[preferences.currency] ?? item.price.SEK) }}
                        </p>
                    </div>
                </div>
                <span class="font-bold text-base-content">
                    {{ formatPrice((item.price[preferences.currency] ?? item.price.SEK) * item.quantity) }}
                </span>
                </div>
            </div>

            <div class="border-t border-base-200 pt-3 space-y-2 text-sm">
              <!-- Subtotal (excl. moms & shipping) -->
              <div class="flex justify-between items-center text-base-content/70">
                <span>{{ t('cart.subtotalNet', 'Delsumma (exkl. moms)') }}</span>
                <span class="font-mono">{{ formatPrice(cartStore.productsNetMinor) }}</span>
              </div>

              <!-- Shipping Line (AC-1 & AC-2) -->
              <div class="flex justify-between items-center text-base-content/70">
                <div class="flex items-center gap-1.5">
                  <span>{{ t('cart.shipping', 'Frakt') }}</span>
                  <span
                    v-if="fulfillmentMethod === 'DELIVERY'"
                    class="badge badge-ghost badge-xs font-mono text-[10px]"
                  >
                    {{ (cartStore.totalGrossWeightGrams / 1000).toFixed(1) }} kg
                  </span>
                </div>
                <div class="text-right">
                  <span
                    :class="
                      effectiveShippingFeeMinor === 0
                        ? 'text-success font-bold'
                        : 'font-mono text-base-content'
                    "
                  >
                    {{
                      effectiveShippingFeeMinor === 0
                        ? t('cart.free', 'Gratis')
                        : formatPrice(effectiveShippingFeeMinor)
                    }}
                  </span>
                  <!-- AC-2 Explicit Shipping Moms display -->
                  <div
                    v-if="effectiveShippingFeeMinor > 0"
                    class="text-[10px] text-base-content/50 font-mono"
                  >
                    ({{ formatPrice(effectiveShippingMomsMinor) }} {{ t('checkout.momsIncluded', 'moms inkl.') }})
                  </div>
                </div>
              </div>
            </div>

            <!-- Tax Summary Box (FR-6: Explicit 12% and 25% breakdown) -->
            <div class="rounded-xl bg-base-200/50 border border-base-200 p-3 space-y-1.5 text-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">
                {{ t('cart.momsHeading', 'Momsöversikt') }}
              </div>

              <div
                v-if="cartStore.momsBreakdown.itemsMoms12Minor > 0"
                class="flex justify-between text-base-content/70"
              >
                <span>{{ t('cart.moms12', 'Moms på livsmedel (12%)') }}</span>
                <span class="font-mono">{{ formatPrice(cartStore.momsBreakdown.itemsMoms12Minor) }}</span>
              </div>

              <div
                v-if="cartStore.momsBreakdown.itemsMoms25Minor > 0"
                class="flex justify-between text-base-content/70"
              >
                <span>{{ t('cart.moms25Items', 'Moms på varor (25%)') }}</span>
                <span class="font-mono">{{ formatPrice(cartStore.momsBreakdown.itemsMoms25Minor) }}</span>
              </div>

              <!-- Shipping Moms (AC-2) -->
              <div
                v-if="effectiveShippingMomsMinor > 0"
                class="flex justify-between text-base-content/70"
              >
                <span>{{ t('cart.moms25Shipping', 'Moms på frakt (25%)') }}</span>
                <span class="font-mono">{{ formatPrice(effectiveShippingMomsMinor) }}</span>
              </div>

              <div class="border-t border-base-300 pt-1.5 flex justify-between font-semibold text-base-content">
                <span>{{ t('cart.totalMoms', 'Varav moms totalt') }}</span>
                <span class="font-mono font-bold">{{ formatPrice(checkoutTotalMomsMinor) }}</span>
              </div>
            </div>

            <!-- Grand Total -->
            <div class="border-t border-base-200 pt-3 flex justify-between items-baseline">
              <div>
                <span class="text-base font-bold text-base-content">{{ t('cart.grandTotal', 'Totalt att betala') }}</span>
                <p class="text-[11px] text-base-content/50">{{ t('checkout.inclusiveMoms', 'Inklusive moms och frakt') }}</p>
              </div>
              <span class="text-2xl font-black text-primary font-mono tracking-tight">
                {{ formatPrice(checkoutGrandTotalMinor) }}
              </span>
            </div>

            <!-- Payment Button (AC-3: Disabled until isFormComplete) -->
            <button
              type="button"
              class="btn btn-md w-full !bg-emerald-600 hover:!bg-emerald-700 !text-white !border-none font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
              :disabled="!isFormComplete || isSubmitting"
              @click="handleProceedToPayment"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ t('checkout.proceedToPayment', 'Gå till betalning') }}</span>
              <Icon
                v-if="!isSubmitting"
                name="lucide:lock"
                class="size-4"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>