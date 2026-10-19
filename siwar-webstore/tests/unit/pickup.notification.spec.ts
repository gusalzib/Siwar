// tests/unit/pickup.notification.spec.ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import {
  DEFAULT_PICKUP_CONFIG,
  DEFAULT_WEEKLY_SCHEDULE,
  normalizeSchedule,
  formatWeeklySchedule,
  type IPickupSettings,
  type IDaySchedule,
} from '~/server/models/StoreSettings'
import { mailService } from '~/server/services/mail.service'
import type { IOrder, IOrderItem } from '~/server/models/Order'

describe('AC-4: Ready for Pickup Notification (In-Store Pickup)', () => {
  const item1Id = new Types.ObjectId()

  function createMockOrder(fulfillmentMethod: 'PICKUP' | 'DELIVERY' = 'PICKUP'): IOrder {
    const items: IOrderItem[] = [
      {
        productId: item1Id,
        sku: 'DELIGHT-01',
        name: { ar: 'حلقوم تركي', sv: 'Turkisk Konfekt', en: 'Turkish Delight' },
        quantity: 2,
        fulfilledQuantity: 2,
        unitPriceMinor: 4500,
        momsRate: 12,
        shortageStatus: 'NONE',
        isPacked: true,
      },
    ]

    return {
      _id: new Types.ObjectId(),
      orderReference: 'ORD-PICKUP-101',
      customerLocale: 'sv',
      currency: 'SEK',
      customer: {
        fullName: 'Sara Andersson',
        email: 'sara@example.com',
        phone: '0701234567',
        fulfillmentMethod,
        address: {
          street: 'Storgatan 1',
          postalCode: '30243',
          city: 'Halmstad',
        },
      },
      items,
      shortageAdjustments: [],
      pricing: {
        itemsTotalMinor: 9000,
        shippingFeeMinor: 0,
        grandTotalMinor: 9000,
        authorizedTotalMinor: 9000,
        taxSplit: {} as any,
      },
    } as unknown as IOrder
  }

  describe('Granular Weekly Schedule & Formatter', () => {
    it('normalizes missing or partial schedules to standard 7 days in Monday-Sunday order', () => {
      const partial: Partial<IDaySchedule>[] = [
        { day: 'friday', isOpen: true, openTime: '08:00', closeTime: '16:00' },
        { day: 'monday', isOpen: false },
      ]

      const normalized = normalizeSchedule(partial as any)

      expect(normalized).toHaveLength(7)
      expect(normalized[0]?.day).toBe('monday')
      expect(normalized[0]?.isOpen).toBe(false)
      expect(normalized[4]?.day).toBe('friday')
      expect(normalized[4]?.isOpen).toBe(true)
      expect(normalized[4]?.openTime).toBe('08:00')
      expect(normalized[4]?.closeTime).toBe('16:00')
      expect(normalized[6]?.day).toBe('sunday')
      expect(normalized[6]?.isOpen).toBe(false) // Default sunday is closed
    })

    it('formats default weekly schedule into localized ranges correctly', () => {
      const svHours = formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'sv')
      const arHours = formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'ar')
      const enHours = formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'en')

      expect(svHours).toBe('Måndag - Fredag: 10:00 - 18:00 | Lördag: 11:00 - 15:00 | Söndag: Stängt')
      expect(arHours).toBe('الإثنين - الجمعة: 10:00 - 18:00 | السبت: 11:00 - 15:00 | الأحد: مغلق')
      expect(enHours).toBe('Monday - Friday: 10:00 - 18:00 | Saturday: 11:00 - 15:00 | Sunday: Closed')
    })

    it('dynamically adapts when individual days are toggled or modified', () => {
      // Modify schedule: Close Wednesday, open Sunday with custom hours
      const customSchedule: IDaySchedule[] = [
        { day: 'monday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
        { day: 'tuesday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
        { day: 'wednesday', isOpen: false, openTime: '10:00', closeTime: '18:00' }, // Closed!
        { day: 'thursday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
        { day: 'friday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
        { day: 'saturday', isOpen: true, openTime: '10:00', closeTime: '14:00' },
        { day: 'sunday', isOpen: true, openTime: '12:00', closeTime: '16:00' }, // Open!
      ]

      const svFormatted = formatWeeklySchedule(customSchedule, 'sv')
      expect(svFormatted).toBe(
        'Måndag - Tisdag: 10:00 - 18:00 | Onsdag: Stängt | Torsdag - Fredag: 10:00 - 18:00 | Lördag: 10:00 - 14:00 | Söndag: 12:00 - 16:00'
      )
    })
  })

  describe('Transactional Packed Email Notification', () => {
    it('includes pickup hours, store address, and instructions when order is In-Store Pickup in Swedish', () => {
      const order = createMockOrder('PICKUP')
      const html = mailService.generatePackedHtml(order, 'sv', DEFAULT_PICKUP_CONFIG)

      expect(html).toContain('Din order är redo att hämtas i butik!')
      expect(html).toContain('Hej Sara Andersson,')
      expect(html).toContain('Storgatan 12, 302 43 Halmstad')
      expect(html).toContain('Måndag - Fredag: 10:00 - 18:00 | Lördag: 11:00 - 15:00 | Söndag: Stängt')
      expect(html).toContain('Vänligen visa upp ditt ordernummer och giltig legitimation')
      expect(html).toContain('Turkisk Konfekt')
      expect(html).toContain('2 st')
    })

    it('includes localized Arabic pickup hours and instructions when customer locale is Arabic', () => {
      const order = createMockOrder('PICKUP')
      const html = mailService.generatePackedHtml(order, 'ar', DEFAULT_PICKUP_CONFIG)

      expect(html).toContain('طلبك جاهز للاستلام من المتجر!')
      expect(html).toContain('مرحباً Sara Andersson،')
      expect(html).toContain('Storgatan 12, 302 43 Halmstad')
      expect(html).toContain('الإثنين - الجمعة: 10:00 - 18:00 | السبت: 11:00 - 15:00 | الأحد: مغلق')
      expect(html).toContain('يرجى إبراز رقم الطلب وتأكيد الهوية عند الاستلام في المتجر')
      expect(html).toContain('حلقوم تركي')
    })

    it('includes localized English pickup hours and instructions when customer locale is English', () => {
      const order = createMockOrder('PICKUP')
      const html = mailService.generatePackedHtml(order, 'en', DEFAULT_PICKUP_CONFIG)

      expect(html).toContain('Your order is ready for in-store pickup!')
      expect(html).toContain('Hello Sara Andersson,')
      expect(html).toContain('Storgatan 12, 302 43 Halmstad')
      expect(html).toContain('Monday - Friday: 10:00 - 18:00 | Saturday: 11:00 - 15:00 | Sunday: Closed')
      expect(html).toContain('Please present your order reference number and a valid ID')
      expect(html).toContain('Turkish Delight')
    })

    it('reflects updated pickup hours dynamically when custom granular schedule is provided', () => {
      const order = createMockOrder('PICKUP')
      const customSchedule: IDaySchedule[] = [
        { day: 'monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
        { day: 'saturday', isOpen: false, openTime: '10:00', closeTime: '15:00' },
        { day: 'sunday', isOpen: false, openTime: '10:00', closeTime: '15:00' },
      ]

      const customSettings: IPickupSettings = {
        enabled: true,
        address: {
          street: 'Köpmansgatan 5',
          postalCode: '302 42',
          city: 'Halmstad',
          country: 'Sverige',
        },
        schedule: customSchedule,
        pickupHours: {
          sv: formatWeeklySchedule(customSchedule, 'sv'),
          ar: formatWeeklySchedule(customSchedule, 'ar'),
          en: formatWeeklySchedule(customSchedule, 'en'),
        },
        instructions: {
          sv: 'Ring på klockan vid bakdörren.',
          ar: 'يرجى رن الجرس عند الباب الخلفي.',
          en: 'Please ring the bell at the rear entrance.',
        },
      }

      const html = mailService.generatePackedHtml(order, 'sv', customSettings)

      expect(html).toContain('Köpmansgatan 5, 302 42 Halmstad')
      expect(html).toContain('Måndag - Fredag: 09:00 - 17:00 | Lördag - Söndag: Stängt')
      expect(html).toContain('Ring på klockan vid bakdörren.')
    })

    it('does NOT include pickup hours or store address box when order is DELIVERY', () => {
      const order = createMockOrder('DELIVERY')
      const html = mailService.generatePackedHtml(order, 'sv', DEFAULT_PICKUP_CONFIG)

      expect(html).toContain('Din order är färdigpackad!')
      expect(html).toContain('Paketet inväntar upphämtning av PostNord')
      expect(html).not.toContain('Information för utlämning i butik')
      expect(html).not.toContain('Öppettider för utlämning')
    })
  })
})
