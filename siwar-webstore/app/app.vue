<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>


<script setup lang="ts">
const { localeProperties } = useI18n()

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