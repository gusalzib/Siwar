// tests/unit/favorites.store.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoritesStore } from '~/stores/favorites'

describe('Issue #31: Pinia Guest Favorites Store Suite', () => {
  let favoritesStore: ReturnType<typeof useFavoritesStore>
  let storage: Record<string, string>

  beforeEach(() => {
    setActivePinia(createPinia())

    storage = {}
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        storage[key] = String(val)
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key]
      }),
      clear: vi.fn(() => {
        for (const k in storage) delete storage[k]
      }),
    }

    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    favoritesStore = useFavoritesStore()
  })

  describe('AC-1: Bookmark Toggle & Local Persistence', () => {
    it('starts with zero favorites and empty array', () => {
      expect(favoritesStore.favoriteCount).toBe(0)
      expect(favoritesStore.favorites).toEqual([])
      expect(favoritesStore.isFavorite('prod_123')).toBe(false)
    })

    it('toggles product into favorites and updates favoriteCount', async () => {
      const added = favoritesStore.toggleFavorite('prod_1')
      expect(added).toBe(true)
      expect(favoritesStore.isFavorite('prod_1')).toBe(true)
      expect(favoritesStore.favoriteCount).toBe(1)
      expect(favoritesStore.favorites).toEqual(['prod_1'])

      await nextTick()
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'siwar_guest_favorites',
        JSON.stringify(['prod_1'])
      )
    })

    it('toggles product out of favorites when clicked again', async () => {
      favoritesStore.toggleFavorite('prod_1')
      expect(favoritesStore.isFavorite('prod_1')).toBe(true)

      const removed = favoritesStore.toggleFavorite('prod_1')
      expect(removed).toBe(false)
      expect(favoritesStore.isFavorite('prod_1')).toBe(false)
      expect(favoritesStore.favoriteCount).toBe(0)
      expect(favoritesStore.favorites).toEqual([])

      await nextTick()
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'siwar_guest_favorites',
        JSON.stringify([])
      )
    })

    it('handles adding and removing multiple products', async () => {
      favoritesStore.addFavorite('prod_1')
      favoritesStore.addFavorite('prod_2')
      favoritesStore.addFavorite('prod_3')

      expect(favoritesStore.favoriteCount).toBe(3)
      expect(favoritesStore.isFavorite('prod_2')).toBe(true)
      expect(favoritesStore.isFavorite('prod_4')).toBe(false)

      favoritesStore.removeFavorite('prod_2')
      expect(favoritesStore.favoriteCount).toBe(2)
      expect(favoritesStore.isFavorite('prod_2')).toBe(false)
      expect(favoritesStore.favorites).toEqual(['prod_1', 'prod_3'])
    })
  })

  describe('AC-4: Cross-Tab & Refresh Persistence', () => {
    it('hydrates saved product IDs from localStorage on startup', () => {
      storage['siwar_guest_favorites'] = JSON.stringify(['prod_abc', 'prod_xyz'])

      // Create a fresh store instance after storage is populated
      setActivePinia(createPinia())
      const freshStore = useFavoritesStore()
      freshStore.hydrateFavorites()

      expect(freshStore.favoriteCount).toBe(2)
      expect(freshStore.isFavorite('prod_abc')).toBe(true)
      expect(freshStore.isFavorite('prod_xyz')).toBe(true)
      expect(freshStore.isFavorite('prod_other')).toBe(false)
    })

    it('clears all favorites properly', async () => {
      favoritesStore.addFavorite('prod_1')
      favoritesStore.addFavorite('prod_2')
      expect(favoritesStore.favoriteCount).toBe(2)

      favoritesStore.clearFavorites()
      expect(favoritesStore.favoriteCount).toBe(0)
      expect(favoritesStore.favorites).toEqual([])

      await nextTick()
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'siwar_guest_favorites',
        JSON.stringify([])
      )
    })
  })
})
