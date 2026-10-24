<!-- components/StoreFooter.vue - Statutory Multi-Column Global Footer -->
<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_GENERAL_CONFIG, formatWeeklySchedule } from '~/utils/schedule'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic general settings from public endpoint
const { data: storeInfo } = await useFetch<any>('/api/settings', {
  lazy: true,
})

// Store Name localized
const storeName = computed(() => {
  if (storeInfo.value?.storeName) {
    return storeInfo.value.storeName[locale.value] || storeInfo.value.storeName.sv || 'Siwar'
  }
  return t('storeName', 'Siwar')
})

// Store Tagline localized
const storeTagline = computed(() => {
  if (storeInfo.value?.tagline) {
    return storeInfo.value.tagline[locale.value] || storeInfo.value.tagline.sv || DEFAULT_GENERAL_CONFIG.tagline?.sv
  }
  return t('footer.taglineFallback', 'Din orientaliska livsmedelsbutik i Halmstad')
})

// Physical Address
const address = computed(() => {
  const addr = storeInfo.value?.address || DEFAULT_GENERAL_CONFIG.address
  return {
    street: addr.street || 'Storgatan 12',
    postalCode: addr.postalCode || '302 43',
    city: addr.city || 'Halmstad',
    country: addr.country || 'Sverige',
  }
})

// Formatted Opening Hours for active locale
const formattedHours = computed(() => {
  if (storeInfo.value?.openingHours) {
    const hours = storeInfo.value.openingHours[locale.value] || storeInfo.value.openingHours.sv
    if (hours) return hours
  }
  if (storeInfo.value?.schedule) {
    const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
    return formatWeeklySchedule(storeInfo.value.schedule, currentLang)
  }
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  return DEFAULT_GENERAL_CONFIG.openingHours?.[currentLang] || DEFAULT_GENERAL_CONFIG.openingHours?.sv || ''
})

// Contact Info
const contact = computed(() => {
  return {
    email: storeInfo.value?.contact?.email || DEFAULT_GENERAL_CONFIG.contact.email,
    phone: storeInfo.value?.contact?.phone || DEFAULT_GENERAL_CONFIG.contact.phone,
  }
})

// Company Registration Info (Bokföringslagen compliance)
const company = computed(() => {
  return {
    name: storeInfo.value?.company?.name || DEFAULT_GENERAL_CONFIG.company.name,
    orgNumber: storeInfo.value?.company?.orgNumber || DEFAULT_GENERAL_CONFIG.company.orgNumber,
    vatNumber: storeInfo.value?.company?.vatNumber || DEFAULT_GENERAL_CONFIG.company.vatNumber,
  }
})
</script>

<template>
  <footer class="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16 pt-12 pb-8 transition-colors duration-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      
      <!-- 4-Column Responsive Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        
        <!-- Column 1: Store Identity & Physical Store Address + Hours -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div class="size-9 rounded-xl bg-primary text-white flex items-center justify-center font-black shadow-sm">
              <Icon name="lucide:shopping-bag" class="size-5" />
            </div>
            <span class="text-xl font-black tracking-tight text-white">{{ storeName }}</span>
          </div>

          <p class="text-xs text-slate-400 leading-relaxed font-medium">
            {{ storeTagline }}
          </p>

          <div class="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs">
            <!-- Physical Address -->
            <div class="flex items-start gap-2.5 text-slate-300">
              <Icon name="lucide:map-pin" class="size-4 text-primary shrink-0 mt-0.5" />
              <address class="not-italic leading-relaxed">
                <span>{{ address.street }}</span><br />
                <span>{{ address.postalCode }} {{ address.city }}, {{ address.country }}</span>
              </address>
            </div>

            <!-- Opening Hours -->
            <div class="flex items-start gap-2.5 text-slate-300 pt-1">
              <Icon name="lucide:clock" class="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div class="leading-relaxed">
                <span class="font-bold text-white block text-[11px] uppercase tracking-wider">
                  {{ t('footer.hoursTitle', 'Butikens öppettider') }}
                </span>
                <span class="text-slate-400 font-mono text-[11px] leading-tight block mt-0.5">
                  {{ formattedHours }}
                </span>
                <NuxtLink
                  :to="localePath('/oppettider')"
                  class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors mt-1.5 group"
                >
                  <span>{{ t('footer.viewOpeningHoursPage', 'Se alla öppettider & hitta hit') }}</span>
                  <Icon name="lucide:arrow-right" class="size-3 rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Customer Service & Order Lookup -->
        <div class="space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Icon name="lucide:headphones" class="size-4 text-blue-400" />
            <span>{{ t('footer.customerService.title', 'Kundservice') }}</span>
          </h3>

          <p class="text-xs text-slate-400 leading-relaxed">
            {{ t('footer.customerService.description', 'Har du frågor om vårt sortiment eller en pågående order? Vi hjälper dig gärna.') }}
          </p>

          <ul class="space-y-2.5 text-xs">
            <li>
              <a
                :href="`mailto:${contact.email}`"
                class="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors group"
              >
                <Icon name="lucide:mail" class="size-4 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span class="font-semibold">{{ contact.email }}</span>
              </a>
            </li>

            <li>
              <a
                :href="`tel:${contact.phone.replace(/\\s+/g, '')}`"
                class="flex items-center gap-2.5 text-slate-300 hover:text-white transition-colors group"
              >
                <Icon name="lucide:phone" class="size-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                <span class="font-semibold font-mono">{{ contact.phone }}</span>
              </a>
            </li>

            <li class="pt-2">
              <NuxtLink
                :to="localePath('/order/lookup')"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all hover:border-primary/50 shadow-xs"
              >
                <Icon name="lucide:package-search" class="size-3.5 text-primary" />
                <span>{{ t('footer.customerService.orderLookup', 'Spåra beställning') }}</span>
                <Icon name="lucide:arrow-right" class="size-3 rtl:rotate-180" />
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Column 3: Legal Compliance & Company Registration -->
        <div class="space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Icon name="lucide:scale" class="size-4 text-purple-400" />
            <span>{{ t('footer.legal.title', 'Juridiskt & Företag') }}</span>
          </h3>

          <!-- Company Identifiers (Bokföringslagen compliance) -->
          <div class="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs space-y-1 font-mono">
            <div class="font-bold text-white font-sans">{{ company.name }}</div>
            <div class="text-slate-400">
              <span class="text-slate-500 font-sans">{{ t('footer.legal.orgNumber', 'Org.nr') }}:</span> {{ company.orgNumber }}
            </div>
            <div class="text-slate-400">
              <span class="text-slate-500 font-sans">{{ t('footer.legal.vatNumber', 'Momsreg.nr') }}:</span> {{ company.vatNumber }}
            </div>
          </div>

          <!-- Working Policy Links -->
          <ul class="space-y-2 text-xs">
            <li>
              <NuxtLink
                :to="localePath('/villkor')"
                class="flex items-center gap-2 text-slate-300 hover:text-primary transition-colors font-medium"
              >
                <Icon name="lucide:file-text" class="size-3.5 text-slate-500 shrink-0" />
                <span>{{ t('legal.terms.title', 'Köpvillkor') }}</span>
              </NuxtLink>
            </li>

            <li>
              <NuxtLink
                :to="localePath('/integritetspolicy')"
                class="flex items-center gap-2 text-slate-300 hover:text-primary transition-colors font-medium"
              >
                <Icon name="lucide:shield-check" class="size-3.5 text-slate-500 shrink-0" />
                <span>{{ t('legal.privacy.title', 'Integritetspolicy & GDPR') }}</span>
              </NuxtLink>
            </li>

            <li>
              <NuxtLink
                :to="localePath('/angerratt')"
                class="flex items-center gap-2 text-slate-300 hover:text-primary transition-colors font-medium"
              >
                <Icon name="lucide:refresh-cw" class="size-3.5 text-slate-500 shrink-0" />
                <span>{{ t('legal.withdrawal.title', 'Ångerrätt & Livsmedelsundantag') }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Column 4: Payment Provider Badges & Security -->
        <div class="space-y-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Icon name="lucide:shield" class="size-4 text-emerald-400" />
            <span>{{ t('footer.payment.title', 'Trygga betalsätt') }}</span>
          </h3>

          <p class="text-xs text-slate-400 leading-relaxed">
            {{ t('footer.payment.subtitle', 'Säkra betalningar med kryptering via etablerade betallösningar.') }}
          </p>

          <!-- Payment Provider Badges: Swish, Visa, Mastercard -->
          <div class="flex flex-wrap items-center gap-2 pt-1">
            
            <!-- Swish Badge -->
            <div
              class="h-9 px-3 rounded-lg bg-white text-slate-900 flex items-center gap-1.5 shadow-xs font-bold text-xs"
              :title="t('footer.payment.swish', 'Swish Handel')"
            >
              <div class="size-4.5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-black">
                S
              </div>
              <span class="tracking-tight text-slate-900 font-extrabold">swish</span>
            </div>

            <!-- Visa Badge -->
            <div
              class="h-9 px-3 rounded-lg bg-white text-[#1a1f71] flex items-center justify-center shadow-xs font-black text-sm italic tracking-widest"
              :title="t('footer.payment.visa', 'Visa')"
            >
              VISA
            </div>

            <!-- Mastercard Badge -->
            <div
              class="h-9 px-3 rounded-lg bg-white flex items-center gap-1 shadow-xs font-bold text-xs"
              :title="t('footer.payment.mastercard', 'Mastercard')"
            >
              <div class="flex -space-x-1.5">
                <span class="size-4 rounded-full bg-[#eb001b] inline-block" />
                <span class="size-4 rounded-full bg-[#f79e1b] inline-block opacity-90" />
              </div>
              <span class="text-slate-800 text-[10px] font-extrabold tracking-tight">mastercard</span>
            </div>

          </div>

          <!-- SSL & Security Reassurance -->
          <div class="pt-2 flex items-center gap-2 text-slate-400 text-[11px]">
            <Icon name="lucide:lock" class="size-3.5 text-emerald-400 shrink-0" />
            <span>{{ t('footer.payment.sslGuarantee', '256-bit SSL-krypterad anslutning') }}</span>
          </div>
        </div>

      </div>

      <!-- Bottom Sub-Footer Bar -->
      <div class="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p class="text-center sm:text-start">
          © {{ new Date().getFullYear() }} {{ company.name }}. {{ t('footer.allRightsReserved', 'Alla rättigheter förbehållna.') }}
        </p>

        <p class="text-center sm:text-end text-[11px] text-slate-400">
          {{ t('footer.complianceNotice', 'Följer Bokföringslagen (1999:1078) och Prisinformationslagen.') }}
        </p>
      </div>

    </div>
  </footer>
</template>
