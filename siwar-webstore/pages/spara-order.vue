<!-- pages/spara-order.vue -->
<script setup lang="ts">
const localePath = useLocalePath()
await navigateTo(localePath('/order/lookup'), { replace: true })
</script>

<template>
  <div class="min-h-screen bg-base-100 flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
</template>
