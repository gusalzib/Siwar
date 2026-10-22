<!-- pages/admin/settings/banners.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})

const localePath = useLocalePath()
await navigateTo(localePath('/admin/settings?tab=banners'), { replace: true })
</script>

<template>
  <div class="flex justify-center items-center py-24">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
</template>
