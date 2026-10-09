<!-- layouts/default.vue -->
<script setup lang="ts">
import { usePreferencesStore, type CurrencyCode } from '~/stores/preferences'
import { useCartStore, type CartItem } from '~/stores/cart'
import CartDrawer from '~/components/CartDrawer.vue'

const { locale, locales, t } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const preferences = usePreferencesStore()
const cartStore = useCartStore()

// Supported store currencies for AC-1 switching
const availableCurrencies: CurrencyCode[] = ['SEK', 'EUR', 'USD']

// Current localized language display name
const currentLocaleName = computed(() => {
  const found = (locales.value as Array<{ code: string; name: string }>).find(
    (l) => l.code === locale.value
  )
  return found?.name || locale.value
})

// Client-side hydration on initial application mount (AC-3)
onMounted(() => {
  cartStore.hydrateCart();
})

useHead(() => ({
  htmlAttrs: {
    'data-theme': preferences.theme,
  },
}))

// Admin session verification
const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
const { data: adminSession, refresh: refreshAdminSession } = await useFetch(
  '/api/admin/auth/me',
  { headers }
)

// const isAdmin = computed(() => adminSession.value?.statusCode === 200)
const isAdmin = computed(() => adminSession.value?.authenticated === true)

const logout = async () => {
  try {
    await $fetch('/api/admin/auth/logout', { method: 'POST' })
    await refreshAdminSession()
    await navigateTo(localePath('/admin/login'))
  } catch (err) {
    console.error('Logout failed', err)
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content transition-all duration-150">
    <!-- DaisyUI Navbar -->
    <header class="navbar bg-base-100 shadow-sm sticky top-0 z-50">

      <!-- Brand Logo & Mobile Navigation Trigger -->
      <div class="flex-1 flex items-center gap-1">
        <!-- Mobile Hamburger Menu (Only visible on screens < 1024px) -->
        <div class="dropdown lg:hidden">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm">
            <Icon name="lucide:menu" class="h-5 w-5" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[20] mt-3 w-56 p-2 shadow-lg border border-base-200"
          >
            <!-- Storefront Pages -->
            <li class="menu-title text-xs uppercase text-base-content/50 font-bold">
              {{ t('nav.store', 'Butik') }}
            </li>
            <li>
              <NuxtLink :to="localePath('/catalog')">
                <Icon name="lucide:layout-grid" class="h-4 w-4" />
                {{ t('nav.catalog', 'Sortiment') }}
              </NuxtLink>
            </li>

            <!-- Future User Tabs (e.g. Orders, Favorites) can be added here -->

            <!-- Admin Management Section (Conditionally shown if isAdmin) -->
            <template v-if="isAdmin">
              <div class="divider my-1"></div>
              <li class="menu-title text-xs uppercase text-primary font-bold">
                {{ t('admin.nav.management', 'Administration') }}
              </li>
              <li>
                <NuxtLink :to="localePath('/admin/products')">
                  <Icon name="lucide:package" class="h-4 w-4" />
                  {{ t('admin.nav.products', 'Produkter') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink :to="localePath('/admin/allergens')">
                  <Icon name="lucide:shield-alert" class="h-4 w-4" />
                  {{ t('admin.nav.allergens', 'Allergener') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink :to="localePath('/admin/categories')">
                  <Icon name="lucide:folder-tree" class="h-4 w-4" />
                  {{ t('admin.nav.categories', 'Kategorier') }}
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>

        <!-- Store Brand Link -->
        <NuxtLink :to="localePath('/')" class="btn btn-ghost text-xl font-bold cursor-pointer gap-2">
          <Icon name="lucide:shopping-bag" class="h-6 w-6 text-primary" />
          <span class="hidden md:inline-block">{{ t('storeName', 'Siwar') }}</span>
        </NuxtLink>
      </div>
      <div class="flex-none flex items-center gap-2">
        <!-- Theme Toggler -->
        <label class="swap swap-rotate btn btn-ghost btn-circle">
          <!-- <input type="checkbox" v-model="isDark" />  --> <!--Commented out because it is supposed to get it from preference store now-->
          <input
            type="checkbox"
            :checked="preferences.theme === 'dark'"
            @change="preferences.toggleTheme()"
          />
          <Icon name="lucide:sun" class="swap-off h-5 w-5" />
          <Icon name="lucide:moon" class="swap-on h-5 w-5" />
        </label>

        <!-- Interactive Currency Switcher (AC-1) -->
        <div class="dropdown dropdown-end hidden sm:inline-block">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm font-semibold gap-1.5">
            <Icon name="lucide:coins" class="h-4 w-4 text-warning" />
            <span>{{ preferences.currency }}</span>
            <Icon name="lucide:chevron-down" class="h-3 w-3 opacity-50" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[1] w-28 p-1.5 shadow border border-base-200"
          >
            <li v-for="curr in availableCurrencies" :key="curr">
              <button
                type="button"
                :class="{ 'active font-bold !bg-primary !text-white': preferences.currency === curr }"
                @click="preferences.setCurrency(curr)"
              >
                {{ curr }}
              </button>
            </li>
          </ul>
        </div>


        <!-- Desktop Navigation Links (Visible on screens >= 1024px) -->
        <div class="hidden lg:flex items-center gap-1">
          <NuxtLink :to="localePath('/catalog')" class="btn btn-ghost btn-sm font-semibold gap-1">
            <Icon name="lucide:layout-grid" class="h-4 w-4" />
            {{ t('nav.catalog', 'Sortiment') }}
          </NuxtLink>

          <!-- Admin Management Links -->
          <template v-if="isAdmin">
            <NuxtLink :to="localePath('/admin/products')" class="btn btn-ghost btn-sm font-semibold text-primary gap-1">
              <Icon name="lucide:package" class="h-4 w-4" />
              {{ t('admin.nav.products', 'Produkter') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/admin/allergens')" class="btn btn-ghost btn-sm font-semibold text-primary gap-1">
              <Icon name="lucide:shield-alert" class="h-4 w-4" />
              {{ t('admin.nav.allergens', 'Allergener') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/admin/categories')" class="btn btn-ghost btn-sm font-semibold text-primary gap-1">
              <Icon name="lucide:folder-tree" class="h-4 w-4" />
              {{ t('admin.nav.categories', 'Kategorier') }}
            </NuxtLink>
            <NuxtLink :to="localePath('/admin/orders')" class="btn btn-ghost btn-sm font-semibold text-primary gap-1">
              <Icon name="lucide:clipboard-list" class="h-4 w-4" />
              {{ t('admin.nav.orders', 'Beställningar') }}
            </NuxtLink>
          </template>
        </div>
        <!-- Language Dropdown (Fixes the Arabic Reset Glitch) -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm font-normal gap-1">
            <Icon name="lucide:globe" class="h-4 w-4" />
            <span class="hidden md:inline-block">{{ currentLocaleName }}</span>
            <Icon name="lucide:chevron-down" class="h-4 w-4 opacity-50" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[1] w-36 p-1.5 shadow border border-base-200"
          >
            <li v-for="item in (locales as any[])" :key="item.code">
              <NuxtLink
                :to="switchLocalePath(item.code)"
                :class="{ 'active font-bold !bg-primary !text-white': locale === item.code }"
                class="transition-colors"
              >
                {{ item.name }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Cart Button -->
        <!-- <div class="dropdown dropdown-end">
          <NuxtLink :to="localePath('/cart')" class="btn btn-ghost btn-circle">
            <div class="indicator">
              <Icon name="lucide:shopping-cart" class="h-5 w-5" />
              <span class="badge badge-sm badge-primary indicator-item">0</span>
            </div>
          </NuxtLink>
        </div> -->
        <!-- Header Cart Trigger Button -->
      <button
        type="button"
        class="btn btn-ghost btn-circle"
        @click="cartStore.toggleDrawer()"
      >
        <div class="indicator">
          <Icon name="lucide:shopping-cart" class="size-5" />
          <span
            v-if="cartStore.totalItemCount > 0"
            class="badge badge-sm badge-primary indicator-item"
          >
            {{ cartStore.totalItemCount }}
          </span>
        </div>
      </button>
        <!-- Account / Profile Dropdown -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
            <div class="w-9 rounded-full bg-base-300 flex items-center justify-center text-base-content">
              <Icon name="lucide:user" class="h-5 w-5 mt-2" />
            </div>
          </div>
          <ul
            tabindex="0"
            class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow border border-base-200"
          >
            <template v-if="isAdmin">
              <li>
                <button
                  type="button"
                  @click="logout"
                  class="text-error font-bold hover:bg-base-300 transition-colors flex items-center gap-2"
                >
                  <Icon name="lucide:log-out" class="h-4 w-4" />
                  {{ t('admin.nav.logout', 'Logga ut') }}
                </button>
              </li>
            </template>
            <template v-else>
              <li>
                <NuxtLink :to="localePath('/admin/login')">
                  {{ t('admin.login.adminLogin', 'Admininloggning') }}
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </header>

    <!-- Main View Slot -->
    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
      <slot />
    </main>
    <CartDrawer />
  </div>
</template>