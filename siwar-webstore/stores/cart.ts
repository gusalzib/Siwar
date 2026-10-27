// stores/cart.ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { usePreferencesStore, type CurrencyCode } from './preferences'
import { DEFAULT_SHIPPING_CONFIG } from '~/utils/shipping'

export interface MultilingualText {
  ar?: string
  sv?: string
  en?: string
}

export interface MultiCurrencyPrice {
  SEK: number // Integer minor units (öre)
  EUR: number // Integer minor units (cents)
  USD: number // Integer minor units (cents)
}

export interface CartItem {
  productId: string
  sku?: string
  name: MultilingualText
  thumbnailUrl: string
  price: MultiCurrencyPrice
  momsRate: 12 | 25
  grossWeight: number // Packaging weight in grams
  availableStock: number // Clamped by MAX(0, Total_Stock - Buffer)
  quantity: number
}

export type CartActionStatus =
  | 'SUCCESS'
  | 'EXCEEDS_AVAILABLE_STOCK'
  | 'OUT_OF_STOCK_ONLINE'
  | 'ITEM_REMOVED'

export interface MomsSummary {
  itemsMoms12Minor: number
  itemsMoms25Minor: number
  shippingMoms25Minor: number
  totalMomsMinor: number
}

const STORAGE_KEY = 'siwar_cart'

// Helper that safely detects client runtime in both Nuxt SSR and Vitest
const isClient = () =>
  (typeof import.meta !== 'undefined' && Boolean(import.meta.client)) ||
  (typeof globalThis !== 'undefined' && Boolean((globalThis as any).window))

export const useCartStore = defineStore('cart', () => {
  const preferences = usePreferencesStore()
  
  // State
  const items = ref<CartItem[]>([])
  const isDrawerOpen = ref(false)
  const isHydrated = ref(false)

  // ---------------------------------------------------------------------------
  // Session Persistence (AC-3)
  // ---------------------------------------------------------------------------
  function hydrateCart(): void {
    if (isClient() && !isHydrated.value) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            items.value = parsed
          }
        }
      } catch (err) {
        console.error('Failed to hydrate cart from localStorage:', err)
      } finally {
        isHydrated.value = true
        if (items.value.length > 0) {
          refreshCartPricesAndStock()
        }
      }
    } else if (isClient() && isHydrated.value && items.value.length > 0) {
      refreshCartPricesAndStock()
    }
  }

  // Sync state mutations to localStorage strictly on client
  if (isClient()) {
    watch(
      items,
      (newItems) => {
        if (isHydrated.value) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems))
        }
      },
      { deep: true, flush: 'sync' }
    )
  }

  // ---------------------------------------------------------------------------
  // Reactive Getters: Base Metrics & Active Currency (AC-2)
  // ---------------------------------------------------------------------------
  const activeCurrency = computed<CurrencyCode>(() => preferences.currency || 'SEK')

  const totalItemCount = computed<number>(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalGrossWeightGrams = computed<number>(() => {
    return items.value.reduce((sum, item) => {
      const weight = Number(item.grossWeight) || 0
      return sum + (weight * item.quantity)
    }, 0)
  })

  // ---------------------------------------------------------------------------
  // Line Item Totals & Subtotals (Net and Gross)
  // ---------------------------------------------------------------------------
  /**
   * Evaluates line totals, extracted VAT per item, and net amounts.
   */
  const lineItemTotals = computed(() => {
    const curr = activeCurrency.value
    return items.value.map((item) => {
      const unitPriceMinor = item.price[curr] ?? item.price.SEK
      const lineGross = unitPriceMinor * item.quantity
      const rate = item.momsRate === 12 ? 12 : 25
      const lineTax = Math.round((lineGross * rate) / (100 + rate))
      const lineNet = lineGross - lineTax

      return {
        productId: item.productId,
        unitPriceMinor,
        lineGross,
        lineNet,
        lineTax,
        momsRate: item.momsRate,
      }
    })
  })

  /**
   * Net subtotal of all products (excluding moms and shipping)
   */
  const productsNetMinor = computed<number>(() => {
    return lineItemTotals.value.reduce((sum, line) => sum + line.lineNet, 0)
  })

  /**
   * Gross product subtotal (inclusive of moms, before shipping)
   */
  const cartSubtotalMinor = computed<number>(() => {
    return lineItemTotals.value.reduce((sum, line) => sum + line.lineGross, 0)
  })

  // ---------------------------------------------------------------------------
  // Shipping Calculations (Tiered by weight & SEK subtotal)
  // ---------------------------------------------------------------------------
  const shippingFeeMinor = computed<number>(() => {
    if (items.value.length === 0 || isFreeShippingQualified.value) {
      return 0
    }

    const curr = activeCurrency.value
    const weightGrams = totalGrossWeightGrams.value
    const matchedTier = DEFAULT_SHIPPING_CONFIG.tiers.find(
      (tier) => weightGrams <= tier.maxWeightGrams
    )

    const fallbackTier = DEFAULT_SHIPPING_CONFIG.tiers[DEFAULT_SHIPPING_CONFIG.tiers.length - 1]
    const targetTier = matchedTier || fallbackTier

    return targetTier?.price[curr] ?? targetTier?.price.SEK ?? 10900
  })

  // 1. Evaluate if free shipping threshold is met in the current currency
  const isFreeShippingQualified = computed<boolean>(() => {
    if (items.value.length === 0) return false
    const curr = activeCurrency.value
    const threshold = DEFAULT_SHIPPING_CONFIG.freeShippingThreshold[curr] ?? DEFAULT_SHIPPING_CONFIG.freeShippingThreshold.SEK
    return cartSubtotalMinor.value >= threshold
  })

  // 2. Remaining amount needed for free shipping in active currency
  const remainingForFreeShippingMinor = computed<number>(() => {
    const curr = activeCurrency.value
    const threshold = DEFAULT_SHIPPING_CONFIG.freeShippingThreshold[curr] ?? DEFAULT_SHIPPING_CONFIG.freeShippingThreshold.SEK
    return Math.max(0, threshold - cartSubtotalMinor.value)
  })

  /**
   * Explicit Swedish 25% moms on shipping
   */
  const shippingMoms25Minor = computed<number>(() => {
    if (shippingFeeMinor.value <= 0) return 0
    return Math.round((shippingFeeMinor.value * 25) / 125)
  })

  // ---------------------------------------------------------------------------
  // Deterministic Moms Breakdown (LC-1 & NFR-5)
  // ---------------------------------------------------------------------------
  const momsBreakdown = computed<MomsSummary>(() => {
    let itemsMoms12Minor = 0
    let itemsMoms25Minor = 0

    for (const line of lineItemTotals.value) {
      if (line.momsRate === 12) {
        itemsMoms12Minor += line.lineTax
      } else {
        itemsMoms25Minor += line.lineTax
      }
    }

    const shipTax = shippingMoms25Minor.value
    const totalMomsMinor = itemsMoms12Minor + itemsMoms25Minor + shipTax

    return {
      itemsMoms12Minor,
      itemsMoms25Minor,
      shippingMoms25Minor: shipTax,
      totalMomsMinor,
    }
  })

  /**
   * Grand Total = Gross Products Subtotal + Gross Shipping Fee
   */
  const grandTotalMinor = computed<number>(() => {
    return cartSubtotalMinor.value + shippingFeeMinor.value
  })

  // ---------------------------------------------------------------------------
  // Inventory Boundary Guards & Actions (AC-1)
  // ---------------------------------------------------------------------------

  /**
   * Adds an item or increments its quantity, clamped to availableStock
   */
  function addItem(item: Omit<CartItem, 'quantity'>, requestedQuantity = 1): CartActionStatus {
    hydrateCart()

    if (item.availableStock <= 0) {
      return 'OUT_OF_STOCK_ONLINE'
    }

    const existingIndex = items.value.findIndex((i) => i.productId === item.productId)

    if (existingIndex > -1) {
      const existing = items.value[existingIndex]
      if (!existing) return 'SUCCESS'

      // Update available stock snapshot if passed afresh
      existing.availableStock = item.availableStock

      const targetQty = existing.quantity + requestedQuantity

      if (targetQty > existing.availableStock) {
        existing.quantity = existing.availableStock
        return 'EXCEEDS_AVAILABLE_STOCK'
      }

      existing.quantity = targetQty
      return 'SUCCESS'
    }

    // New item addition clamped against available online stock
    const initialQuantity = Math.min(requestedQuantity, item.availableStock)
    items.value.push({
      ...item,
      quantity: initialQuantity,
    })

    return requestedQuantity > item.availableStock
      ? 'EXCEEDS_AVAILABLE_STOCK'
      : 'SUCCESS'
  }

  /**
   * Increments item quantity by 1, rejecting if it exceeds availableStock (AC-1)
   */
  function incrementQuantity(productId: string): CartActionStatus {
    const item = items.value.find((i) => i.productId === productId)
    if (!item) return 'OUT_OF_STOCK_ONLINE'

    if (item.quantity >= item.availableStock) {
      return 'EXCEEDS_AVAILABLE_STOCK'
    }

    item.quantity++
    return 'SUCCESS'
  }

  /**
   * Decrements quantity by 1, automatically removing line if it reaches 0
   */
  function decrementQuantity(productId: string): CartActionStatus {
    const index = items.value.findIndex((i) => i.productId === productId)
    if (index === -1) return 'SUCCESS'

    const item = items.value[index]
    if (!item) return 'SUCCESS'

    if (item.quantity > 1) {
      item.quantity--
      return 'SUCCESS'
    }

    items.value.splice(index, 1)
    return 'ITEM_REMOVED'
  }

  /**
   * Sets absolute quantity on line item, clamped to [0, availableStock]
   */
  function updateQuantity(productId: string, newQuantity: number): CartActionStatus {
    const index = items.value.findIndex((i) => i.productId === productId)
    if (index === -1) return 'OUT_OF_STOCK_ONLINE'

    const item = items.value[index]
    if (!item) return 'OUT_OF_STOCK_ONLINE'

    if (newQuantity <= 0) {
      items.value.splice(index, 1)
      return 'ITEM_REMOVED'
    }

    if (newQuantity > item.availableStock) {
      item.quantity = item.availableStock
      return 'EXCEEDS_AVAILABLE_STOCK'
    }

    item.quantity = newQuantity
    return 'SUCCESS'
  }

  function removeItem(productId: string): void {
    items.value = items.value.filter((i) => i.productId !== productId)
  }

  function clearCart(): void {
    items.value = []
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function toggleDrawer(open?: boolean): void {
    const nextState = typeof open === 'boolean' ? open : !isDrawerOpen.value
    isDrawerOpen.value = nextState
    if (nextState && items.value.length > 0) {
      refreshCartPricesAndStock()
    }
  }

  /**
   * Refreshes cart item prices, active discount status, and live available stock
   * against the database via /api/products/batch.
   * Ensures that if a discount starts or expires while items are in the cart,
   * prices and totals update reactively immediately on page load, refresh, or opening the cart.
   */
  async function refreshCartPricesAndStock(): Promise<void> {
    if (!isClient() || items.value.length === 0 || typeof $fetch === 'undefined') return

    try {
      const productIds = items.value.map((i) => i.productId)
      const freshProducts = await $fetch<any[]>('/api/products/batch', {
        method: 'POST',
        body: { ids: productIds },
      })

      if (!Array.isArray(freshProducts)) return

      const productMap = new Map<string, any>(
        freshProducts.map((p) => [String(p.id || p._id), p])
      )

      let hasMutated = false

      for (const item of items.value) {
        const live = productMap.get(item.productId)
        if (!live) {
          // If the product was archived or deleted, mark availableStock as 0
          if (item.availableStock !== 0) {
            item.availableStock = 0
            hasMutated = true
          }
          continue
        }

        // Determine live effective price (discountedPrice if active promotion, else base retail price)
        const liveEffectivePrice: MultiCurrencyPrice = (live.discount && live.discount > 0 && live.discountedPrice)
          ? live.discountedPrice
          : live.price

        if (liveEffectivePrice) {
          const priceChanged =
            item.price.SEK !== liveEffectivePrice.SEK ||
            item.price.EUR !== liveEffectivePrice.EUR ||
            item.price.USD !== liveEffectivePrice.USD

          if (priceChanged) {
            item.price = {
              SEK: liveEffectivePrice.SEK,
              EUR: liveEffectivePrice.EUR,
              USD: liveEffectivePrice.USD,
            }
            hasMutated = true
          }
        }

        // Synchronize available stock snapshot
        if (typeof live.availableStock === 'number' && item.availableStock !== live.availableStock) {
          item.availableStock = live.availableStock
          hasMutated = true
        }

        // Clamp quantity if live stock is below current cart quantity
        if (typeof live.availableStock === 'number' && item.quantity > live.availableStock) {
          item.quantity = Math.max(0, live.availableStock)
          hasMutated = true
        }
      }

      if (hasMutated && isHydrated.value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
      }
    } catch {
      // Gracefully ignore network errors on refresh so offline/flaky connections don't wipe cart
    }
  }

  return {
    // State
    items,
    isDrawerOpen,
    isHydrated,
    // Metrics & Preferences
    activeCurrency,
    totalItemCount,
    totalGrossWeightGrams,
    lineItemTotals,
    // Totals & Subtotals
    productsNetMinor,
    cartSubtotalMinor,
    shippingFeeMinor,
    shippingMoms25Minor,
    isFreeShippingQualified,
    remainingForFreeShippingMinor,
    momsBreakdown,
    grandTotalMinor,
    // Actions
    hydrateCart,
    refreshCartPricesAndStock,
    addItem,
    incrementQuantity,
    decrementQuantity,
    updateQuantity,
    removeItem,
    clearCart,
    toggleDrawer,
  }
})