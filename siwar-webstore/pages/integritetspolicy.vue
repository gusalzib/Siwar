<!-- /pages/integritetspolicy.vue -->
<script setup lang="ts">
import { computed } from 'vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic StoreSettings for statutory legal identity
const { data: settings } = await useAsyncData('store-settings', () => $fetch<any>('/api/settings'))

const storeName = computed(() => {
  const name = settings.value?.storeName
  if (!name) return 'Siwar'
  return typeof name === 'object' ? (name[locale.value] || name.sv || name.en || name.ar || 'Siwar') : name
})

const companyName = computed(() => settings.value?.company?.name || settings.value?.companyName || 'Siwar Butik AB')
const orgNumber = computed(() => settings.value?.company?.orgNumber || settings.value?.orgNumber || '559123-4567')
const momsNumber = computed(() => settings.value?.company?.vatNumber || settings.value?.momsNumber || 'SE559123456701')
const contactEmail = computed(() => settings.value?.contact?.email || settings.value?.contactEmail || 'order@siwar.se')
const contactPhone = computed(() => settings.value?.contact?.phone || settings.value?.contactPhone || '+46 35 123 456')

const street = computed(() => settings.value?.address?.street || 'Storgatan 12')
const postalCode = computed(() => settings.value?.address?.postalCode || '302 43')
const city = computed(() => settings.value?.address?.city || 'Halmstad')
const country = computed(() => settings.value?.address?.country || 'Sverige')
const fullAddress = computed(() => `${street.value}, ${postalCode.value} ${city.value}, ${country.value}`)

useSeoMeta({
  title: () => `${t('legal.privacy.metaTitle', 'Integritetspolicy')} | ${storeName.value}`,
  description: () => t('legal.privacy.metaDesc', { companyName: companyName.value }),
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

      <!-- Statutory Entity Summary Card -->
      <div class="card bg-slate-50 dark:bg-zinc-800/60 border-2 border-slate-200 dark:border-zinc-700/80 rounded-2xl p-4 sm:p-5 not-prose shadow-xs">
        <div class="flex items-center gap-2 mb-3 text-brand-600 dark:text-brand-400 font-bold text-sm">
          <Icon name="lucide:building-2" class="size-4" />
          <span>{{ t('legal.entityCard.title', 'Företagsinformation & Juridisk person') }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.company', 'Juridiskt namn') }}</span>
            <span class="font-bold text-base-content text-sm">{{ companyName }}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.orgNumber', 'Organisationsnummer') }}</span>
            <span class="font-bold font-mono text-base-content text-sm">{{ orgNumber }}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.momsNumber', 'Momsregistreringsnummer') }}</span>
            <span class="font-bold font-mono text-base-content text-sm">{{ momsNumber }}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.address', 'Sätes- & butiksadress') }}</span>
            <span class="font-medium text-base-content">{{ fullAddress }}</span>
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.email', 'Officiell e-post') }}</span>
            <a :href="`mailto:${contactEmail}`" class="font-medium text-brand-600 dark:text-brand-400 hover:underline">{{ contactEmail }}</a>
          </div>
          <div class="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700">
            <span class="text-base-content/60 font-semibold block">{{ t('legal.entityCard.phone', 'Telefon') }}</span>
            <a :href="`tel:${contactPhone}`" class="font-medium text-brand-600 dark:text-brand-400 hover:underline font-mono">{{ contactPhone }}</a>
          </div>
        </div>
      </div>

      <!-- Main Legal Content -->
      <div class="prose max-w-none text-base-content/80 text-sm leading-relaxed space-y-6">
        <!-- 1. Data Controller -->
        <section class="space-y-2">
          <h2 class="text-lg font-bold text-base-content">{{ t('legal.privacy.sec1_title', '1. Personuppgiftsansvarig') }}</h2>
          <p>{{ t('legal.privacy.sec1_p1', { companyName, address: fullAddress, orgNumber }) }}</p>
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
          <p>{{ t('legal.privacy.sec5_p2', { email: contactEmail }) }}</p>
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
