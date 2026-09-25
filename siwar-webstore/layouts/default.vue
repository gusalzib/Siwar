<script setup lang="ts">
import { usePreferencesStore } from '#imports'
// Or if you prefer relative: import { usePreferencesStore } from '../stores/preferences'
// Wait, nuxt auto-imports stores usually, but let's be explicit to avoid breaking.
import { usePreferencesStore as usePrefStore } from '../stores/preferences'

const { locale, locales, setLocale, t } = useI18n()
const preferences = usePrefStore()

// Theme toggle logic
const isDark = ref(false)

useHead(() => ({
  htmlAttrs: {
    'data-theme': isDark.value ? 'dark' : 'light'
  }
}))
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content transition-all duration-150">
    <!-- DaisyUI Navbar -->
    <header class="navbar bg-base-100 shadow-sm sticky top-0 z-50">
      <div class="flex-1">
        <NuxtLink to="/" class="btn btn-ghost text-xl font-bold">
          <Icon name="lucide:shopping-bag" class="h-6 w-6 text-primary" />
          <span class="hidden sm:inline-block">{{ t('storeName') }}</span>
        </NuxtLink>
      </div>
      
      <div class="flex-none flex items-center gap-2">
        <!-- Theme Toggler -->
        <label class="swap swap-rotate btn btn-ghost btn-circle">
          <input type="checkbox" v-model="isDark" />
          <Icon name="lucide:sun" class="swap-off h-5 w-5" />
          <Icon name="lucide:moon" class="swap-on h-5 w-5" />
        </label>

        <!-- Currency -->
        <div class="hidden sm:flex items-center">
          <div class="btn btn-ghost btn-sm no-animation font-semibold">
            <Icon name="lucide:coins" class="h-4 w-4" />
            {{ preferences.currency }}
          </div>
        </div>

        <!-- Language Dropdown -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm font-normal">
            <Icon name="lucide:globe" class="h-4 w-4" />
            <span class="hidden sm:inline-block">{{ locales.find((l: any) => l.code === locale)?.name || locale }}</span>
            <Icon name="lucide:chevron-down" class="h-4 w-4 opacity-50" />
          </div>
          <ul tabindex="0" class="dropdown-content menu menu-sm bg-base-100 rounded-box z-[1] w-40 p-2 shadow border border-base-200">
            <li v-for="item in locales" :key="item.code">
              <a :class="{ 'active': locale === item.code }" @click="setLocale(item.code)">
                {{ item.name }}
              </a>
            </li>
          </ul>
        </div>
        
        <!-- Cart Button -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
            <div class="indicator">
              <Icon name="lucide:shopping-cart" class="h-5 w-5" />
              <span class="badge badge-sm badge-primary indicator-item">0</span>
            </div>
          </div>
        </div>

        <!-- Account / Profile -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
            <div class="w-9 rounded-full bg-base-300 flex items-center justify-center text-base-content">
              <Icon name="lucide:user" class="h-5 w-5 mt-2" />
            </div>
          </div>
          <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow border border-base-200">
            <li><NuxtLink to="/admin/login">{{ t('admin.login.adminLogin') }}</NuxtLink></li>
          </ul>
        </div>
      </div>
    </header>

    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
      <slot />
    </main>
  </div>
</template>
