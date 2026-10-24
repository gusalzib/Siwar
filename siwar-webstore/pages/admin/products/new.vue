<!-- pages/admin/products/new.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})
</script>

<template>
  <AdminProductForm mode="create" />
</template>