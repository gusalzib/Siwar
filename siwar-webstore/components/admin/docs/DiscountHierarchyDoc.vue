<!-- components/admin/docs/DiscountHierarchyDoc.vue -->
<!--
  Internal Administrative Documentation: Discount Precedence Hierarchy
  
  This modular component provides store administrators and staff with an authoritative
  reference for the deterministic 4-tier discount resolution engine implemented across
  Siwar Webstore (see server/services/pricing.service.ts).
  
  Precedence Order:
  1. Kortdatum (Short-Dated Clearance) -> Operational priority to minimize food waste
  2. Category Campaign               -> Broad promotional sale across an entire section
  3. Ordinary Product Discount       -> Item-level markdown configured in the product form
  4. Standard Retail Price           -> Base catalog price across SEK, EUR, and USD
-->
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <article class="space-y-8 text-base-content">
    <!-- Header & Abstract -->
    <header class="border-b border-base-200 dark:border-zinc-800 pb-6">
      <div class="flex items-center gap-2 flex-wrap mb-2">
        <span class="badge badge-primary font-bold text-xs">
          {{ t('admin.docs.discounts.badgeText', '4-nivåers affärsregel') }}
        </span>
        <span class="text-xs text-base-content/60 font-mono">
          server/services/pricing.service.ts
        </span>
      </div>
      <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-100">
        {{ t('admin.docs.discounts.title', 'Rabatthierarki & Kampanjprioritet') }}
      </h1>
      <p class="text-sm sm:text-base text-base-content/80 mt-2 max-w-3xl leading-relaxed">
        {{ t('admin.docs.discounts.subtitle', 'Siwar tillämpar en strikt deterministisk rabatthierarki i 4 nivåer för att säkerställa korrekta priser i butiken, varukorgen och kassan.') }}
      </p>
    </header>

    <!-- Visual Tier Precedence Cards -->
    <section class="space-y-4">
      <h2 class="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
        <Icon name="lucide:layers" class="size-5 text-brand-600 dark:text-brand-400" />
        <span>{{ t('admin.docs.discounts.title', 'Rabatthierarki & Kampanjprioritet') }}</span>
      </h2>

      <div class="grid grid-cols-1 gap-4">
        <!-- Tier 1: Kortdatum Clearance (Priority 1) -->
        <div class="card bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl p-5 sm:p-6 shadow-xs transition-all">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs shrink-0 shadow-xs whitespace-nowrap">
                {{ t('admin.docs.discounts.priorityBadge', { level: 1 }) }}
              </span>
              <h3 class="font-black text-base sm:text-lg text-slate-900 dark:text-amber-100 leading-snug">
                {{ t('admin.docs.discounts.tier1Title', 'Kortdatum / Utförsäljning (Kort bäst-före)') }}
              </h3>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg border border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium text-xs leading-snug w-fit max-w-full">
              {{ t('admin.docs.discounts.tier1Subtitle', 'Högsta prioritet') }}
            </span>
          </div>
          <p class="text-sm text-base-content/85 leading-relaxed">
            {{ t('admin.docs.discounts.tier1Description', 'När en vara markeras med kort datum gäller alltid utförsäljningsrabatten först. Detta förhindrar matsvinn och säkerställer att varor med nära utgångsdatum säljs ut snabbt.') }}
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-base-content/80 list-disc list-inside">
            <li>{{ t('admin.docs.discounts.tier1Rule1') }}</li>
            <li>{{ t('admin.docs.discounts.tier1Rule2') }}</li>
            <li>{{ t('admin.docs.discounts.tier1Rule3') }}</li>
          </ul>
        </div>

        <!-- Precedence Indicator Arrow -->
        <div class="flex justify-center -my-1 text-base-content/40">
          <Icon name="lucide:arrow-down" class="size-5" />
        </div>

        <!-- Tier 2: Category Campaign (Priority 2) -->
        <div class="card bg-sky-50/70 dark:bg-sky-950/30 border-2 border-sky-300 dark:border-sky-700/80 rounded-2xl p-5 sm:p-6 shadow-xs transition-all">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-sky-600 text-white font-black text-xs shrink-0 shadow-xs whitespace-nowrap">
                {{ t('admin.docs.discounts.priorityBadge', { level: 2 }) }}
              </span>
              <h3 class="font-black text-base sm:text-lg text-slate-900 dark:text-sky-100 leading-snug">
                {{ t('admin.docs.discounts.tier2Title', 'Kategorikampanj (Övergripande rea)') }}
              </h3>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg border border-sky-500/60 bg-sky-500/10 text-sky-900 dark:text-sky-200 font-medium text-xs leading-snug w-fit max-w-full">
              {{ t('admin.docs.discounts.tier2Subtitle', 'Prioritet 2') }}
            </span>
          </div>
          <p class="text-sm text-base-content/85 leading-relaxed">
            {{ t('admin.docs.discounts.tier2Description', 'Kategorikampanjer ställs in under butiksinställningar och gäller för samtliga produkter som tillhör den kategorin under en tidsbegränsad period.') }}
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-base-content/80 list-disc list-inside">
            <li>{{ t('admin.docs.discounts.tier2Rule1') }}</li>
            <li>{{ t('admin.docs.discounts.tier2Rule2') }}</li>
            <li>{{ t('admin.docs.discounts.tier2Rule3') }}</li>
          </ul>
        </div>

        <!-- Precedence Indicator Arrow -->
        <div class="flex justify-center -my-1 text-base-content/40">
          <Icon name="lucide:arrow-down" class="size-5" />
        </div>

        <!-- Tier 3: Ordinary Product Discount (Priority 3) -->
        <div class="card bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-700/80 rounded-2xl p-5 sm:p-6 shadow-xs transition-all">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shrink-0 shadow-xs whitespace-nowrap">
                {{ t('admin.docs.discounts.priorityBadge', { level: 3 }) }}
              </span>
              <h3 class="font-black text-base sm:text-lg text-slate-900 dark:text-emerald-100 leading-snug">
                {{ t('admin.docs.discounts.tier3Title', 'Ordinarie Produktrabatt (Enskild produktrea)') }}
              </h3>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg border border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium text-xs leading-snug w-fit max-w-full">
              {{ t('admin.docs.discounts.tier3Subtitle', 'Prioritet 3') }}
            </span>
          </div>
          <p class="text-sm text-base-content/85 leading-relaxed">
            {{ t('admin.docs.discounts.tier3Description', 'Gäller för en specifik vara och ställs in direkt i produktformuläret med valfria start- och slutdatum.') }}
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-base-content/80 list-disc list-inside">
            <li>{{ t('admin.docs.discounts.tier3Rule1') }}</li>
            <li>{{ t('admin.docs.discounts.tier3Rule2') }}</li>
            <li>{{ t('admin.docs.discounts.tier3Rule3') }}</li>
          </ul>
        </div>

        <!-- Precedence Indicator Arrow -->
        <div class="flex justify-center -my-1 text-base-content/40">
          <Icon name="lucide:arrow-down" class="size-5" />
        </div>

        <!-- Tier 4: Standard Retail Price (Priority 4) -->
        <div class="card bg-slate-50 dark:bg-zinc-800/60 border-2 border-slate-300 dark:border-zinc-700 rounded-2xl p-5 sm:p-6 shadow-xs transition-all">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-700 dark:bg-zinc-600 text-white font-black text-xs shrink-0 shadow-xs whitespace-nowrap">
                {{ t('admin.docs.discounts.priorityBadge', { level: 4 }) }}
              </span>
              <h3 class="font-black text-base sm:text-lg text-slate-900 dark:text-zinc-100 leading-snug">
                {{ t('admin.docs.discounts.tier4Title', 'Ordinarie Butikspris (Baspris)') }}
              </h3>
            </div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-400/60 dark:border-zinc-600 bg-slate-200/50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-medium text-xs leading-snug w-fit max-w-full">
              {{ t('admin.docs.discounts.tier4Subtitle', 'Prioritet 4') }}
            </span>
          </div>
          <p class="text-sm text-base-content/85 leading-relaxed">
            {{ t('admin.docs.discounts.tier4Description', 'Produktens ordinarie pris i butiken. Detta pris gäller när inga rabatter eller kampanjer är aktiva, eller när en tidsbegränsad kampanj har löpt ut.') }}
          </p>
          <ul class="mt-3 space-y-1.5 text-xs text-base-content/80 list-disc list-inside">
            <li>{{ t('admin.docs.discounts.tier4Rule1') }}</li>
            <li>{{ t('admin.docs.discounts.tier4Rule2') }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Operational Rules & Engineering Invariance -->
    <section class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-base-200 dark:border-zinc-800">
      <!-- Mutual Exclusion in Product Form -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2 shadow-xs">
        <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
          <Icon name="lucide:shield-alert" class="size-4 text-amber-500 shrink-0" />
          <span>{{ t('admin.docs.discounts.mutualExclusionTitle') }}</span>
        </h3>
        <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
          {{ t('admin.docs.discounts.mutualExclusionDesc') }}
        </p>
      </div>

      <!-- VAT & Jämförpris Computation -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2 shadow-xs">
        <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
          <Icon name="lucide:calculator" class="size-4 text-brand-600 dark:text-brand-400 shrink-0" />
          <span>{{ t('admin.docs.discounts.taxAndComparisonTitle') }}</span>
        </h3>
        <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
          {{ t('admin.docs.discounts.taxAndComparisonDesc') }}
        </p>
      </div>

      <!-- Pre-Flight Checkout Validation -->
      <div class="card bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2 shadow-xs md:col-span-2">
        <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
          <Icon name="lucide:badge-check" class="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{{ t('admin.docs.discounts.checkoutValidationTitle') }}</span>
        </h3>
        <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
          {{ t('admin.docs.discounts.checkoutValidationDesc') }}
        </p>
      </div>
    </section>
  </article>
</template>
