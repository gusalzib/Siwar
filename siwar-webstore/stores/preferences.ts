// stores/preferences.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CurrencyCode = 'SEK' | 'EUR' | 'USD'
export type ThemeMode = 'light' | 'dark'

export const usePreferencesStore = defineStore('preferences', () => {
  // useCookie reads during SSR from request headers and auto-persists in the browser
  const currencyCookie = useCookie<CurrencyCode>('siwar_currency', {
    default: () => 'SEK',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  const themeCookie = useCookie<ThemeMode>('siwar_theme', {
    default: () => 'light',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  // Reactive state initialized directly from the cookie
  const currency = ref<CurrencyCode>(currencyCookie.value || 'SEK')
  const theme = ref<ThemeMode>(themeCookie.value || 'light')

  function setCurrency(newCurrency: CurrencyCode) {
    currency.value = newCurrency
    currencyCookie.value = newCurrency
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme.value === 'dark' ? 'light' : 'dark'
    theme.value = nextTheme
    themeCookie.value = nextTheme
  }

  return {
    currency,
    theme,
    setCurrency,
    toggleTheme,
  }
})