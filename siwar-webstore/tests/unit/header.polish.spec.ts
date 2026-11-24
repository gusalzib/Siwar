// tests/unit/header.polish.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Header, Currency & Language Selector Polish (Issue #56 - Task 2)', () => {
  const layoutPath = path.resolve(__dirname, '../../layouts/default.vue')
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8')

  describe('1. Currency Switcher Polish', () => {
    it('restricts availableCurrencies to SEK and EUR only, removing USD from the storefront', () => {
      expect(layoutContent).toContain("availableCurrencies: CurrencyCode[] = ['SEK', 'EUR']")
      expect(layoutContent).not.toContain("availableCurrencies: CurrencyCode[] = ['SEK', 'EUR', 'USD']")
    })
  })

  describe('2. Account Menu & Admin Login Link Removal', () => {
    it('hides the account/profile dropdown for unauthenticated visitors using v-if="isAdmin"', () => {
      expect(layoutContent).toContain('v-if="isAdmin" class="dropdown dropdown-end"')
    })

    it('removes the public /admin/login link from the header dropdown', () => {
      expect(layoutContent).not.toContain('<NuxtLink :to="localePath(\'/admin/login\')"')
      expect(layoutContent).toContain("t('admin.nav.logout', 'Logga ut')")
    })
  })

  describe('3. Language Selector Flag Icons', () => {
    it('maps supported locales (sv, ar, en) to recognizable country flags via circle-flags', () => {
      expect(layoutContent).toContain("'circle-flags:se'")
      expect(layoutContent).toContain("'circle-flags:sa'")
      expect(layoutContent).toContain("'circle-flags:gb'")
    })

    it('renders currentLocaleFlag and locale flags on dropdown options', () => {
      expect(layoutContent).toContain(':name="currentLocaleFlag"')
      expect(layoutContent).toContain(':name="localeFlagMap[item.code]')
      expect(layoutContent).toContain(':aria-label="t(\'nav.selectLanguage\', \'Välj språk\')"')
    })
  })
})
