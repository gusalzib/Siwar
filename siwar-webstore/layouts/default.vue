<!-- layouts/default.vue -->
<script setup lang="ts">
import { usePreferencesStore, type CurrencyCode } from '~/stores/preferences'
import { useCartStore, type CartItem } from '~/stores/cart'
import CartDrawer from '~/components/CartDrawer.vue'
import StoreFooter from '~/components/StoreFooter.vue'

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
  <div class="min-h-screen flex flex-col bg-base-200 text-base-content transition-all duration-150 overflow-x-clip">
    <!-- DaisyUI Navbar -->
    <header class="navbar bg-base-100 shadow-sm sticky top-0 z-50 px-1.5 sm:px-4 gap-1 sm:gap-2">

      <!-- Left: Brand Logo & Mobile Navigation Trigger -->
      <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <!-- Mobile Hamburger Menu (Only visible on screens < 1024px) -->
        <div class="dropdown lg:hidden">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm">
            <Icon name="lucide:menu" class="h-5 w-5" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[20] mt-3 w-60 p-2.5 shadow-xl border border-base-300"
          >
            <!-- Storefront Pages -->
            <li class="menu-title text-xs uppercase text-base-content/70 font-bold px-2 py-1">
              {{ t('nav.store', 'Butik') }}
            </li>
            <li>
              <NuxtLink
                :to="localePath('/catalog')"
                class="font-medium text-base-content"
                active-class="!bg-brand-600 !text-white font-bold shadow-xs"
              >
                <Icon name="lucide:layout-grid" class="h-4 w-4" />
                {{ t('nav.catalog', 'Sortiment') }}
              </NuxtLink>
            </li>

            <!-- Preferences / Quick Settings on Mobile -->
            <div class="divider my-1 border-base-300"></div>
            <li class="menu-title text-xs uppercase text-base-content/70 font-bold px-2 py-1">
              {{ t('nav.preferences', 'Inställningar') }}
            </li>
            <li>
              <button
                type="button"
                class="flex items-center justify-between font-medium text-base-content py-2"
                @click="preferences.toggleTheme()"
              >
                <span class="flex items-center gap-2">
                  <Icon :name="preferences.theme === 'dark' ? 'lucide:moon' : 'lucide:sun'" class="h-4 w-4 text-warning" />
                  {{ preferences.theme === 'dark' ? t('theme.dark', 'Mörkt läge') : t('theme.light', 'Ljust läge') }}
                </span>
                <span class="badge badge-xs badge-ghost uppercase font-mono">{{ preferences.theme }}</span>
              </button>
            </li>

            <!-- Admin Management Section (Conditionally shown if isAdmin) -->
            <template v-if="isAdmin">
              <div class="divider my-1 border-base-300"></div>
              <li class="menu-title text-xs uppercase text-purple-700 dark:text-purple-300 font-bold px-2 py-1">
                {{ t('admin.nav.management', 'Administration') }}
              </li>
              <li>
                <NuxtLink
                  :to="localePath('/admin/products')"
                  class="admin-nav-link font-medium text-purple-700 dark:text-purple-300"
                  active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
                >
                  <Icon name="lucide:package" class="h-4 w-4" />
                  {{ t('admin.nav.products', 'Produkter') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  :to="localePath('/admin/orders')"
                  class="admin-nav-link font-medium text-purple-700 dark:text-purple-300"
                  active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
                >
                  <Icon name="lucide:clipboard-list" class="h-4 w-4" />
                  {{ t('admin.nav.orders', 'Beställningar') }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  :to="localePath('/admin/settings')"
                  class="admin-nav-link font-medium text-purple-700 dark:text-purple-300"
                  active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
                >
                  <Icon name="lucide:settings" class="h-4 w-4" />
                  {{ t('admin.nav.settings', 'Butiksinställningar') }}
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>

        <!-- Store Brand Link -->
        <NuxtLink :to="localePath('/')" class="btn btn-ghost text-base sm:text-xl font-bold cursor-pointer gap-1.5 sm:gap-2 px-1 sm:px-2 shrink-0">
          <Icon name="lucide:shopping-bag" class="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <span class="inline-block">{{ t('storeName', 'Siwar') }}</span>
        </NuxtLink>
      </div>

      <!-- Center: Desktop Navigation Links (Visible on screens >= 1024px) -->
      <nav class="hidden lg:flex items-center justify-center gap-1 xl:gap-2 flex-1 min-w-0 px-2">
        <NuxtLink
          :to="localePath('/catalog')"
          class="btn btn-ghost btn-sm font-semibold gap-1 px-2.5 text-xs xl:text-sm transition-colors text-base-content hover:bg-base-200"
          active-class="!bg-brand-600 !text-white font-bold shadow-xs"
        >
          <Icon name="lucide:layout-grid" class="h-4 w-4" />
          {{ t('nav.catalog', 'Sortiment') }}
        </NuxtLink>

        <!-- Admin Management Links -->
        <template v-if="isAdmin">
          <NuxtLink
            :to="localePath('/admin/products')"
            class="btn btn-ghost btn-sm font-semibold gap-1 px-2.5 text-xs xl:text-sm text-purple-700 dark:text-purple-300 visited:text-purple-700 dark:visited:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-950/50 transition-colors"
            active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
          >
            <Icon name="lucide:package" class="h-4 w-4" />
            {{ t('admin.nav.products', 'Produkter') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/admin/orders')"
            class="btn btn-ghost btn-sm font-semibold gap-1 px-2.5 text-xs xl:text-sm text-purple-700 dark:text-purple-300 visited:text-purple-700 dark:visited:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-950/50 transition-colors"
            active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
          >
            <Icon name="lucide:clipboard-list" class="h-4 w-4" />
            {{ t('admin.nav.orders', 'Beställningar') }}
          </NuxtLink>
          <NuxtLink
            :to="localePath('/admin/settings')"
            class="btn btn-ghost btn-sm font-semibold gap-1 px-2.5 text-xs xl:text-sm text-purple-700 dark:text-purple-300 visited:text-purple-700 dark:visited:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-950/50 transition-colors"
            active-class="!bg-purple-700 dark:!bg-purple-600 !text-white font-bold shadow-xs"
          >
            <Icon name="lucide:settings" class="h-4 w-4" />
            {{ t('admin.nav.settings', 'Butiksinställningar') }}
          </NuxtLink>
        </template>
      </nav>

      <!-- Right: Utility Controls (Currency, Language, Theme, Cart, Profile) -->
      <div class="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
        <!-- Interactive Currency Switcher (AC-1) -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm font-semibold gap-1 px-1.5 sm:px-2.5">
            <Icon name="lucide:coins" class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
            <span class="text-xs sm:text-sm font-bold">{{ preferences.currency }}</span>
            <Icon name="lucide:chevron-down" class="h-3 w-3 opacity-50 hidden sm:inline-block" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[20] w-32 p-1.5 shadow-lg border border-base-200 flex-col flex-nowrap"
          >
            <li v-for="curr in availableCurrencies" :key="curr" class="w-full">
              <button
                type="button"
                class="w-full flex items-center justify-between text-start px-3 py-1.5 rounded-lg transition-colors"
                :class="{ 'active font-bold !bg-primary !text-white': preferences.currency === curr }"
                @click="preferences.setCurrency(curr)"
              >
                <span>{{ curr }}</span>
                <Icon
                  v-if="preferences.currency === curr"
                  name="lucide:check"
                  class="size-3.5 shrink-0"
                />
              </button>
            </li>
          </ul>
        </div>

        <!-- Language Dropdown (Fixes the Arabic Reset Glitch) -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm sm:btn-sm sm:w-auto sm:px-2.5 sm:rounded-btn gap-1">
            <Icon name="lucide:globe" class="h-4 w-4" />
            <span class="hidden sm:inline-block text-xs sm:text-sm">{{ currentLocaleName }}</span>
            <Icon name="lucide:chevron-down" class="h-3 w-3 opacity-50 hidden sm:inline-block" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[20] w-36 p-1.5 shadow-lg border border-base-200 flex-col flex-nowrap"
          >
            <li v-for="item in (locales as any[])" :key="item.code" class="w-full">
              <NuxtLink
                :to="switchLocalePath(item.code)"
                class="w-full flex items-center justify-between text-start px-3 py-1.5 rounded-lg transition-colors"
                :class="{ 'active font-bold !bg-primary !text-white': locale === item.code }"
              >
                <span>{{ item.name }}</span>
                <Icon
                  v-if="locale === item.code"
                  name="lucide:check"
                  class="size-3.5 shrink-0"
                />
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Theme Toggler -->
        <label class="swap swap-rotate btn btn-ghost btn-circle btn-sm">
          <input
            type="checkbox"
            :checked="preferences.theme === 'dark'"
            @change="preferences.toggleTheme()"
          />
          <Icon name="lucide:sun" class="swap-off h-4 w-4 sm:h-5 sm:w-5" />
          <Icon name="lucide:moon" class="swap-on h-4 w-4 sm:h-5 sm:w-5" />
        </label>

        <!-- Header Cart Trigger Button -->
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          @click="cartStore.toggleDrawer()"
        >
          <div class="indicator">
            <Icon name="lucide:shopping-cart" class="size-4 sm:size-5" />
            <span
              v-if="cartStore.totalItemCount > 0"
              class="badge badge-xs sm:badge-sm badge-primary indicator-item"
            >
              {{ cartStore.totalItemCount }}
            </span>
          </div>
        </button>

        <!-- Account / Profile Dropdown -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm avatar">
            <div class="w-7 sm:w-8 rounded-full bg-base-300 flex items-center justify-center text-base-content">
              <Icon name="lucide:user" class="h-4 w-4 sm:h-5 sm:w-5 mt-1 sm:mt-1.5" />
            </div>
          </div>
          <ul
            tabindex="0"
            class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[20] mt-3 w-52 p-2 shadow-lg border border-base-200 flex-col flex-nowrap"
          >
            <template v-if="isAdmin">
              <li class="w-full">
                <button
                  type="button"
                  @click="logout"
                  class="w-full text-error font-bold hover:bg-base-300 transition-colors flex items-center gap-2"
                >
                  <Icon name="lucide:log-out" class="h-4 w-4" />
                  {{ t('admin.nav.logout', 'Logga ut') }}
                </button>
              </li>
            </template>
            <template v-else>
              <li class="w-full">
                <NuxtLink :to="localePath('/admin/login')" class="w-full flex items-center gap-2">
                  <Icon name="lucide:lock" class="h-4 w-4" />
                  {{ t('admin.login.adminLogin', 'Admininloggning') }}
                </NuxtLink>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </header>

    <!-- Main View Slot -->
    <main class="container mx-auto p-4 sm:p-6 lg:p-8 flex-1">
      <slot />
    </main>

    <!-- Global Multi-Column Storefront Footer -->
    <StoreFooter />

    <CartDrawer />
  </div>
</template>