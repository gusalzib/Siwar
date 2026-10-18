// composables/useOrderPacking.ts
import { ref, computed, watch, type Ref } from 'vue'

export interface LineItemState {
  productId: string
  originalProductId?: string
  originalItem?: {
    productId: string
    sku?: string
    name: { ar: string; sv: string; en: string }
    quantity: number
    unitPriceMinor: number
    momsRate: 12 | 25
  }
  sku?: string
  name: { ar: string; sv: string; en: string }
  quantity: number
  fulfilledQuantity: number
  unitPriceMinor: number
  momsRate: 12 | 25
  shortageStatus: 'NONE' | 'REDUCED' | 'REMOVED' | 'SUBSTITUTED'
  isPacked: boolean
}

export interface ShortageActionDraft {
  productId: string
  action: 'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'
  adjustedQuantity: number
  substitutedProduct?: {
    _id: string
    sku?: string
    name: { ar: string; sv: string; en: string }
    priceMinor: number
    momsRate: 12 | 25
  }
  note?: string
}

export function useOrderPacking(order: Ref<any>, refreshOrder: () => Promise<void>) {
  const router = useRouter()
  const localItems = ref<LineItemState[]>([])
  const pendingActions = ref<Map<string, ShortageActionDraft>>(new Map())
  const isSubmitting = ref(false)
  const errorMessage = ref<string | null>(null)

  // Helper to extract clean string ID whether it is a string or an object { _id: "..." }
  function extractId(val: any): string {
    if (!val) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val._id) return String(val._id)
    return String(val)
  }

  // 1. Sync incoming order into localItems while recovering original product snapshots
  watch(
    order,
    (newOrder) => {
      if (!newOrder?.items) return
      const isAlreadyPackedStatus =
        newOrder.fulfillmentStatus === 'PACKED' ||
        newOrder.fulfillmentStatus === 'DISPATCHED'

      localItems.value = newOrder.items.map((i: any, index: number) => {
        const idStr = extractId(i.productId)
        const existing = localItems.value[index]
        const dbOriginalProductId = extractId(i.originalProductId)

        // Find the audit log that substituted this item (if it was previously substituted and saved in DB)
        const subAdjustment = newOrder.shortageAdjustments?.find((adj: any) => {
          if (adj.action !== 'SUBSTITUTE_ITEM') return false
          const subId = extractId(adj.substitutedProductId)
          return subId === idStr
        })

        let originalSnapshot = existing?.originalItem

        if (!originalSnapshot) {
          if (subAdjustment && subAdjustment.originalName) {
            // Recover original product identity from the adjustment audit record
            originalSnapshot = {
              productId: extractId(subAdjustment.productId),
              sku: subAdjustment.originalSku || undefined,
              name: { ...subAdjustment.originalName },
              quantity: subAdjustment.originalQuantity || i.quantity,
              unitPriceMinor: subAdjustment.originalUnitPriceMinor || i.unitPriceMinor,
              momsRate: subAdjustment.originalMomsRate || i.momsRate || 12,
            }
          } else if (dbOriginalProductId && dbOriginalProductId !== idStr) {
            // Item has originalProductId in DB but no adjustment record (shouldn't happen but handle gracefully).
            // We can't fully recover name/sku without the audit record, but we preserve the ID so reset knows
            // where to look. The adjustment record is the primary source of truth for the full snapshot.
            originalSnapshot = {
              productId: dbOriginalProductId,
              sku: undefined,
              name: i.name ? { ...i.name } : { ar: '', sv: '', en: '' },
              quantity: i.quantity,
              unitPriceMinor: i.unitPriceMinor,
              momsRate: i.momsRate,
            }
          } else {
            // Normal intact item
            originalSnapshot = {
              productId: idStr,
              sku: i.sku,
              name: i.name ? { ...i.name } : { ar: '', sv: '', en: '' },
              quantity: i.quantity,
              unitPriceMinor: i.unitPriceMinor,
              momsRate: i.momsRate,
            }
          }
        }

        const isPackedFromData = typeof i.isPacked === 'boolean' ? i.isPacked : isAlreadyPackedStatus
        const resolvedOriginalProductId = existing?.originalProductId
          || dbOriginalProductId
          || (subAdjustment ? extractId(subAdjustment.productId) : undefined)

        return {
          ...i,
          productId: idStr,
          originalProductId: resolvedOriginalProductId && resolvedOriginalProductId !== idStr
            ? resolvedOriginalProductId
            : undefined,
          originalItem: originalSnapshot,
          fulfilledQuantity: typeof i.fulfilledQuantity === 'number' ? i.fulfilledQuantity : i.quantity,
          shortageStatus: i.shortageStatus || 'NONE',
          isPacked: existing ? existing.isPacked : isPackedFromData,
        }
      })
    },
    { immediate: true }
  )

  // 2. Apply Shortage Action
  function applyShortageAction(draft: ShortageActionDraft) {
    const target = localItems.value.find((i) => i.productId === draft.productId)
    if (!target) return

    // Ensure original snapshot is sealed before overwriting
    if (!target.originalItem) {
      target.originalItem = {
        productId: target.productId,
        sku: target.sku,
        name: { ...target.name },
        quantity: target.quantity,
        unitPriceMinor: target.unitPriceMinor,
        momsRate: target.momsRate,
      }
    }

    if (draft.action === 'SUBSTITUTE_ITEM' && draft.substitutedProduct) {
      const sub = draft.substitutedProduct
      target.originalProductId = target.originalProductId || target.productId
      target.productId = String(sub._id)
      target.sku = sub.sku
      target.name = { ...sub.name }
      target.fulfilledQuantity = draft.adjustedQuantity
      target.unitPriceMinor = sub.priceMinor
      target.momsRate = sub.momsRate || 12
      target.shortageStatus = 'SUBSTITUTED'
      pendingActions.value.set(target.originalProductId, draft)
    } else if (draft.action === 'REMOVE_LINE') {
      target.fulfilledQuantity = 0
      target.shortageStatus = 'REMOVED'
      target.isPacked = true
      pendingActions.value.set(draft.productId, draft)
    } else if (draft.action === 'REDUCE_QUANTITY') {
      target.fulfilledQuantity = draft.adjustedQuantity
      target.shortageStatus = draft.adjustedQuantity === 0 ? 'REMOVED' : 'REDUCED'
      pendingActions.value.set(draft.productId, draft)
    }
  }

  // 3. Reset Line Item (Full reversion to originalItem snapshot)
  function resetLineItem(target: LineItemState | string) {
    let item: LineItemState | undefined
    if (typeof target === 'string') {
      const pIdStr = String(target)
      item = localItems.value.find(
        (i) => i.productId === pIdStr || i.originalProductId === pIdStr
      )
    } else {
      item = target
    }
    if (!item) return

    const prevOriginalId = item.originalProductId
    const currentSubstituteId = item.productId
    const orig = item.originalItem

    if (orig) {
      item.productId = String(orig.productId)
      item.sku = orig.sku
      item.name = { ...orig.name }
      item.unitPriceMinor = orig.unitPriceMinor
      item.momsRate = orig.momsRate
      item.quantity = orig.quantity
      item.fulfilledQuantity = orig.quantity
    }

    item.originalProductId = undefined
    item.shortageStatus = 'NONE'
    item.isPacked = false

    // Clear pending actions under both keys
    if (prevOriginalId) pendingActions.value.delete(String(prevOriginalId))
    pendingActions.value.delete(String(currentSubstituteId))
  }

  function toggleItemPicked(item: LineItemState) {
    item.isPacked = !item.isPacked
  }

  function packAllItems() {
    for (const item of localItems.value) {
      if (item.fulfilledQuantity > 0) item.isPacked = true
    }
  }

  const totalFulfilledUnits = computed(() => {
    return localItems.value.reduce((sum, item) => sum + item.fulfilledQuantity, 0)
  })

  const isFullyPacked = computed(() => {
    if (!localItems.value.length) return false
    return localItems.value.every((item) => item.fulfilledQuantity === 0 || item.isPacked)
  })

  // 4. Dynamic Live Pricing (Handles free shipping threshold dynamically)
  const livePricing = computed(() => {
    if (!order.value) {
      return { fulfilledItemsTotal: 0, grandTotal: 0, moms12Amount: 0, moms25Amount: 0, totalMoms: 0, releaseAmount: 0, shippingFee: 0 }
    }
    let itemsTotal = 0
    let moms12Gross = 0
    let moms25Gross = 0

    for (const line of localItems.value) {
      const lineGross = line.unitPriceMinor * line.fulfilledQuantity
      itemsTotal += lineGross
      if (line.momsRate === 12) moms12Gross += lineGross
      else moms25Gross += lineGross
    }

    // Dynamic Shipping calculation
    let shippingFee = 0
    if (itemsTotal > 0 && order.value.customer?.fulfillmentMethod === 'DELIVERY') {
      if (itemsTotal >= 89900) {
        shippingFee = 0 // Free shipping
      } else {
        shippingFee = order.value.pricing?.shippingFeeMinor > 0 ? order.value.pricing.shippingFeeMinor : 7700
      }
    }

    moms25Gross += shippingFee

    const moms12Amount = Math.round((moms12Gross * 12) / 112)
    const moms25Amount = Math.round((moms25Gross * 25) / 125)
    const grandTotal = itemsTotal + shippingFee
    const authorized = order.value.pricing?.authorizedTotalMinor || 0
    const releaseAmount = Math.max(0, authorized - grandTotal)

    return {
      fulfilledItemsTotal: itemsTotal,
      shippingFee,
      grandTotal,
      moms12Amount,
      moms25Amount,
      totalMoms: moms12Amount + moms25Amount,
      releaseAmount,
    }
  })

  const canDispatch = computed(() => {
    if (isSubmitting.value) return false
    if (['DISPATCHED', 'CANCELLED'].includes(order.value?.fulfillmentStatus)) return false
    if (totalFulfilledUnits.value === 0) return false
    if (order.value?.pricing?.authorizedTotalMinor && livePricing.value.grandTotal > order.value.pricing.authorizedTotalMinor) {
      return false
    }
    return isFullyPacked.value
  })

  // 5. Submit with positional indexing
  async function submitPacking(markDispatched: boolean) {
    isSubmitting.value = true
    errorMessage.value = null

    try {
      const payload = {
        items: localItems.value.map((i, index) => ({
          index,
          productId: String(i.productId),
          originalProductId: i.originalProductId ? String(i.originalProductId) : undefined,
          fulfilledQuantity: i.fulfilledQuantity,
          shortageStatus: i.shortageStatus,
          sku: i.sku,
          name: i.name,
          unitPriceMinor: i.unitPriceMinor,
          momsRate: i.momsRate,
          isPacked: i.isPacked,
        })),
        actions: Array.from(pendingActions.value.values()),
        markDispatched,
      }

      await $fetch(`/api/admin/orders/${order.value._id}/pack`, {
        method: 'POST',
        body: payload,
      })

      pendingActions.value.clear()
      if (markDispatched) {
        await router.push('/admin/orders')
      } else {
        await refreshOrder()
      }
    } catch (err: any) {
      errorMessage.value = err.data?.statusMessage || err.message || 'Kunde inte slutföra packningen'
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    localItems,
    pendingActions,
    isSubmitting,
    errorMessage,
    totalFulfilledUnits,
    isFullyPacked,
    canDispatch,
    livePricing,
    toggleItemPicked,
    packAllItems,
    resetLineItem,
    applyShortageAction,
    submitPacking,
  }
}