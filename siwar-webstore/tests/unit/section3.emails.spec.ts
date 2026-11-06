// tests/unit/section3.emails.spec.ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import {
  mailService,
  generatePackedHtml,
  generateDispatchedReceiptHtml,
  hasShortages,
  extractOrderShortages,
  resolveStoreContact,
} from '~/server/services/mail.service'
import type { IOrder, IOrderItem, IShortageAdjustment } from '~/server/models/Order'

describe('Section 3: Multi-Stage Shortage Email Notifications & Lifecycle', () => {
  const prod1Id = new Types.ObjectId()
  const prod2Id = new Types.ObjectId()
  const subProdId = new Types.ObjectId()

  function createTestOrder(options?: {
    withShortages?: boolean
    withSubstitution?: boolean
    locale?: 'sv' | 'en' | 'ar'
    fulfillmentMethod?: 'DELIVERY' | 'PICKUP'
  }): IOrder {
    const locale = options?.locale || 'sv'
    const fulfillmentMethod = options?.fulfillmentMethod || 'DELIVERY'

    const items: IOrderItem[] = [
      {
        productId: prod1Id,
        sku: 'TEA-EARL-GREY',
        name: { sv: 'Earl Grey Te', en: 'Earl Grey Tea', ar: 'شاي إيرل غراي' },
        quantity: 2,
        fulfilledQuantity: options?.withShortages ? 0 : 2,
        unitPriceMinor: 5000, // 50.00 SEK
        momsRate: 12,
        shortageStatus: options?.withShortages ? 'REMOVED' : 'NONE',
        isPacked: true,
      },
      {
        productId: options?.withSubstitution ? subProdId : prod2Id,
        originalProductId: options?.withSubstitution ? prod2Id : undefined,
        sku: options?.withSubstitution ? 'COFFEE-ARABICA-SUB' : 'COFFEE-ROBUSTA',
        name: options?.withSubstitution
          ? { sv: 'Premium Arabica Kaffe', en: 'Premium Arabica Coffee', ar: 'قهوة أرابيكا فاخرة' }
          : { sv: 'Robusta Kaffe', en: 'Robusta Coffee', ar: 'قهوة روبوستا' },
        quantity: 1,
        fulfilledQuantity: 1,
        unitPriceMinor: 8000, // 80.00 SEK
        momsRate: 12,
        shortageStatus: options?.withSubstitution ? 'SUBSTITUTED' : 'NONE',
        isPacked: true,
      },
    ]

    const shortageAdjustments: IShortageAdjustment[] = []
    if (options?.withShortages) {
      shortageAdjustments.push({
        timestamp: new Date(),
        performedBy: 'Admin',
        productId: prod1Id,
        action: 'REMOVE_LINE',
        originalQuantity: 2,
        adjustedQuantity: 0,
        originalUnitPriceMinor: 5000,
        originalSku: 'TEA-EARL-GREY',
        originalName: { sv: 'Earl Grey Te', en: 'Earl Grey Tea', ar: 'شاي إيرل غراي' },
        originalMomsRate: 12,
        note: 'Slut i lager på centrallagret',
      })
    }

    if (options?.withSubstitution) {
      shortageAdjustments.push({
        timestamp: new Date(),
        performedBy: 'Admin',
        productId: prod2Id,
        action: 'SUBSTITUTE_ITEM',
        originalQuantity: 1,
        adjustedQuantity: 0,
        originalUnitPriceMinor: 7500,
        originalSku: 'COFFEE-ROBUSTA',
        originalName: { sv: 'Robusta Kaffe', en: 'Robusta Coffee', ar: 'قهوة روبوستا' },
        originalMomsRate: 12,
        substitutedProductId: subProdId,
        substitutedSku: 'COFFEE-ARABICA-SUB',
        substitutedUnitPriceMinor: 8000,
        note: 'Ersatt med premium arabica',
      })
    }

    const authorizedTotal = 18000 // 180.00 SEK (initial hold)
    const capturedTotal = options?.withShortages ? 8000 : 18000 // 80.00 SEK if shortage
    const releasedAmount = authorizedTotal - capturedTotal

    return {
      _id: new Types.ObjectId(),
      orderReference: 'ORD-TEST-43',
      customerLocale: locale,
      currency: 'SEK',
      customer: {
        fullName: 'Ahmad Al-Mansoor',
        email: 'ahmad@example.com',
        phone: '0728488399',
        fulfillmentMethod,
        address: {
          street: 'Storgatan 10',
          postalCode: '30243',
          city: 'Halmstad',
        },
      },
      items,
      shortageAdjustments,
      pricing: {
        itemsTotalMinor: capturedTotal,
        shippingFeeMinor: 0,
        grandTotalMinor: capturedTotal,
        authorizedTotalMinor: authorizedTotal,
        capturedTotalMinor: capturedTotal,
        releasedOrRefundedMinor: releasedAmount,
        taxSplit: {
          totalMomsMinor: Math.round(capturedTotal * 0.12),
          moms12: { momsAmountMinor: Math.round(capturedTotal * 0.12) },
        } as any,
      },
    } as unknown as IOrder
  }

  // -------------------------------------------------------------------------
  // Helper Checks
  // -------------------------------------------------------------------------
  describe('Shortage Detection & Extraction Helpers', () => {
    it('accurately identifies whether an order contains shortages', () => {
      const normalOrder = createTestOrder({ withShortages: false })
      const shortageOrder = createTestOrder({ withShortages: true })

      expect(hasShortages(normalOrder)).toBe(false)
      expect(hasShortages(shortageOrder)).toBe(true)
    })

    it('extracts removed, reduced, and substituted lines from shortage adjustments', () => {
      const complexOrder = createTestOrder({ withShortages: true, withSubstitution: true, locale: 'sv' })
      const extracted = extractOrderShortages(complexOrder, 'sv')

      expect(extracted).toHaveLength(2)
      const removed = extracted.find((e) => e.type === 'REMOVED')
      expect(removed).toBeDefined()
      expect(removed?.originalName).toBe('Earl Grey Te')
      expect(removed?.droppedQty).toBe(2)
      expect(removed?.droppedDifferenceMinor).toBe(10000) // 100.00 SEK

      const sub = extracted.find((e) => e.type === 'SUBSTITUTED')
      expect(sub).toBeDefined()
      expect(sub?.originalName).toBe('Robusta Kaffe')
      expect(sub?.subName).toBe('Premium Arabica Kaffe')
      expect(sub?.subSku).toBe('COFFEE-ARABICA-SUB')
    })
  })

  // -------------------------------------------------------------------------
  // AC-2: Stage 2 Order Packed Notice
  // -------------------------------------------------------------------------
  describe('AC-2: Stage 2 Order Packed Email Notification', () => {
    it('renders dedicated amber callout box with strikethrough removed lines and uncaptured difference', () => {
      const order = createTestOrder({ withShortages: true, locale: 'sv' })
      const html = generatePackedHtml(order, 'sv')

      // 1. Amber callout title & intro
      expect(html).toContain('Viktigt meddelande: Varubrist och justering av din order')
      expect(html).toContain('Vid packning av din beställning upptäckte vi tyvärr att vissa varor saknades')

      // 2. Strikethrough of removed item with dropped quantity & refunded difference
      expect(html).toContain('text-decoration: line-through')
      expect(html).toContain('Earl Grey Te')
      expect(html).toContain('Minskad med: 2 st')
      expect(html).toContain('Frigjort: -100.00 SEK')

      // 3. Financial breakdown of reservation vs. capture
      expect(html).toContain('Ursprungligt reserverat belopp:')
      expect(html).toContain('180.00 SEK')
      expect(html).toContain('Frigjort belopp (dras ej):')
      expect(html).toContain('-100.00 SEK')
      expect(html).toContain('Reviderat belopp som debiteras vid sändning:')
      expect(html).toContain('80.00 SEK')

      // 4. Urgent customer contact action callout
      expect(html).toContain('Önskar du ändra eller avbryta?')
      expect(html).toContain('info@siwar.se')
      expect(html).toContain('072-848 83 99')
    })

    it('renders replacement item details (name, SKU, unit price) when items are substituted', () => {
      const order = createTestOrder({ withShortages: true, withSubstitution: true, locale: 'sv' })
      const html = generatePackedHtml(order, 'sv')

      expect(html).toContain('Ersättningsvaror (Substitutioner):')
      expect(html).toContain('Premium Arabica Kaffe')
      expect(html).toContain('COFFEE-ARABICA-SUB')
      expect(html).toContain('80.00 SEK')
      expect(html).toContain('Ersätter ursprunglig vara:')
      expect(html).toContain('Robusta Kaffe')
    })

    it('does NOT render the amber shortage callout when order is fulfilled without shortages', () => {
      const order = createTestOrder({ withShortages: false, locale: 'sv' })
      const html = generatePackedHtml(order, 'sv')

      expect(html).not.toContain('Viktigt meddelande: Varubrist')
      expect(html).not.toContain('Frigjort belopp')
      expect(html).toContain('Packade artiklar:')
      expect(html).toContain('Earl Grey Te')
    })

    it('primarily fetches contact information (email and phone) from StoreSettings when provided', () => {
      const order = createTestOrder({ withShortages: true, locale: 'sv' })
      const customSettings = {
        contact: {
          email: 'support@nordic-delight.se',
          phone: '+46 35 999 888',
        },
      } as any

      const html = generatePackedHtml(order, 'sv', undefined, customSettings)

      expect(html).toContain('support@nordic-delight.se')
      expect(html).toContain('+46 35 999 888')
      expect(html).not.toContain('info@siwar.se')
      expect(html).not.toContain('072-848 83 99')
    })

    it('uses StoreSettings contact info in Arabic Stage 2 packed email', () => {
      const order = createTestOrder({ withShortages: true, locale: 'ar' })
      const customSettings = {
        contact: {
          email: 'custom-ar@siwar.se',
          phone: '+46 70 000 11 22',
        },
      } as any

      const html = generatePackedHtml(order, 'ar', undefined, customSettings)

      expect(html).toContain('custom-ar@siwar.se')
      expect(html).toContain('+46 70 000 11 22')
    })

    it('resolves contact info properly via resolveStoreContact helper', () => {
      const resolvedCustom = resolveStoreContact({
        contact: { email: 'custom@store.se', phone: '073-123 45 67' },
      } as any)
      expect(resolvedCustom.email).toBe('custom@store.se')
      expect(resolvedCustom.phone).toBe('073-123 45 67')

      const fallback = resolveStoreContact(null)
      expect(fallback.email).toBe('info@siwar.se')
      expect(fallback.phone).toBe('072-848 83 99')
    })
  })

  // -------------------------------------------------------------------------
  // AC-3: Stage 3 Order Dispatched Notice & DHL Tracking
  // -------------------------------------------------------------------------
  describe('AC-3: Stage 3 Order Dispatched Final Receipt', () => {
    it('includes DHL tracking link and carrier button', () => {
      const order = createTestOrder({ withShortages: false, locale: 'sv' })
      const html = generateDispatchedReceiptHtml(order, 'DHL-TRACK-999', 'DHL', 'sv')

      expect(html).toContain('DHL-TRACK-999')
      expect(html).toContain('https://www.dhl.com/se-sv/home/tracking.html?tracking-id=DHL-TRACK-999')
      expect(html).toContain('Spåra paketet hos DHL')
    })

    it('includes the exact finalized shortage audit note when shortages were applied', () => {
      const order = createTestOrder({ withShortages: true, locale: 'sv' })
      const html = generateDispatchedReceiptHtml(order, 'DHL-12345', 'DHL', 'sv')

      // Verified exact wording from AC-3:
      // "Ordern skickades med justering för varubrist. Totalt debiterat: X SEK (Y SEK har släppts/återbetalats)."
      expect(html).toContain(
        'Ordern skickades med justering för varubrist. Totalt debiterat: 80.00 SEK (100.00 SEK har släppts/återbetalats).'
      )
    })

    it('omits shortage audit note when order was dispatched with no shortage adjustments', () => {
      const order = createTestOrder({ withShortages: false, locale: 'sv' })
      const html = generateDispatchedReceiptHtml(order, 'DHL-12345', 'DHL', 'sv')

      expect(html).not.toContain('Ordern skickades med justering för varubrist')
    })
  })

  // -------------------------------------------------------------------------
  // AC-4: Multilingual & Bidirectional (Arabic RTL, English, Swedish)
  // -------------------------------------------------------------------------
  describe('AC-4: Multilingual and Bidirectional Email Rendering', () => {
    it('renders Stage 2 packed email in fluent Arabic with dir="rtl"', () => {
      const order = createTestOrder({ withShortages: true, withSubstitution: true, locale: 'ar' })
      const html = generatePackedHtml(order, 'ar')

      expect(html).toContain('dir="rtl"')
      expect(html).toContain('تنبيه هام: تعديل الطلب بسبب عدم توفر بعض الأصناف')
      expect(html).toContain('المنتجات الملغاة أو المخفضة:')
      expect(html).toContain('شاي إيرل غراي')
      expect(html).toContain('المنتجات البديلة (التعويضية):')
      expect(html).toContain('قهوة أرابيكا فاخرة')
      expect(html).toContain('المبلغ المحرر / غير المسحوب:')
      expect(html).toContain('المبلغ النهائي المعدل للخصم عند الشحن:')
      expect(html).toContain('هل ترغب في إجراء أي تعديل أو إلغاء الطلب؟')
      expect(html).toContain('info@siwar.se')
    })

    it('renders Stage 3 dispatch email in fluent Arabic with dir="rtl" and Arabic shortage audit note', () => {
      const order = createTestOrder({ withShortages: true, locale: 'ar' })
      const html = generateDispatchedReceiptHtml(order, 'DHL-AR-100', 'DHL', 'ar')

      expect(html).toContain('dir="rtl"')
      expect(html).toContain('تتبع الشحنة على DHL')
      expect(html).toContain(
        'تم شحن الطلب مع تعديل لعدم توفر بعض الأصناف. إجمالي المبلغ المخصوم: 80.00 SEK (تم تحرير/إرجاع 100.00 SEK).'
      )
    })

    it('renders Stage 2 and Stage 3 emails in English with dir="ltr" and English copy', () => {
      const order = createTestOrder({ withShortages: true, locale: 'en' })
      const packedHtml = generatePackedHtml(order, 'en')
      const dispatchedHtml = generateDispatchedReceiptHtml(order, 'DHL-EN-200', 'DHL', 'en')

      expect(packedHtml).toContain('dir="ltr"')
      expect(packedHtml).toContain('Important Notice: Item Shortage & Order Adjustment')
      expect(packedHtml).toContain('Removed or Reduced Items:')
      expect(packedHtml).toContain('Earl Grey Tea')
      expect(packedHtml).toContain('Revised Total to be Captured upon Dispatch:')
      expect(packedHtml).toContain('Wish to modify or cancel?')

      expect(dispatchedHtml).toContain('dir="ltr"')
      expect(dispatchedHtml).toContain('Track Package on DHL')
      expect(dispatchedHtml).toContain(
        'The order was dispatched with adjustments for item shortage. Total captured: 80.00 SEK (100.00 SEK has been released/refunded).'
      )
    })
  })

  // -------------------------------------------------------------------------
  // MailService Compatibility Aliases
  // -------------------------------------------------------------------------
  describe('MailService Method Aliases', () => {
    it('exposes sendOrderPackedEmail as an alias for sendOrderPackedNotice', () => {
      expect(typeof mailService.sendOrderPackedEmail).toBe('function')
      expect(typeof mailService.sendOrderPackedNotice).toBe('function')
    })

    it('exposes sendOrderDispatchedEmail as an alias for sendOrderDispatched', () => {
      expect(typeof mailService.sendOrderDispatchedEmail).toBe('function')
      expect(typeof mailService.sendOrderDispatched).toBe('function')
    })
  })
})
