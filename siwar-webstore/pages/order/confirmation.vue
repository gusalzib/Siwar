<!-- pages/order/confirmation.vue -->
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()

// Stripe redirects with either ?payment_intent=pi_... or your custom ?intent_id=pi_...
const intentId = (route.query.payment_intent || route.query.intent_id) as string
</script>

<template>
  <div class="min-h-screen bg-base-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="card max-w-md w-full bg-base-100 border border-base-200 shadow-md p-6 text-center space-y-5">
      <!-- Success Icon -->
      <div class="size-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
        <Icon name="lucide:check-circle-2" class="size-10" />
      </div>

      <!-- Header & Notice -->
      <div class="space-y-1">
        <h1 class="text-2xl font-black text-base-content">
          {{ t('order.confirmedTitle', 'Tack för din beställning!') }}
        </h1>
        <p class="text-xs text-base-content/60">
          {{ t('order.holdNotice', 'Ditt belopp har reserverats och dras när ordern packas.') }}
        </p>
      </div>

      <!-- Payment Intent / Order Reference -->
      <div v-if="intentId" class="p-3 bg-base-200/50 rounded-lg text-xs font-mono text-base-content/70 break-all">
        <span class="font-bold text-base-content">Referens:</span> {{ intentId }}
      </div>

      <!-- Return Button -->
      <NuxtLink :to="localePath('/')" class="btn btn-primary w-full text-white font-bold">
        {{ t('order.backToHome', 'Tillbaka till butiken') }}
      </NuxtLink>
    </div>
  </div>
</template>