<template>
  <!-- Demo code to see how the page will look like. It should be changed and cleaned up later -->
  <div class="min-h-screen bg-slate-50 text-slate-900 transition-all duration-150">
    <header class="border-b bg-white p-4 shadow-sm">
      <div class="container mx-auto flex items-center justify-between">
        <h1 class="text-xl font-bold">{{ t('welcome') }}</h1>

        <!-- Controls: Language & Currency Switcher -->
        <div class="flex items-center gap-4">
          <div class="flex gap-2">
            <button
              v-for="item in locales"
              :key="item.code"
              @click="setLocale(item.code)"
              :class="[
                'rounded px-2.5 py-1 text-sm font-medium transition',
                locale === item.code ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
              ]"
            >
              {{ item.name }}
            </button>
          </div>

          <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">
            Currency: {{ preferences.currency }}
          </span>
        </div>
      </div>
    </header>

    <main class="container mx-auto p-6">
      <NuxtPage />
    </main>
  </div>
</template>


<script setup lang="ts">
import { usePreferencesStore } from '../stores/preferences'

const { locale, locales, localeProperties, setLocale, t } = useI18n()
const preferences = usePreferencesStore()

// Reactively apply HTML lang and dir tags based on active locale
/**
 * Nuxt's useHead composable dynamically injects attributes into the root <html> tag.
 * When a customer selects Arabic, this tag becomes <html lang="ar" dir="rtl">. When they select Swedish or English, it
 * reactively flips to dir="ltr".
 * This allows browsers and Tailwind CSS to invert text alignment, flex directions, and spacing from right-to-left to
 * left-to-right without visual glitching or page reloads.
 */
useHead(() => ({
  htmlAttrs: {
    lang: localeProperties.value.code,
    dir: localeProperties.value.dir || 'ltr',
  },
}))
</script>