<!-- pages/admin/products/[id].vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})

const route = useRoute()
const productId = String(route.params.id)
</script>

<template>
  <AdminProductForm mode="edit" :product-id="productId" />
</template>