<!-- /pages/angerratt.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => `${t('legal.withdrawal.metaTitle')} | Siwar`,
  description: () => t('legal.withdrawal.metaDesc'),
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
            <NuxtLink :to="localePath('/villkor')" class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium">
              <Icon name="lucide:file-text" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('legal.terms.title') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:undo-2" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('legal.withdrawal.title') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Header Banner -->
      <div class="border-b border-base-200 pb-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold mb-3">
          <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
          {{ t('legal.withdrawal.lawReference') }}
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight">
          {{ t('legal.withdrawal.title') }}
        </h1>
        <p class="text-sm text-base-content/70 mt-2">
          {{ t('legal.withdrawal.subtitle') }}
        </p>
      </div>

      <div class="prose max-w-none text-base-content/80 text-sm leading-relaxed space-y-6">
        <!-- 1. The General 14-day Rule -->
        <section class="space-y-3">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.withdrawal.sec1_title') }}</h2>
          <p>{{ t('legal.withdrawal.sec1_p1') }}</p>
          <p>{{ t('legal.withdrawal.sec1_p2') }}</p>
        </section>

        <!-- 2. Statutory Food Exemptions -->
        <section class="space-y-3 p-5 rounded-2xl bg-error/5 border border-error/20">
          <h2 class="text-lg font-bold text-error flex items-center gap-2">
            <Icon name="lucide:ban" class="size-5 shrink-0" />
            {{ t('legal.withdrawal.sec2_title') }}
          </h2>
          <p class="text-base-content/90 font-medium">
            {{ t('legal.withdrawal.sec2_intro') }}
          </p>

          <div class="space-y-3 mt-3">
            <div class="p-3.5 bg-base-100 rounded-xl border border-base-200">
              <span class="font-bold text-xs uppercase text-error block mb-1">
                {{ t('legal.withdrawal.sec2_exemption1_tag') }}
              </span>
              <p class="text-xs text-base-content/80">
                <em>"{{ t('legal.withdrawal.sec2_exemption1_quote') }}"</em><br />
                {{ t('legal.withdrawal.sec2_exemption1_desc') }}
              </p>
            </div>

            <div class="p-3.5 bg-base-100 rounded-xl border border-base-200">
              <span class="font-bold text-xs uppercase text-error block mb-1">
                {{ t('legal.withdrawal.sec2_exemption2_tag') }}
              </span>
              <p class="text-xs text-base-content/80">
                <em>"{{ t('legal.withdrawal.sec2_exemption2_quote') }}"</em><br />
                {{ t('legal.withdrawal.sec2_exemption2_desc') }}
              </p>
            </div>
          </div>

          <p class="text-xs text-base-content/70 mt-2">
            {{ t('legal.withdrawal.sec2_conclusion') }}
          </p>
        </section>

        <!-- 3. How to exercise withdrawal on non-food goods -->
        <section class="space-y-3">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.withdrawal.sec3_title') }}</h2>
          <ol class="list-decimal pl-5 rtl:pr-5 rtl:pl-0 space-y-1">
            <li>{{ t('legal.withdrawal.sec3_step1') }}</li>
            <li>{{ t('legal.withdrawal.sec3_step2') }}</li>
            <li>{{ t('legal.withdrawal.sec3_step3') }}</li>
          </ol>
        </section>

        <!-- 4. Refunds -->
        <section class="space-y-3">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.withdrawal.sec4_title') }}</h2>
          <p>{{ t('legal.withdrawal.sec4_p1') }}</p>
        </section>
      </div>

      <!-- Footer Navigation -->
      <div class="pt-6 border-t border-base-200 flex flex-wrap gap-4 items-center justify-between">
        <NuxtLink :to="localePath('/kassa')" class="btn btn-primary btn-sm text-white">
          <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
          {{ t('legal.backToCheckout') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/villkor')" class="btn btn-ghost btn-sm">
          {{ t('legal.readTerms') }}
          <Icon name="lucide:arrow-right" class="size-4 rtl:rotate-180" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>