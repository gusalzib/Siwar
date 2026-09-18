<!-- pages/index.vue -->
<template>
  <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <p class="text-lg">{{ t('welcome') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>