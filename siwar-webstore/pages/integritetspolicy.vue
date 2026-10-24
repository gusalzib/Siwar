<!-- /pages/integritetspolicy.vue -->
<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => `${t('legal.privacy.metaTitle', 'Integritetspolicy')} | Siwar`,
  description: () => t('legal.privacy.metaDesc', 'Information om hur Siwar Butik AB hanterar personuppgifter i enlighet med GDPR.'),
})
</script>

<template>
  <div class="min-h-screen bg-base-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Breadcrumbs -->
      <nav class="text-sm breadcrumbs mb-8 mt-2 overflow-visible">
        <ul class="!flex flex-col sm:!flex-row flex-wrap gap-2 w-full">
          <li class="w-full sm:w-auto">
            <NuxtLink
              :to="localePath('/')"
              class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content/70 hover:text-primary rounded-lg border border-base-300 hover:border-primary/30 shadow-sm transition-all hover:-translate-y-0.5 font-medium"
            >
              <Icon name="lucide:home" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('nav.home', 'Hem') }}</span>
            </NuxtLink>
          </li>
          <li class="w-full sm:w-auto">
            <div class="inline-flex w-full sm:w-auto items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 shadow-sm font-bold">
              <Icon name="lucide:shield-check" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ t('legal.privacy.title', 'Integritetspolicy & Dataskydd') }}</span>
            </div>
          </li>
        </ul>
      </nav>

      <!-- Header -->
      <div class="border-b border-base-200 pb-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-3">
          <Icon name="lucide:lock" class="size-3.5" />
          <span>{{ t('legal.privacy.gdprBadge', 'Dataskyddsförordningen (GDPR)') }}</span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-base-content tracking-tight">
          {{ t('legal.privacy.title', 'Integritetspolicy & Dataskydd') }}
        </h1>
        <p class="text-xs text-base-content/50 mt-2 font-mono">
          {{ t('legal.lastUpdated', 'Senast uppdaterad') }}: 2026-10-22
        </p>
      </div>

      <!-- Main Legal Content -->
      <div class="prose max-w-none text-base-content/80 text-sm leading-relaxed space-y-6">
        <!-- 1. Data Controller -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec1_title', '1. Personuppgiftsansvarig') }}</h2>
          <p>{{ t('legal.privacy.sec1_p1', 'Siwar Butik AB, Storgatan 12, 302 43 Halmstad, organisationsnummer 559123-4567, är personuppgiftsansvarig för behandlingen av dina personuppgifter.') }}</p>
          <p>{{ t('legal.privacy.sec1_p2', 'Vi värnar om din personliga integritet och eftersträvar alltid en hög nivå av dataskydd i enlighet med EU:s dataskyddsförordning (GDPR).') }}</p>
        </section>

        <!-- 2. Collected Data -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec2_title', '2. Vilka personuppgifter vi samlar in') }}</h2>
          <p>{{ t('legal.privacy.sec2_p1', 'Vi samlar in information som du lämnar till oss vid genomförande av köp eller kontakt med vår kundtjänst:') }}</p>
          <ul class="list-disc ps-5 space-y-1">
            <li>{{ t('legal.privacy.sec2_item1', 'Namn, leveransadress och faktureringsadress') }}</li>
            <li>{{ t('legal.privacy.sec2_item2', 'Kontaktuppgifter (e-postadress och mobilnummer för leveransavisering)') }}</li>
            <li>{{ t('legal.privacy.sec2_item3', 'Orderinformation (beställda varor, ordernummer, valuta och betalningsreferens)') }}</li>
          </ul>
        </section>

        <!-- 3. Legal Basis & Purpose -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec3_title', '3. Ändamål och rättslig grund för behandlingen') }}</h2>
          <p>{{ t('legal.privacy.sec3_p1', 'Vi behandlar dina uppgifter för att kunna fullgöra vårt köpeavtal med dig, leverera beställda produkter och tillhandahålla kundsupport.') }}</p>
          <p>{{ t('legal.privacy.sec3_p2', 'Viss behandling sker även för att uppfylla rättsliga förpliktelser enligt Bokföringslagen (1999:1078), vilket kräver att faktura- och bokföringsunderlag sparas i sju år.') }}</p>
        </section>

        <!-- 4. Third-Party Sharing -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec4_title', '4. Mottagare och delning med tredje part') }}</h2>
          <p>{{ t('legal.privacy.sec4_p1', 'Vi säljer aldrig dina personuppgifter vidare till utomstående parter. Vi delar endast uppgifter med pålitliga personuppgiftsbiträden som krävs för verksamheten:') }}</p>
          <ul class="list-disc ps-5 space-y-1">
            <li>{{ t('legal.privacy.sec4_item1', 'Logistik- och fraktleverantörer (t.ex. PostNord) för att kunna leverera ditt paket.') }}</li>
            <li>{{ t('legal.privacy.sec4_item2', 'Betaltjänstleverantörer (t.ex. Swish och kortinlösare) för säker betalningshantering.') }}</li>
          </ul>
        </section>

        <!-- 5. Your Rights -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec5_title', '5. Dina rättigheter') }}</h2>
          <p>{{ t('legal.privacy.sec5_p1', 'Enligt GDPR har du rätt att kostnadsfritt begära ett registerutdrag över vilka uppgifter vi har lagrade om dig, begära rättelse av felaktiga uppgifter samt under vissa förutsättningar begära radering eller begränsning av behandlingen.') }}</p>
          <p>{{ t('legal.privacy.sec5_p2', 'För att utöva dina rättigheter, kontakta oss via order@siwar.se. Du har även rätt att inge klagomål till Integritetsskyddsmyndigheten (IMY).') }}</p>
        </section>
      </div>

      <!-- Action Footer -->
      <div class="border-t border-base-200 pt-6 flex flex-wrap gap-4 items-center justify-between">
        <NuxtLink
          :to="localePath('/villkor')"
          class="btn btn-sm btn-outline gap-2 font-semibold"
        >
          <Icon name="lucide:file-text" class="size-4" />
          <span>{{ t('legal.terms.title', 'Köpvillkor') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="localePath('/')"
          class="btn btn-sm btn-primary text-white gap-2 font-bold"
        >
          <Icon name="lucide:arrow-left" class="size-4 rtl:rotate-180" />
          <span>{{ t('nav.home', 'Tillbaka till startsidan') }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
