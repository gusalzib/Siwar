<!-- pages/index.vue -->
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold">
        {{ t('welcome') }}
      </h2>
      <p class="text-base-content/80 mt-4">
        {{ t('welcomeMessage') }}
      </p>
      <div class="card-actions justify-end mt-4">
        <button class="btn btn-primary">{{ t('callToAction.startShopping') }}</button>
      </div>
    </div>
  </div>
</template>