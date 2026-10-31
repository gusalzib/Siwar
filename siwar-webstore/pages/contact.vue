<!-- pages/contact.vue - Kontakta oss / Contact Us / اتصل بنا -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SocialMediaShelf from '~/components/SocialMediaShelf.vue'
import { DEFAULT_GENERAL_CONFIG, formatWeeklySchedule } from '~/utils/schedule'
import { sanitizeWhatsAppNumber, getWhatsAppUrl } from '~/utils/social'

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic general settings from public endpoint
const { data: storeInfo, pending } = await useFetch<any>('/api/settings', {
  lazy: true,
})

// Store Address
const storeAddress = computed(() => {
  const addr = storeInfo.value?.address || DEFAULT_GENERAL_CONFIG.address
  return {
    street: addr.street || 'Åttingsstigen 41',
    postalCode: addr.postalCode || '302 54',
    city: addr.city || 'Halmstad',
    country: addr.country || 'Sverige',
  }
})

// Store Contact
const storeContact = computed(() => {
  return {
    phone: storeInfo.value?.contact?.phone || DEFAULT_GENERAL_CONFIG.contact.phone,
    email: storeInfo.value?.contact?.email || DEFAULT_GENERAL_CONFIG.contact.email,
  }
})

// ---------------------------------------------------------------------------
// WhatsApp Integration (Dynamic from StoreSettings + Device Awareness)
// ---------------------------------------------------------------------------
const isMobileDevice = ref(false)
const desktopWhatsAppPrompt = ref(false)

// Active WhatsApp link from storeSettings.socialLinks if available
const whatsAppSocialLink = computed(() => {
  return storeInfo.value?.socialLinks?.find(
    (l: any) => l.platform === 'whatsapp' && (l.isActive ?? true)
  )
})

// Raw phone number: prefer WhatsApp specific link from socialLinks if set, otherwise fallback to store contact phone
const rawWhatsAppPhone = computed(() => {
  const customUrl = whatsAppSocialLink.value?.url?.trim()
  if (customUrl) {
    return customUrl
  }
  return storeContact.value?.phone || DEFAULT_GENERAL_CONFIG.contact.phone
})

// Sanitized numeric-only phone number with international country code
const sanitizedWhatsAppPhone = computed(() => {
  return sanitizeWhatsAppNumber(rawWhatsAppPhone.value)
})

// Human-friendly display string
const whatsAppPhoneDisplay = computed(() => {
  const raw = rawWhatsAppPhone.value
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return '+' + sanitizedWhatsAppPhone.value
  }
  return raw
})

// Platform-aware URL: native deep link on mobile, WhatsApp Web on desktop
const whatsappUrl = computed(() => {
  return getWhatsAppUrl(sanitizedWhatsAppPhone.value, isMobileDevice.value)
})

function checkMobileDevice() {
  if (typeof navigator !== 'undefined') {
    isMobileDevice.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')
  }
}

onMounted(() => {
  checkMobileDevice()
})

function handleWhatsAppClick(event?: MouseEvent) {
  if (isMobileDevice.value) {
    if (typeof window !== 'undefined') {
      window.location.href = `whatsapp://send?phone=${sanitizedWhatsAppPhone.value}`
    }
  } else {
    desktopWhatsAppPrompt.value = true
  }
}

// Formatted opening hours for active locale
const formattedHours = computed(() => {
  const currentLang = (locale.value === 'ar' || locale.value === 'en') ? locale.value : 'sv'
  if (storeInfo.value?.openingHours?.[currentLang]) {
    return storeInfo.value.openingHours[currentLang]
  }
  if (storeInfo.value?.schedule) {
    return formatWeeklySchedule(storeInfo.value.schedule, currentLang)
  }
  return DEFAULT_GENERAL_CONFIG.openingHours?.[currentLang] || DEFAULT_GENERAL_CONFIG.openingHours?.sv || ''
})

// Google Maps directions search query link
const mapsUrl = computed(() => {
  const query = `${storeAddress.value.street}, ${storeAddress.value.postalCode} ${storeAddress.value.city}, ${storeAddress.value.country}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
})

// Google Maps embed URL
const mapsEmbedUrl = computed(() => {
  const query = `${storeAddress.value.street}, ${storeAddress.value.postalCode} ${storeAddress.value.city}, ${storeAddress.value.country}`
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
})

// ---------------------------------------------------------------------------
// Contact Form State & Validation
// ---------------------------------------------------------------------------
const form = ref({
  fullName: '',
  email: '',
  phone: '',
  orderReference: '',
  category: 'general' as 'general' | 'order' | 'product' | 'feedback',
  message: '',
})

const errors = ref<Record<string, string>>({})
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submissionReference = ref<string | null>(null)
const submitErrorMessage = ref<string | null>(null)

function validateForm(): boolean {
  errors.value = {}
  let valid = true

  if (!form.value.fullName || form.value.fullName.trim().length < 2) {
    errors.value.fullName = t('contactPage.form.validation.nameRequired', 'Vänligen ange ditt namn (minst 2 tecken).')
    valid = false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.value.email || !emailRegex.test(form.value.email.trim())) {
    errors.value.email = t('contactPage.form.validation.emailRequired', 'Vänligen ange en giltig e-postadress.')
    valid = false
  }

  if (!form.value.message || form.value.message.trim().length < 10) {
    errors.value.message = t('contactPage.form.validation.messageRequired', 'Meddelandet måste innehålla minst 10 tecken.')
    valid = false
  }

  return valid
}

async function handleSubmit() {
  submitErrorMessage.value = null
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    const res = await $fetch<any>('/api/contact', {
      method: 'POST',
      body: {
        fullName: form.value.fullName.trim(),
        email: form.value.email.trim(),
        phone: form.value.phone.trim() || undefined,
        orderReference: form.value.orderReference.trim() || undefined,
        category: form.value.category,
        message: form.value.message.trim(),
      },
    })

    submissionReference.value = res.referenceId || null
    isSubmitted.value = true
  } catch (err: any) {
    submitErrorMessage.value = err?.data?.statusMessage || err?.statusMessage || t('checkout.genericError', 'Ett oväntat fel inträffade. Försök igen.')
  } finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  form.value = {
    fullName: '',
    email: '',
    phone: '',
    orderReference: '',
    category: 'general',
    message: '',
  }
  errors.value = {}
  isSubmitted.value = false
  submissionReference.value = null
  submitErrorMessage.value = null
}

useSeoMeta({
  title: () => `${t('contactPage.metaTitle', 'Kontakta oss')} | Siwar`,
  description: () => t('contactPage.metaDesc', 'Har du frågor om vårt sortiment, öppettider eller beställningar? Kontakta Siwar.'),
  ogTitle: () => `${t('contactPage.metaTitle', 'Kontakta oss')} | Siwar`,
  ogDescription: () => t('contactPage.metaDesc', 'Har du frågor om vårt sortiment, öppettider eller beställningar? Kontakta Siwar.'),
})
</script>

<template>
  <div class="min-h-screen py-6 sm:py-10 space-y-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    
    <!-- 1. Header / Hero -->
    <header class="text-center space-y-3 max-w-2xl mx-auto pt-2">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20 text-xs font-bold uppercase tracking-wider">
        <Icon name="lucide:headphones" class="size-3.5 text-brand-500" />
        <span>{{ t('contactPage.badge', 'Kundservice & Butik') }}</span>
      </div>

      <h1 class="text-3xl sm:text-5xl font-black text-base-content tracking-tight">
        {{ t('contactPage.title', 'Vi finns här för att hjälpa dig') }}
      </h1>

      <p class="text-sm sm:text-base text-base-content/75 leading-relaxed font-medium">
        {{ t('contactPage.subtitle', 'Oavsett om du har frågor om en specifik vara, vill veta mer om våra öppettider eller behöver hjälp med en beställning är du alltid varmt välkommen att höra av dig.') }}
      </p>
    </header>

    <!-- 2. Interactive Contact Cards (Phone, WhatsApp, Email, Address, Hours) -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
      
      <!-- Phone Card -->
      <a
        :href="`tel:${storeContact.phone.replace(/\\s+/g, '')}`"
        class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-brand-500/60 transition-all duration-200 group flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="lucide:phone-call" class="size-5" />
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {{ t('contactPage.cards.phoneTitle', 'Telefon till butiken') }}
            </span>
            <span class="text-base sm:text-lg font-black text-base-content font-mono block mt-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {{ storeContact.phone }}
            </span>
          </div>
          <p class="text-xs text-base-content/65 leading-relaxed">
            {{ t('contactPage.cards.phoneDesc', 'Ring oss gärna direkt under butikens ordinarie öppettider för snabb hjälp.') }}
          </p>
        </div>
      </a>

      <!-- WhatsApp Card -->
      <a
        :href="whatsappUrl"
        :target="isMobileDevice ? undefined : '_blank'"
        rel="noopener noreferrer"
        class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-emerald-500/60 transition-all duration-200 group flex flex-col justify-between"
        @click="handleWhatsAppClick"
      >
        <div class="space-y-3">
          <div class="size-11 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="logos:whatsapp-icon" class="size-5" />
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {{ t('contactPage.cards.whatsappTitle', 'WhatsApp Kundsupport') }}
            </span>
            <span class="text-base sm:text-lg font-black text-base-content font-mono block mt-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {{ whatsAppPhoneDisplay }}
            </span>
          </div>
          <p class="text-xs text-base-content/65 leading-relaxed">
            {{ t('contactPage.cards.whatsappDesc', 'Snabbchatt direkt med oss för frågor om sortiment eller lagda ordrar.') }}
          </p>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-zinc-800/80 mt-3 space-y-1">
          <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <span>{{ isMobileDevice ? t('contactPage.cards.whatsappOpenApp', 'Öppna WhatsApp-appen') : t('contactPage.cards.whatsappOpenWeb', 'Öppna WhatsApp Web') }}</span>
            <Icon :name="isMobileDevice ? 'lucide:arrow-right' : 'lucide:external-link'" class="size-3 rtl:rotate-180" />
          </div>
          <div v-if="!isMobileDevice" class="text-[11px] text-base-content/50">
            {{ t('contactPage.cards.whatsappFallbackNotice', 'Klicka för att chatta i webbläsaren') }} ↗
          </div>
        </div>
      </a>

      <!-- Email Card -->
      <a
        :href="`mailto:${storeContact.email}`"
        class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-brand-500/60 transition-all duration-200 group flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="size-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="lucide:mail" class="size-5" />
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {{ t('contactPage.cards.emailTitle', 'E-post & Kundsupport') }}
            </span>
            <span class="text-sm sm:text-base font-bold text-base-content block mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {{ storeContact.email }}
            </span>
          </div>
          <p class="text-xs text-base-content/65 leading-relaxed">
            {{ t('contactPage.cards.emailDesc', 'Vi besvarar e-postfrågor så snart vi kan, normalt inom 24 timmar.') }}
          </p>
        </div>
      </a>

      <!-- Address Card -->
      <a
        :href="mapsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-brand-500/60 transition-all duration-200 group flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="lucide:map-pin" class="size-5" />
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {{ t('contactPage.cards.addressTitle', 'Besöksadress') }}
            </span>
            <span class="text-sm sm:text-base font-bold text-base-content block mt-0.5 group-hover:text-primary transition-colors">
              {{ storeAddress.street }}, {{ storeAddress.city }}
            </span>
          </div>
          <p class="text-xs text-base-content/65 leading-relaxed">
            {{ storeAddress.postalCode }} {{ storeAddress.city }} • {{ t('contactPage.cards.openInMaps', 'Öppna i Google Maps') }} ↗
          </p>
        </div>
      </a>

      <!-- Opening Hours Card -->
      <NuxtLink
        :to="localePath('/oppettider')"
        class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-brand-500/60 transition-all duration-200 group flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="size-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Icon name="lucide:clock" class="size-5" />
          </div>
          <div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {{ t('contactPage.cards.hoursTitle', 'Butikens Öppettider') }}
            </span>
            <span class="text-xs sm:text-sm font-semibold text-base-content font-mono block mt-0.5 line-clamp-1 group-hover:text-amber-500 transition-colors">
              {{ formattedHours || 'Mån-Fre 10-18 | Lör 11-15' }}
            </span>
          </div>
          <p class="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
            <span>{{ t('contactPage.cards.viewHours', 'Se alla tider') }}</span>
            <Icon name="lucide:arrow-right" class="size-3 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
          </p>
        </div>
      </NuxtLink>

    </section>

    <!-- Desktop WhatsApp Fallback Banner / CTA -->
    <div
      v-if="desktopWhatsAppPrompt"
      class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div class="flex items-center gap-3">
        <div class="size-9 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <Icon name="logos:whatsapp-icon" class="size-5" />
        </div>
        <div>
          <h4 class="font-bold text-sm text-emerald-900 dark:text-emerald-200">
            {{ t('contactPage.cards.whatsappFallbackBannerTitle', 'Starta WhatsApp Web') }}
          </h4>
          <p class="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            {{ t('contactPage.cards.whatsappFallbackBannerDesc', 'Öppnades inte WhatsApp Web automatiskt i en ny flik? Klicka på knappen för att fortsätta chatten.') }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
        <a
          :href="`https://web.whatsapp.com/send?phone=${sanitizedWhatsAppPhone}`"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm bg-emerald-600 hover:bg-emerald-700 !text-white font-bold border-none rounded-xl gap-1.5 shadow-xs"
        >
          <span>{{ t('contactPage.cards.whatsappFallbackBannerAction', 'Öppna WhatsApp Web') }}</span>
          <Icon name="lucide:external-link" class="size-3.5" />
        </a>
        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle text-slate-500 hover:text-slate-800 dark:hover:text-white"
          :aria-label="t('common.close', 'Stäng')"
          @click="desktopWhatsAppPrompt = false"
        >
          <Icon name="lucide:x" class="size-4" />
        </button>
      </div>
    </div>

    <!-- 3. Two-Column Layout: Form (Left) & Map / Social (Right) -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- Left Column: Contact Form -->
      <div class="lg:col-span-7 card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200 dark:bg-zinc-800 text-xs font-bold text-base-content/80">
            <Icon name="lucide:message-square" class="size-3.5 text-primary" />
            <span>{{ t('contactPage.form.badge', 'Skicka meddelande') }}</span>
          </div>
          <h2 class="text-2xl font-black text-base-content tracking-tight">
            {{ t('contactPage.form.title', 'Kontakta oss direkt via formuläret') }}
          </h2>
          <p class="text-xs sm:text-sm text-base-content/70">
            {{ t('contactPage.form.desc', 'Fyll i dina kontaktuppgifter och ditt meddelande nedan så återkommer vi till din angivna e-postadress så fort som möjligt.') }}
          </p>
        </div>

        <!-- Success Feedback Card -->
        <div v-if="isSubmitted" class="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 space-y-3">
          <div class="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
            <Icon name="lucide:check-circle-2" class="size-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <h3 class="font-bold text-lg">
              {{ t('contactPage.form.successTitle', 'Tack för ditt meddelande!') }}
            </h3>
          </div>
          <p class="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
            {{ t('contactPage.form.successDesc', 'Vi har tagit emot ditt ärende och återkopplar till din e-postadress så snart som möjligt.') }}
          </p>
          <div v-if="submissionReference" class="text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300">
            Referens: {{ submissionReference }}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white rounded-xl mt-2 font-bold"
            @click="resetForm"
          >
            {{ t('contactPage.form.sendAnother', 'Skicka ytterligare ett meddelande') }}
          </button>
        </div>

        <!-- Form Element -->
        <form v-else class="space-y-4" @submit.prevent="handleSubmit">
          
          <!-- Name & Email Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Full Name -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-base-content flex items-center justify-between">
                <span>{{ t('contactPage.form.nameLabel', 'Ditt fullständiga namn') }} <span class="text-error">*</span></span>
              </label>
              <input
                v-model="form.fullName"
                type="text"
                required
                :placeholder="t('contactPage.form.namePlaceholder', 't.ex. Fatima Svensson')"
                class="input input-bordered w-full h-11 rounded-xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none"
                :class="{ 'border-error': errors.fullName }"
              />
              <span v-if="errors.fullName" class="text-xs font-medium text-error block">
                {{ errors.fullName }}
              </span>
            </div>

            <!-- Email -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-base-content flex items-center justify-between">
                <span>{{ t('contactPage.form.emailLabel', 'E-postadress') }} <span class="text-error">*</span></span>
              </label>
              <input
                v-model="form.email"
                type="email"
                required
                :placeholder="t('contactPage.form.emailPlaceholder', 'din.epost@example.com')"
                class="input input-bordered w-full h-11 rounded-xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none"
                :class="{ 'border-error': errors.email }"
              />
              <span v-if="errors.email" class="text-xs font-medium text-error block">
                {{ errors.email }}
              </span>
            </div>
          </div>

          <!-- Phone & Order Reference Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Phone -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-base-content">
                {{ t('contactPage.form.phoneLabel', 'Telefonnummer (valfritt)') }}
              </label>
              <input
                v-model="form.phone"
                type="tel"
                :placeholder="t('contactPage.form.phonePlaceholder', '070 123 45 67')"
                class="input input-bordered w-full h-11 rounded-xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <!-- Order Reference -->
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-base-content">
                {{ t('contactPage.form.orderRefLabel', 'Ordernummer (om ärendet gäller en order)') }}
              </label>
              <input
                v-model="form.orderReference"
                type="text"
                :placeholder="t('contactPage.form.orderRefPlaceholder', 't.ex. ORD-12345')"
                class="input input-bordered w-full h-11 rounded-xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <!-- Category Select -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-base-content">
              {{ t('contactPage.form.categoryLabel', 'Vad gäller ditt ärende?') }}
            </label>
            <select
              v-model="form.category"
              class="select select-bordered w-full h-11 min-h-[44px] rounded-xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="general">{{ t('contactPage.form.categories.general', 'Allmän fråga om butiken') }}</option>
              <option value="order">{{ t('contactPage.form.categories.order', 'Fråga om beställning eller leverans') }}</option>
              <option value="product">{{ t('contactPage.form.categories.product', 'Sortimentsfråga / allergener') }}</option>
              <option value="feedback">{{ t('contactPage.form.categories.feedback', 'Förslag eller synpunkter') }}</option>
            </select>
          </div>

          <!-- Message Textarea -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-base-content flex items-center justify-between">
              <span>{{ t('contactPage.form.messageLabel', 'Ditt meddelande') }} <span class="text-error">*</span></span>
              <span class="text-[11px] text-base-content/60 font-mono">{{ form.message.length }} tecken</span>
            </label>
            <textarea
              v-model="form.message"
              required
              rows="5"
              :placeholder="t('contactPage.form.messagePlaceholder', 'Beskriv ditt ärende så utförligt som möjligt så hjälper vi dig snabbare...')"
              class="textarea textarea-bordered w-full rounded-2xl text-sm border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-brand-500 focus:outline-none"
              :class="{ 'border-error': errors.message }"
            ></textarea>
            <span v-if="errors.message" class="text-xs font-medium text-error block">
              {{ errors.message }}
            </span>
          </div>

          <!-- Error Alert -->
          <div v-if="submitErrorMessage" class="alert alert-error text-xs rounded-xl font-semibold">
            <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
            <span>{{ submitErrorMessage }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isSubmitting"
            class="btn bg-brand-500 hover:bg-brand-600 !text-white font-bold border-none w-full h-12 rounded-xl gap-2 shadow-sm text-sm"
          >
            <span v-if="isSubmitting" class="loading loading-spinner loading-sm" />
            <Icon v-else name="lucide:send" class="size-4" />
            <span>{{ isSubmitting ? t('contactPage.form.submitting', 'Skickar meddelande...') : t('contactPage.form.submitButton', 'Skicka meddelande') }}</span>
          </button>
        </form>
      </div>

      <!-- Right Column: Interactive Map & Social Media Shelf (Explicit Requirement) -->
      <div class="lg:col-span-5 space-y-6">
        
        <!-- Social Media Shelf Card (Explicit Requirement) -->
        <div class="card bg-slate-900 text-white border-2 border-slate-800 rounded-3xl p-6 sm:p-7 shadow-md space-y-4">
          <div class="flex items-start gap-3">
            <div class="size-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
              <Icon name="lucide:share-2" class="size-5" />
            </div>
            <div class="space-y-1">
              <div class="text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                {{ t('contactPage.social.badge', 'Sociala medier') }}
              </div>
              <h3 class="text-lg font-bold tracking-tight text-white">
                {{ t('contactPage.social.title', 'Koppla upp med oss i sociala medier') }}
              </h3>
            </div>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed font-normal">
            {{ t('contactPage.social.desc', 'Har du en snabb fråga, vill tipsa om en produkt eller följa våra senaste nyheter? Du når oss även via våra sociala kanaler.') }}
          </p>

          <!-- Social Media Shelf -->
          <div class="pt-2">
            <SocialMediaShelf :links="storeInfo?.socialLinks" size="md" />
          </div>
        </div>

        <!-- Interactive Google Map Embed Card -->
        <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon name="lucide:map" class="size-5 text-primary" />
              <h3 class="font-bold text-base text-base-content">
                {{ t('contactPage.map.title', 'Hitta till vår fysiska butik') }}
              </h3>
            </div>
            <a
              :href="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-xs btn-ghost text-primary font-bold gap-1"
            >
              <span>{{ t('contactPage.map.directions', 'Vägbeskrivning') }}</span>
              <Icon name="lucide:external-link" class="size-3" />
            </a>
          </div>

          <!-- Embedded Map -->
          <div class="w-full aspect-16/10 rounded-2xl overflow-hidden bg-base-200 border border-base-300 dark:border-zinc-700 relative">
            <iframe
              :src="mapsEmbedUrl"
              class="w-full h-full border-0"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              title="Siwar Butik Halmstad Karta"
            ></iframe>
          </div>

          <!-- Map Reassurance Badges -->
          <div class="space-y-2 text-xs text-base-content/75 pt-1">
            <div class="flex items-center gap-2">
              <Icon name="lucide:check-circle" class="size-4 text-emerald-500 shrink-0" />
              <span>{{ t('contactPage.map.freeParking', 'Kostnadsfri kundparkering i anslutning till butiken') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="lucide:bus" class="size-4 text-blue-500 shrink-0" />
              <span>{{ t('contactPage.map.busNearby', 'Nära busshållplats och smidig tillgänglighet') }}</span>
            </div>
          </div>
        </div>

      </div>

    </section>

  </div>
</template>
