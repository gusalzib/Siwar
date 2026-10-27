// stores/favorites.ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'siwar_guest_favorites'

// Helper that safely detects client runtime in both Nuxt SSR and Vitest
const isClient = () =>
  (typeof import.meta !== 'undefined' && Boolean(import.meta.client)) ||
  (typeof globalThis !== 'undefined' && Boolean((globalThis as any).window))

export const useFavoritesStore = defineStore('favorites', () => {
  // Reactive array of saved product IDs
  const favoriteIds = ref<string[]>([])
  const isHydrated = ref(false)

  /**
   * Directly save favorite IDs to localStorage
   */
  function saveToStorage(): void {
    if (isClient()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds.value))
      } catch (err) {
        console.error('Failed to save favorites to localStorage:', err)
      }
    }
  }

  /**
   * Hydrate favorites from localStorage upon client initialization.
   */
  function hydrateFavorites(): void {
    if (isClient() && !isHydrated.value) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            // Keep unique, non-empty string IDs
            favoriteIds.value = Array.from(
              new Set(
                parsed
                  .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
                  .map((id) => id.trim())
              )
            )
          }
        }
      } catch (err) {
        console.error('Failed to hydrate favorites from localStorage:', err)
      } finally {
        isHydrated.value = true
        // AC-3: Automatically verify and prune any archived (isActive: false) or deleted product IDs
        if (favoriteIds.value.length > 0) {
          verifyActiveFavorites()
        }
      }
    }
  }

  // Cross-tab synchronization via storage event
  if (isClient()) {
    try {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue !== null) {
          try {
            const parsed = JSON.parse(event.newValue)
            if (Array.isArray(parsed)) {
              favoriteIds.value = Array.from(
                new Set(
                  parsed
                    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
                    .map((id) => id.trim())
                )
              )
            }
          } catch {
            // Ignore parse errors from concurrent writes
          }
        }
      })
    } catch {
      // Catch in non-browser test runners
    }

    // Persist changes to localStorage once hydrated
    watch(
      favoriteIds,
      (newIds) => {
        if (isHydrated.value) {
          saveToStorage()
        }
      },
      { deep: true, flush: 'sync' }
    )
  }

  /**
   * Check if a product ID is currently bookmarked as favorite
   */
  function isFavorite(productId?: string | null): boolean {
    if (!productId) return false
    const id = String(productId).trim()
    return favoriteIds.value.includes(id)
  }

  /**
   * Toggle a product ID in or out of the favorites list.
   * Returns true if added, false if removed.
   */
  function toggleFavorite(productId?: string | null): boolean {
    if (!productId) return false
    const id = String(productId).trim()
    if (!id) return false

    // Ensure state is hydrated if triggered prior to explicit call
    if (!isHydrated.value && isClient()) {
      hydrateFavorites()
    }

    const index = favoriteIds.value.indexOf(id)
    if (index >= 0) {
      favoriteIds.value.splice(index, 1)
      favoriteIds.value = [...favoriteIds.value]
      saveToStorage()
      return false
    } else {
      favoriteIds.value.push(id)
      favoriteIds.value = [...favoriteIds.value]
      saveToStorage()
      return true
    }
  }

  /**
   * Explicitly add a product ID to favorites
   */
  function addFavorite(productId?: string | null): void {
    if (!productId) return
    const id = String(productId).trim()
    if (!id) return

    if (!isHydrated.value && isClient()) {
      hydrateFavorites()
    }
    if (!favoriteIds.value.includes(id)) {
      favoriteIds.value.push(id)
      favoriteIds.value = [...favoriteIds.value]
      saveToStorage()
    }
  }

  /**
   * Explicitly remove a product ID from favorites
   */
  function removeFavorite(productId?: string | null): boolean {
    if (!productId) return false
    const id = String(productId).trim()
    if (!id) return false

    if (!isHydrated.value && isClient()) {
      hydrateFavorites()
    }
    const index = favoriteIds.value.indexOf(id)
    if (index >= 0) {
      favoriteIds.value.splice(index, 1)
      favoriteIds.value = [...favoriteIds.value]
      saveToStorage()
      return true
    }
    return false
  }

  /**
   * Clear all favorites
   */
  function clearFavorites(): void {
    favoriteIds.value = []
    saveToStorage()
  }

  /**
   * AC-3: Synchronize store with an array of verified active product IDs.
   * Prunes any stored ID that is not in the active list (e.g. archived or deleted products).
   */
  function syncActiveFavorites(activeIds: string[]): void {
    const activeSet = new Set(activeIds.map((id) => String(id).trim()))
    const cleaned = favoriteIds.value.filter((id) => activeSet.has(id))
    if (cleaned.length !== favoriteIds.value.length) {
      favoriteIds.value = cleaned
      saveToStorage()
    }
  }

  /**
   * AC-3: Background verification: queries /api/products/batch to check if any
   * currently saved favorite IDs have been archived (isActive: false) or deleted.
   * Automatically syncs and updates the store and localStorage.
   */
  async function verifyActiveFavorites(): Promise<void> {
    if (!isClient() || favoriteIds.value.length === 0) return
    try {
      const data = await $fetch<any[]>('/api/products/batch', {
        method: 'POST',
        body: { ids: favoriteIds.value },
      })
      if (Array.isArray(data)) {
        const activeIds = data.map((p) => String(p.id || p._id))
        syncActiveFavorites(activeIds)
      }
    } catch {
      // Gracefully ignore network errors so offline/flaky connections don't wipe items
    }
  }

  // Reactive Getters
  const favoriteCount = computed<number>(() => favoriteIds.value.length)
  const favorites = computed<string[]>(() => [...favoriteIds.value])

  return {
    favoriteIds,
    isHydrated,
    favoriteCount,
    favorites,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
    syncActiveFavorites,
    verifyActiveFavorites,
    hydrateFavorites,
  }
})
