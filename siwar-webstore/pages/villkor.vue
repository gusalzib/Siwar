<!-- /pages/villkor.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => `${t('legal.terms.metaTitle')} | Siwar`,
  description: () => t('legal.terms.metaDesc'),
})
</script>

<template>
  <div class="min-h-screen bg-base-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-8">
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
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:file-text" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('legal.terms.title') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Header -->
      <div class="border-b border-base-200 pb-6">
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight">
          {{ t('legal.terms.title') }}
        </h1>
        <p class="text-xs text-base-content/50 mt-2 font-mono">
          {{ t('legal.lastUpdated') }}: 2026-09-29
        </p>
      </div>

      <!-- Main Legal Content -->
      <div class="prose max-w-none text-base-content/80 text-sm leading-relaxed space-y-6">
        <!-- 1. General & Business Info -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.terms.sec1_title') }}</h2>
          <p>{{ t('legal.terms.sec1_p1') }}</p>
          <p>{{ t('legal.terms.sec1_p2') }}</p>
        </section>

        <!-- 2. Pricing & Moms -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.terms.sec2_title') }}</h2>
          <p>{{ t('legal.terms.sec2_p1') }}</p>
          <p>{{ t('legal.terms.sec2_p2') }}</p>
        </section>

        <!-- 3. Ordering & Stock Buffers -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.terms.sec3_title') }}</h2>
          <p>{{ t('legal.terms.sec3_p1') }}</p>
        </section>

        <!-- 4. Delivery Methods -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.terms.sec4_title') }}</h2>
          <ul class="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-1">
            <li>
              <strong>{{ t('legal.terms.sec4_pickup_title') }}:</strong> {{ t('legal.terms.sec4_pickup_desc') }}
            </li>
            <li>
              <strong>{{ t('legal.terms.sec4_delivery_title') }}:</strong> {{ t('legal.terms.sec4_delivery_desc') }}
            </li>
          </ul>
        </section>

        <!-- 5. Right of Withdrawal Exemption Callout -->
        <section class="space-y-2 bg-base-200/50 p-4 rounded-xl border border-base-200">
          <h2 class="text-lg font-bold text-base-content flex items-center gap-2">
            <Icon name="lucide:shield-alert" class="size-5 text-warning shrink-0" />
            {{ t('legal.terms.sec5_title') }}
          </h2>
          <p>{{ t('legal.terms.sec5_p1') }}</p>
          <p class="font-semibold text-base-content">
            {{ t('legal.terms.sec5_highlight') }}
          </p>
          <p>
            {{ t('legal.terms.sec5_link_prefix') }}
            <NuxtLink :to="localePath('/angerratt')" class="text-primary underline font-bold">
              {{ t('legal.terms.sec5_link_text') }}
            </NuxtLink>.
          </p>
        </section>

        <!-- 6. Complaints & Defective Items -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.terms.sec6_title') }}</h2>
          <p>{{ t('legal.terms.sec6_p1') }}</p>
        </section>
      </div>

      <!-- Footer CTA Navigation -->
      <div class="pt-6 border-t border-base-200 flex flex-wrap gap-4 items-center justify-between">
        <NuxtLink :to="localePath('/kassa')" class="btn btn-primary btn-sm text-white">
          <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
          {{ t('legal.backToCheckout') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/angerratt')" class="btn btn-outline btn-sm">
          {{ t('legal.readWithdrawal') }}
          <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>