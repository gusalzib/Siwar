// stores/preferences.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CurrencyCode = 'SEK' | 'EUR' | 'USD'

export const usePreferencesStore = defineStore('preferences', () => {
  const currency = ref<CurrencyCode>('SEK')

  function setCurrency(newCurrency: CurrencyCode) {
    currency.value = newCurrency
  }

  return { currency, setCurrency }
})