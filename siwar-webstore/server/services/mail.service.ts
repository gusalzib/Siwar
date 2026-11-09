import { Resend } from 'resend'
import type { IOrder } from '~/server/models/Order'
import {
  getStorePickupSettings,
  getStoreGeneralSettings,
  getCachedStoreGeneralSettings,
  DEFAULT_PICKUP_CONFIG,
  DEFAULT_GENERAL_CONFIG,
  type IPickupSettings,
  type IGeneralSettings,
} from '~/server/models/StoreSettings'

export type EmailLocale = 'ar' | 'sv' | 'en'

function getRuntimeConfigSafe(): any {
  try {
    if (typeof useRuntimeConfig === 'function') {
      return useRuntimeConfig()
    }
  } catch {
    // Outside Nuxt/Nitro runtime context (e.g. unit tests)
  }
  return null
}

function getResendClient() {
  const config = getRuntimeConfigSafe()
  const apiKey = (
    config?.resendApiKey ||
    process.env.RESEND_API_KEY ||
    process.env.MAIL_API_KEY ||
    process.env.NUXT_RESEND_API_KEY ||
    ''
  ).trim()
  if (!apiKey) {
    console.warn('⚠️ [MailService] RESEND_API_KEY is not configured! Emails will be mocked.')
    return null
  }
  return new Resend(apiKey)
}

function formatMoney(amountMinor: number, currency = 'SEK'): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function getMailFrom(): string {
  const config = getRuntimeConfigSafe()
  let from = (
    config?.mailFrom ||
    process.env.MAIL_FROM ||
    process.env.MAIL_FROM_ADDRESS ||
    'Siwar Webstore <order@siwar.se>'
  ).trim()

  // Clean surrounding quotes if any (e.g. ""Siwar..."")
  while (
    (from.startsWith('"') && from.endsWith('"')) ||
    (from.startsWith("'") && from.endsWith("'"))
  ) {
    from = from.slice(1, -1).trim()
  }

  return from
}

function getStoreEmail(): string {
  try {
    const cached = getCachedStoreGeneralSettings()
    if (cached?.contact?.email?.trim()) {
      return cached.contact.email.trim()
    }
  } catch {
    // Outside Nuxt/Nitro context
  }
  const config = getRuntimeConfigSafe()
  return (
    (config?.storeEmail as string | undefined) ||
    process.env.STORE_EMAIL ||
    'info@siwar.se'
  )
}

export interface IStoreContactInfo {
  email: string
  phone: string
}

/**
 * Resolves store contact info (email and phone), primarily fetched from StoreSettings,
 * falling back gracefully to runtime config and defaults.
 */
function resolveStoreContact(
  generalSettings?: IGeneralSettings | { contact?: { email?: string; phone?: string } } | null
): IStoreContactInfo {
  let email = generalSettings?.contact?.email?.trim()
  let phone = generalSettings?.contact?.phone?.trim()

  if (!email || !phone) {
    try {
      const cached = getCachedStoreGeneralSettings()
      if (!email && cached?.contact?.email?.trim()) {
        email = cached.contact.email.trim()
      }
      if (!phone && cached?.contact?.phone?.trim()) {
        phone = cached.contact.phone.trim()
      }
    } catch {
      // Outside Nuxt/Nitro context
    }
  }

  if (!email) {
    email = getStoreEmail() || 'info@siwar.se'
  }
  if (!phone) {
    phone = '072-848 83 99'
  }

  return { email, phone }
}

export interface IContactMessageParams {
  fullName: string
  email: string
  phone?: string
  orderReference?: string
  category?: string
  message: string
}

export const mailService = {
  /**
   * 1. Order Confirmation (Sent immediately upon payment authorization)
   */
  async sendOrderConfirmation(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer?.email

    const subjects: Record<EmailLocale, string> = {
      ar: `تأكيد استلام الطلب #${order.orderReference} - متجر سوار`,
      sv: `Orderbekräftelse #${order.orderReference} - Siwar`,
      en: `Order Confirmation #${order.orderReference} - Siwar Store`,
    }

    if (!to) {
      return { id: 'skipped-no-recipient' }
    }

    const html = generateConfirmationHtml(order, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: CONFIRMATION] To: ${to} | Subject: ${subjects[locale]}`)
      return { id: 'mock-mail-id' }
    }

    const result = await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })

    if (result.error) {
      console.error(` [Resend Error] Failed to send order confirmation to ${to}:`, result.error)
      throw new Error(`Resend error: ${result.error.message}`)
    }

    console.log(` [Resend Success] Order confirmation sent to ${to}, Resend ID: ${result.data?.id}`)
    return result
  },

  /**
   * 2. Order Packed (Sent when staff clicks 'Spara packstatus' -> PACKED)
   */
  async sendOrderPackedNotice(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer?.email

    if (!to) {
      return { id: 'skipped-no-recipient' }
    }

    const isPickup = order.customer?.fulfillmentMethod === 'PICKUP'
    let pickupSettings: IPickupSettings | undefined
    let generalSettings: IGeneralSettings | undefined

    try {
      generalSettings = await getStoreGeneralSettings()
    } catch (err) {
      console.warn('[MailService] Failed to load store general settings:', err)
    }

    if (isPickup) {
      try {
        pickupSettings = await getStorePickupSettings()
      } catch (err) {
        console.warn('[MailService] Failed to load store pickup settings:', err)
      }
    }

    const subjects: Record<EmailLocale, string> = {
      ar: isPickup
        ? `طلبك #${order.orderReference} جاهز للاستلام في المتجر`
        : `تم تجهيز وتغليف طلبك #${order.orderReference} وفي انتظار شركة الشحن`,
      sv: isPickup
        ? `Din order #${order.orderReference} är redo att hämtas i butik!`
        : `Din order #${order.orderReference} är färdigpackad och väntar på upphämtning`,
      en: isPickup
        ? `Your order #${order.orderReference} is ready for store pickup!`
        : `Your order #${order.orderReference} is packed and awaiting courier pickup`,
    }

    const html = generatePackedHtml(order, locale, pickupSettings, generalSettings)

    if (!resend) {
      console.log(`[MOCK EMAIL: PACKED] To: ${to} | Subject: ${subjects[locale]}`)
      return { id: 'mock-mail-id' }
    }

    const result = await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })

    if (result.error) {
      console.error(` [Resend Error] Failed to send packed notice to ${to}:`, result.error)
      throw new Error(`Resend error: ${result.error.message}`)
    }

    console.log(` [Resend Success] Packed notice delivered to ${to}, Resend ID: ${result.data?.id}`)
    return result
  },

  /**
   * Compatibility alias for Stage 2 Packed Notice
   */
  async sendOrderPackedEmail(order: IOrder, locale: EmailLocale = 'sv') {
    return this.sendOrderPackedNotice(order, locale)
  },

  /**
   * Compatibility alias for in-store pickup
   */
  async sendReadyForPickup(order: IOrder, locale: EmailLocale = 'sv') {
    return this.sendOrderPackedNotice(order, locale)
  },

  generatePackedHtml,

  /**
   * 3. Order Dispatched (Sent when staff clicks 'Slutför och Skicka' -> DISPATCHED)
   */
  async sendOrderDispatched(
    params: { order: IOrder; trackingCode?: string; carrier?: string },
    locale: EmailLocale = 'sv'
  ) {
    const { order, trackingCode, carrier = 'DHL' } = params
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer?.email

    if (!to) {
      return { id: 'skipped-no-recipient' }
    }

    const subjects: Record<EmailLocale, string> = {
      ar: `تم شحن طلبك #${order.orderReference} - الفاتورة النهائية`,
      sv: `Din order #${order.orderReference} har skickats - Slutgiltigt kvitto`,
      en: `Your order #${order.orderReference} has been dispatched - Final Receipt`,
    }

    const html = generateDispatchedReceiptHtml(order, trackingCode, carrier, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: DISPATCH] To: ${to} | Subject: ${subjects[locale]}`)
      return { id: 'mock-mail-id' }
    }

    const result = await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })

    if (result.error) {
      console.error(` [Resend Error] Failed to send dispatched email to ${to}:`, result.error)
      throw new Error(`Resend error: ${result.error.message}`)
    }

    console.log(` [Resend Success] Dispatched email delivered to ${to}, Resend ID: ${result.data?.id}`)
    return result
  },

  /**
   * Compatibility alias for Stage 3 Dispatched Notice
   */
  async sendOrderDispatchedEmail(
    params: { order: IOrder; trackingCode?: string; carrier?: string },
    locale: EmailLocale = 'sv'
  ) {
    return this.sendOrderDispatched(params, locale)
  },

  generateDispatchedReceiptHtml,
  generateConfirmationHtml,

  /**
   * 4. Customer Contact Inquiry (Sent to store email when customer submits contact form)
   */
  async sendContactMessage(params: IContactMessageParams) {
    const { fullName, email, phone, orderReference, category = 'general', message } = params
    const resend = getResendClient()
    const from = getMailFrom()
    let to = getStoreEmail()
    try {
      const general = await getStoreGeneralSettings()
      if (general?.contact?.email?.trim()) {
        to = general.contact.email.trim()
      }
    } catch {
      // Fallback to getStoreEmail()
    }

    const categoryNames: Record<string, string> = {
      general: 'Allmän fråga',
      order: 'Order & Leverans',
      product: 'Produkter & Sortiment',
      feedback: 'Feedback & Förslag',
    }
    const catLabel = categoryNames[category] || category

    const subject = `[Kundkontakt - ${catLabel}] ${fullName}${orderReference ? ` (Order: #${orderReference})` : ''}`

    const html = generateContactInquiryHtml({
      fullName,
      email,
      phone,
      orderReference,
      categoryLabel: catLabel,
      message,
    })

    if (!resend) {
      console.log(`[MOCK EMAIL: CONTACT] To: ${to} | Reply-To: ${email} | Subject: ${subject}`)
      return { id: 'mock-mail-id' }
    }

    const result = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject,
      html,
    })

    if (result.error) {
      console.error(` [Resend Error] Failed to send contact message to ${to}:`, result.error)
      throw new Error(`Resend error: ${result.error.message}`)
    }

    console.log(` [Resend Success] Contact message delivered to ${to}, Resend ID: ${result.data?.id}`)
    return result
  },
}

// -------------------------------------------------------------
// REUSABLE HTML GENERATORS
// -------------------------------------------------------------

function renderItemsTable(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const align = isRtl ? 'right' : 'left'
  const oppAlign = isRtl ? 'left' : 'right'

  const labels = {
    ar: { item: 'المنتج', qty: 'الكمية', unitPrice: 'سعر الوحدة', total: 'المجموع' },
    sv: { item: 'Artikel', qty: 'Antal', unitPrice: 'A-pris', total: 'Belopp' },
    en: { item: 'Item', qty: 'Qty', unitPrice: 'Unit Price', total: 'Total' },
  }[locale]

  const rows = order.items
    .map((item) => {
      const name = item.name[locale] || item.name.sv || item.name.en || item.name.ar
      const qty = item.fulfilledQuantity ?? item.quantity
      if (qty === 0) return '' // Omit completely dropped shortage lines from final delivery receipt

      const hasDiscount = Boolean(item.discount && item.discount > 0 && item.originalUnitPriceMinor)

      return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${align};">
          <strong style="font-size: 14px;">${name}</strong>
          ${item.sku ? `<br><span style="font-size: 11px; color: #6b7280; font-family: monospace;">SKU: ${item.sku}</span>` : ''}
          ${hasDiscount ? `<br><span style="display: inline-block; font-size: 10px; font-weight: bold; background-color: #fee2e2; color: #dc2626; padding: 1px 6px; border-radius: 4px; margin-top: 3px;">-${item.discount}%</span>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px;">
          ${qty} st
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${oppAlign}; font-size: 13px; font-family: monospace;">
          ${hasDiscount ? `<span style="font-size: 11px; text-decoration: line-through; color: #9ca3af; display: block;">${formatMoney(item.originalUnitPriceMinor!, order.currency)}</span>` : ''}
          <span style="${hasDiscount ? 'color: #dc2626; font-weight: bold;' : ''}">${formatMoney(item.unitPriceMinor, order.currency)}</span>
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${oppAlign}; font-size: 13px; font-weight: bold; font-family: monospace; ${hasDiscount ? 'color: #dc2626;' : ''}">
          ${formatMoney(item.unitPriceMinor * qty, order.currency)}
        </td>
      </tr>
      `
    })
    .join('')

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 18px; margin-bottom: 18px;">
      <thead>
        <tr style="background-color: #f9fafb; color: #374151; font-size: 12px; text-transform: uppercase;">
          <th style="padding: 8px; text-align: ${align};">${labels.item}</th>
          <th style="padding: 8px; text-align: center;">${labels.qty}</th>
          <th style="padding: 8px; text-align: ${oppAlign};">${labels.unitPrice}</th>
          <th style="padding: 8px; text-align: ${oppAlign};">${labels.total}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `
}

function renderTotalsAndTax(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const align = isRtl ? 'right' : 'left'
  const oppAlign = isRtl ? 'left' : 'right'

  const totalCharged = order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor
  const authorizedTotal = order.pricing.authorizedTotalMinor || order.pricing.grandTotalMinor
  const releasedAmount =
    order.pricing.releasedOrRefundedMinor !== undefined
      ? order.pricing.releasedOrRefundedMinor
      : Math.max(0, authorizedTotal - totalCharged)
  const isShortageAdjusted = hasShortages(order) || releasedAmount > 0

  const labels = {
    ar: {
      subtotal: 'مجموع المنتجات:',
      discount: 'الخصم والتوفير:',
      released: 'المبلغ المحرر / المسترد:',
      shipping: 'الشحن والتوصيل:',
      grandTotal: isShortageAdjusted ? 'إجمالي المبلغ المخصوم:' : 'المجموع الكلي:',
      moms6: 'ضريبة 6%:',
      moms12: 'ضريبة 12%:',
      moms25: 'ضريبة 25%:',
      totalMoms: 'إجمالي ضريبة القيمة المضافة (Moms):',
    },
    sv: {
      subtotal: 'Delsumma varor:',
      discount: 'Kampanjrabatt:',
      released: 'Varav släppt/återbetalat belopp:',
      shipping: 'Fraktkostnad:',
      grandTotal: isShortageAdjusted ? 'Totalt debiterat belopp:' : 'Totalt belopp:',
      moms6: 'Moms 6%:',
      moms12: 'Moms 12%:',
      moms25: 'Moms 25%:',
      totalMoms: 'Varav moms totalt:',
    },
    en: {
      subtotal: 'Items Subtotal:',
      discount: 'Promotional Discount:',
      released: 'Released / Refunded Difference:',
      shipping: 'Shipping Fee:',
      grandTotal: isShortageAdjusted ? 'Total Captured Amount:' : 'Grand Total:',
      moms6: 'VAT 6%:',
      moms12: 'VAT 12%:',
      moms25: 'VAT 25%:',
      totalMoms: 'Total VAT Included:',
    },
  }[locale]

  const tax = order.pricing.taxSplit
  const totalSavingsMinor = order.items.reduce((acc, it) => {
    const orig = it.originalUnitPriceMinor || it.unitPriceMinor
    const diff = orig - it.unitPriceMinor
    const q = it.fulfilledQuantity ?? it.quantity
    return acc + (diff > 0 ? diff * q : 0)
  }, 0)

  return `
    <div style="border-top: 2px solid #111827; padding-top: 14px; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; text-align: ${align}; color: #4b5563;">${labels.subtotal}</td>
          <td style="padding: 4px 0; text-align: ${oppAlign}; font-family: monospace;">${formatMoney(order.pricing.itemsTotalMinor, order.currency)}</td>
        </tr>
        ${totalSavingsMinor > 0 ? `
        <tr>
          <td style="padding: 4px 0; text-align: ${align}; color: #16a34a; font-weight: bold;">${labels.discount}</td>
          <td style="padding: 4px 0; text-align: ${oppAlign}; font-family: monospace; color: #16a34a; font-weight: bold;">-${formatMoney(totalSavingsMinor, order.currency)}</td>
        </tr>
        ` : ''}
        ${releasedAmount > 0 ? `
        <tr>
          <td style="padding: 4px 0; text-align: ${align}; color: #b45309; font-weight: bold;">${labels.released}</td>
          <td style="padding: 4px 0; text-align: ${oppAlign}; font-family: monospace; color: #b45309; font-weight: bold;">-${formatMoney(releasedAmount, order.currency)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; text-align: ${align}; color: #4b5563;">${labels.shipping}</td>
          <td style="padding: 4px 0; text-align: ${oppAlign}; font-family: monospace;">${formatMoney(order.pricing.shippingFeeMinor, order.currency)}</td>
        </tr>
        <tr style="font-size: 16px; font-weight: bold; color: #111827;">
          <td style="padding: 8px 0; text-align: ${align};">${labels.grandTotal}</td>
          <td style="padding: 8px 0; text-align: ${oppAlign}; font-family: monospace;">${formatMoney(totalCharged, order.currency)}</td>
        </tr>
      </table>

      <!-- Audited Moms Box -->
      <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px; margin-top: 12px; font-size: 12px; color: #4b5563;">
        <table style="width: 100%;">
          ${(tax?.moms6?.momsAmountMinor || 0) > 0 ? `
          <tr>
            <td style="text-align: ${align};">${labels.moms6}</td>
            <td style="text-align: ${oppAlign}; font-family: monospace;">${formatMoney(tax?.moms6?.momsAmountMinor || 0, order.currency)}</td>
          </tr>
          ` : ''}
          ${(tax?.moms12?.momsAmountMinor || 0) > 0 ? `
          <tr>
            <td style="text-align: ${align};">${labels.moms12}</td>
            <td style="text-align: ${oppAlign}; font-family: monospace;">${formatMoney(tax?.moms12?.momsAmountMinor || 0, order.currency)}</td>
          </tr>
          ` : ''}
          ${(tax?.moms25?.momsAmountMinor || 0) > 0 ? `
          <tr>
            <td style="text-align: ${align};">${labels.moms25}</td>
            <td style="text-align: ${oppAlign}; font-family: monospace;">${formatMoney(tax?.moms25?.momsAmountMinor || 0, order.currency)}</td>
          </tr>
          ` : ''}
          <tr style="font-weight: bold; color: #111827;">
            <td style="text-align: ${align}; padding-top: 4px; border-top: 1px dashed #d1d5db;">${labels.totalMoms}</td>
            <td style="text-align: ${oppAlign}; padding-top: 4px; border-top: 1px dashed #d1d5db; font-family: monospace;">${formatMoney(tax?.totalMomsMinor || 0, order.currency)}</td>
          </tr>
        </table>
      </div>
    </div>
  `
}

function generateConfirmationHtml(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const receiptUrl = `${process.env.BASE_URL || 'https://siwar.se'}/order/confirmation/${order._id}`

  const copy = {
    ar: {
      heading: 'تم استلام طلبك بنجاح!',
      greeting: `مرحباً ${order.customer.fullName}،`,
      intro: 'شكراً لتسوقك من متجر سوار. لقد قمنا بتسجيل طلبك.',
      holdNotice: 'ملاحظة بخصوص الدفع: تم حجز المبلغ مؤقتاً في حسابك البنكي، ولن يتم خصمه نهائياً إلا بعد الانتهاء من تجهيز وتغليف الطلب والتأكد من توفر جميع المنتجات.',
      orderNum: 'رقم الطلب:',
      receiptBtn: 'عرض الفاتورة الإلكترونية',
    },
    sv: {
      heading: 'Tack för din beställning!',
      greeting: `Hej ${order.customer.fullName},`,
      intro: 'Vi har tagit emot din order och den behandlas nu av vårt lager.',
      holdNotice: 'Information om betalning: Beloppet har reserverats på ditt kort och dras först när din order är färdigpackad och godkänd för leverans.',
      orderNum: 'Ordernummer:',
      receiptBtn: 'Visa kvitto online',
    },
    en: {
      heading: 'Thank you for your order!',
      greeting: `Hello ${order.customer.fullName},`,
      intro: 'We have received your order and our staff will begin packing it shortly.',
      holdNotice: 'Payment authorization notice: The amount has been reserved on your card and will only be captured once your order has been packed and prepared for dispatch.',
      orderNum: 'Order Reference:',
      receiptBtn: 'View Receipt Online',
    },
  }[locale]

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: #15803d; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">${copy.heading}</h1>
        <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${copy.orderNum} <strong>${order.orderReference}</strong></p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 15px;">${copy.greeting}</p>
        <p style="font-size: 14px; color: #4b5563;">${copy.intro}</p>

        <!-- Reservation Notice Callout -->
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
          ${copy.holdNotice}
        </div>

        ${renderItemsTable(order, locale)}
        ${renderTotalsAndTax(order, locale)}

        <div style="margin-top: 28px; text-align: center;">
          <a href="${receiptUrl}" style="background-color: #15803d; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            ${copy.receiptBtn}
          </a>
        </div>
      </div>
    </div>
  `
}

/**
 * Helper to determine whether an order has shortages or adjustments applied during fulfillment.
 */
export function hasShortages(order: IOrder): boolean {
  if (order.shortageAdjustments && order.shortageAdjustments.length > 0) return true
  if (order.items && order.items.some((i) => i.shortageStatus && i.shortageStatus !== 'NONE')) return true
  if (order.pricing?.releasedOrRefundedMinor && order.pricing.releasedOrRefundedMinor > 0) return true
  return false
}

export interface ExtractedShortageItem {
  type: 'REMOVED' | 'REDUCED' | 'SUBSTITUTED'
  originalName: string
  originalSku?: string
  droppedQty: number
  unitPriceMinor: number
  droppedDifferenceMinor: number
  originalQty?: number
  fulfilledQty?: number
  subName?: string
  subSku?: string
  subUnitPriceMinor?: number
}

/**
 * Extracts and normalizes shortage details from shortageAdjustments and item records.
 */
export function extractOrderShortages(order: IOrder, locale: EmailLocale): ExtractedShortageItem[] {
  const result: ExtractedShortageItem[] = []
  const currency = order.currency || 'SEK'

  if (order.shortageAdjustments && order.shortageAdjustments.length > 0) {
    for (const adj of order.shortageAdjustments) {
      const origName =
        adj.originalName?.[locale] ||
        adj.originalName?.sv ||
        adj.originalName?.en ||
        adj.originalName?.ar ||
        'Vara'

      if (adj.action === 'REMOVE_LINE') {
        const droppedQty = adj.originalQuantity
        const diffMinor = droppedQty * adj.originalUnitPriceMinor
        result.push({
          type: 'REMOVED',
          originalName: origName,
          originalSku: adj.originalSku,
          droppedQty,
          unitPriceMinor: adj.originalUnitPriceMinor,
          droppedDifferenceMinor: diffMinor,
        })
      } else if (adj.action === 'REDUCE_QUANTITY') {
        const droppedQty = Math.max(0, adj.originalQuantity - adj.adjustedQuantity)
        const diffMinor = droppedQty * adj.originalUnitPriceMinor
        result.push({
          type: 'REDUCED',
          originalName: origName,
          originalSku: adj.originalSku,
          droppedQty,
          originalQty: adj.originalQuantity,
          fulfilledQty: adj.adjustedQuantity,
          unitPriceMinor: adj.originalUnitPriceMinor,
          droppedDifferenceMinor: diffMinor,
        })
      } else if (adj.action === 'SUBSTITUTE_ITEM') {
        const subItem = order.items.find(
          (it) =>
            (adj.substitutedProductId && String(it.productId) === String(adj.substitutedProductId)) ||
            (it.originalProductId && String(it.originalProductId) === String(adj.productId))
        )
        const subName = subItem
          ? subItem.name?.[locale] || subItem.name?.sv || subItem.name?.en || subItem.name?.ar
          : adj.note || 'Ersättningsvara'
        const subSku = adj.substitutedSku || subItem?.sku
        const subUnitPriceMinor = adj.substitutedUnitPriceMinor ?? subItem?.unitPriceMinor ?? 0
        const diffMinor = Math.max(
          0,
          adj.originalQuantity * adj.originalUnitPriceMinor -
            (subItem ? (subItem.fulfilledQuantity ?? subItem.quantity) * subUnitPriceMinor : 0)
        )

        result.push({
          type: 'SUBSTITUTED',
          originalName: origName,
          originalSku: adj.originalSku,
          originalQty: adj.originalQuantity,
          droppedQty: adj.originalQuantity,
          unitPriceMinor: adj.originalUnitPriceMinor,
          droppedDifferenceMinor: diffMinor,
          subName,
          subSku,
          subUnitPriceMinor,
        })
      }
    }
    return result
  }

  // Fallback if shortageAdjustments array is missing but items have shortageStatus
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.name?.[locale] || item.name?.sv || item.name?.en || item.name?.ar || 'Vara'
      if (item.shortageStatus === 'REMOVED' || (item.fulfilledQuantity === 0 && item.quantity > 0)) {
        const droppedQty = item.quantity
        result.push({
          type: 'REMOVED',
          originalName: name,
          originalSku: item.sku,
          droppedQty,
          unitPriceMinor: item.unitPriceMinor,
          droppedDifferenceMinor: droppedQty * item.unitPriceMinor,
        })
      } else if (item.shortageStatus === 'REDUCED') {
        const droppedQty = Math.max(0, item.quantity - item.fulfilledQuantity)
        result.push({
          type: 'REDUCED',
          originalName: name,
          originalSku: item.sku,
          droppedQty,
          originalQty: item.quantity,
          fulfilledQty: item.fulfilledQuantity,
          unitPriceMinor: item.unitPriceMinor,
          droppedDifferenceMinor: droppedQty * item.unitPriceMinor,
        })
      } else if (item.shortageStatus === 'SUBSTITUTED' || item.originalProductId) {
        result.push({
          type: 'SUBSTITUTED',
          originalName: name,
          originalSku: item.sku,
          droppedQty: 0,
          unitPriceMinor: item.unitPriceMinor,
          droppedDifferenceMinor: 0,
          subName: name,
          subSku: item.sku,
          subUnitPriceMinor: item.unitPriceMinor,
        })
      }
    }
  }

  return result
}

/**
 * Dedicated Amber Callout Box rendered in Stage 2 (Order Packed) email when shortages exist.
 * Includes strikethrough removed/reduced items, substitutions, revised hold capture amount,
 * and an explicit prompt urging the customer to contact support if they wish to modify or cancel.
 */
export function renderPackedShortageCallout(
  order: IOrder,
  locale: EmailLocale,
  generalSettings?: IGeneralSettings | { contact?: { email?: string; phone?: string } } | null
): string {
  if (!hasShortages(order)) return ''

  const isRtl = locale === 'ar'
  const align = isRtl ? 'right' : 'left'
  const oppAlign = isRtl ? 'left' : 'right'
  const accentBorder = isRtl
    ? 'border-right: 4px solid #f59e0b; border-left: 1px solid #fde68a;'
    : 'border-left: 4px solid #f59e0b; border-right: 1px solid #fde68a;'

  const { email: storeEmail, phone: storePhone } = resolveStoreContact(generalSettings)

  const currency = order.currency || 'SEK'
  const authorizedTotal = order.pricing.authorizedTotalMinor || order.pricing.grandTotalMinor
  const capturedTotal = order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor
  const releasedAmount =
    order.pricing.releasedOrRefundedMinor !== undefined
      ? order.pricing.releasedOrRefundedMinor
      : Math.max(0, authorizedTotal - capturedTotal)

  const copy = {
    ar: {
      calloutTitle: 'تنبيه هام: تعديل الطلب بسبب عدم توفر بعض الأصناف',
      intro:
        'أثناء تجهيز وتغليف طلبك في المستودع، تبين للأسف عدم توفر بعض الأصناف أو تطلب الأمر استبدالها/تعديلها. يرجى الاطلاع على التفاصيل أدناه:',
      removedTitle: 'المنتجات الملغاة أو المخفضة:',
      substitutedTitle: 'المنتجات البديلة (التعويضية):',
      financialTitle: 'الملخص المالي ومبلغ الدفع الفعلي:',
      originalHold: 'المبلغ المحجوز مبدئياً:',
      releasedAmount: 'المبلغ المحرر / غير المسحوب:',
      revisedCapture: 'المبلغ النهائي المعدل للخصم عند الشحن:',
      customerActionTitle: 'هل ترغب في إجراء أي تعديل أو إلغاء الطلب؟',
      customerActionPrompt:
        `إذا كانت لديك أي استفسارات، أو ترغب في إضافة صنف بديل، أو تفضل إلغاء الطلب بالكامل قبل تسليمه لشركة الشحن، يرجى التواصل فوراً مع فريق خدمة العملاء لدينا عبر البريد الإلكتروني ${storeEmail} أو الهاتف ${storePhone}.`,
      droppedLabel: 'الكمية الملغاة',
      pcs: 'قطعة',
      skuLabel: 'رمز المنتج (SKU):',
      unitPriceLabel: 'سعر الوحدة:',
      releasedDiff: 'تم تحرير:',
      replacesOriginal: 'بديل عن المنتج:',
    },
    sv: {
      calloutTitle: 'Viktigt meddelande: Varubrist och justering av din order',
      intro:
        'Vid packning av din beställning upptäckte vi tyvärr att vissa varor saknades i vårt lager eller har behövt justeras/ersättas. Se sammanställning över justeringarna nedan:',
      removedTitle: 'Borttagna eller minskade varor:',
      substitutedTitle: 'Ersättningsvaror (Substitutioner):',
      financialTitle: 'Ekonomisk sammanställning & Draget belopp:',
      originalHold: 'Ursprungligt reserverat belopp:',
      releasedAmount: 'Frigjort belopp (dras ej):',
      revisedCapture: 'Reviderat belopp som debiteras vid sändning:',
      customerActionTitle: 'Önskar du ändra eller avbryta?',
      customerActionPrompt:
        `Om du har några frågor om justeringarna, vill lägga till en ersättningsvara eller föredrar att avbryta hela ordern innan paketet lämnas över till transportören, vänligen kontakta vår kundtjänst omgående på ${storeEmail} eller ${storePhone}.`,
      droppedLabel: 'Minskad med',
      pcs: 'st',
      skuLabel: 'Artikelnr (SKU):',
      unitPriceLabel: 'A-pris:',
      releasedDiff: 'Frigjort:',
      replacesOriginal: 'Ersätter ursprunglig vara:',
    },
    en: {
      calloutTitle: 'Important Notice: Item Shortage & Order Adjustment',
      intro:
        'While packing your order, we unfortunately found that some items were out of stock or required adjustment/substitution. Please review the summary of changes below:',
      removedTitle: 'Removed or Reduced Items:',
      substitutedTitle: 'Substituted Items:',
      financialTitle: 'Financial Summary & Revised Total:',
      originalHold: 'Original Authorized Amount (Hold):',
      releasedAmount: 'Released / Uncaptured Difference:',
      revisedCapture: 'Revised Total to be Captured upon Dispatch:',
      customerActionTitle: 'Wish to modify or cancel?',
      customerActionPrompt:
        `If you have any questions, wish to add a replacement item, or prefer to cancel your order before it is handed over to the courier, please contact our support team immediately at ${storeEmail} or ${storePhone}.`,
      droppedLabel: 'Dropped',
      pcs: 'pcs',
      skuLabel: 'SKU:',
      unitPriceLabel: 'Unit price:',
      releasedDiff: 'Released:',
      replacesOriginal: 'Replaces original item:',
    },
  }[locale]

  const shortages = extractOrderShortages(order, locale)
  const removedOrReduced = shortages.filter((s) => s.type === 'REMOVED' || s.type === 'REDUCED')
  const substituted = shortages.filter((s) => s.type === 'SUBSTITUTED')

  return `
    <div style="background-color: #fffbeb; border-top: 1px solid #fde68a; border-bottom: 1px solid #fde68a; ${accentBorder} border-radius: 8px; padding: 18px 20px; margin: 20px 0; text-align: ${align}; color: #92400e; font-size: 13.5px; line-height: 1.5;">
      <div style="font-weight: bold; color: #b45309; font-size: 15px; margin-bottom: 8px;">
        ⚠️ ${copy.calloutTitle}
      </div>
      <p style="margin: 0 0 12px 0; color: #78350f;">
        ${copy.intro}
      </p>

      ${
        removedOrReduced.length > 0
          ? `
        <div style="margin-bottom: 14px;">
          <div style="font-weight: bold; color: #78350f; font-size: 13px; text-transform: uppercase; margin-bottom: 6px;">
             ${copy.removedTitle}
          </div>
          <ul style="margin: 0; padding-${align}: 20px; list-style-type: disc;">
            ${removedOrReduced
              .map(
                (item) => `
              <li style="margin-bottom: 6px;">
                <span style="text-decoration: line-through; font-weight: bold; color: #4b5563;">${item.originalName}</span>
                ${item.originalSku ? `<span style="font-size: 11px; color: #6b7280; font-family: monospace;"> (${copy.skuLabel} ${item.originalSku})</span>` : ''}
                <br>
                <span style="font-size: 12px; color: #b45309; font-weight: 600;">
                  &bull; ${copy.droppedLabel}: ${item.droppedQty} ${copy.pcs} (${copy.releasedDiff} -${formatMoney(item.droppedDifferenceMinor, currency)})
                </span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
          : ''
      }

      ${
        substituted.length > 0
          ? `
        <div style="margin-bottom: 14px;">
          <div style="font-weight: bold; color: #166534; font-size: 13px; text-transform: uppercase; margin-bottom: 6px;">
            🔄 ${copy.substitutedTitle}
          </div>
          <ul style="margin: 0; padding-${align}: 20px; list-style-type: disc;">
            ${substituted
              .map(
                (item) => `
              <li style="margin-bottom: 6px;">
                <strong style="color: #15803d;">${item.subName || item.originalName}</strong>
                ${item.subSku ? `<span style="font-size: 11px; color: #6b7280; font-family: monospace;"> (${copy.skuLabel} ${item.subSku})</span>` : ''}
                ${item.subUnitPriceMinor !== undefined ? `<span style="font-size: 12px; font-weight: 600; color: #111827;"> &bull; ${copy.unitPriceLabel} ${formatMoney(item.subUnitPriceMinor, currency)}</span>` : ''}
                ${
                  item.originalName && item.subName && item.originalName !== item.subName
                    ? `
                  <br>
                  <span style="font-size: 12px; color: #6b7280;">
                    <em>${copy.replacesOriginal} <span style="text-decoration: line-through;">${item.originalName}</span></em>
                  </span>
                `
                    : ''
                }
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
          : ''
      }

      <!-- Financial Notice -->
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-top: 12px;">
        <div style="font-weight: bold; color: #92400e; font-size: 13px; margin-bottom: 6px;">
          💳 ${copy.financialTitle}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 3px 0; color: #4b5563; text-align: ${align};">${copy.originalHold}</td>
            <td style="padding: 3px 0; font-family: monospace; text-align: ${oppAlign};">${formatMoney(authorizedTotal, currency)}</td>
          </tr>
          ${
            releasedAmount > 0
              ? `
          <tr>
            <td style="padding: 3px 0; color: #b45309; font-weight: 600; text-align: ${align};">${copy.releasedAmount}</td>
            <td style="padding: 3px 0; font-family: monospace; color: #b45309; font-weight: 600; text-align: ${oppAlign};">-${formatMoney(releasedAmount, currency)}</td>
          </tr>
          `
              : ''
          }
          <tr style="font-weight: bold; font-size: 14px; border-top: 1px dashed #d97706; color: #78350f;">
            <td style="padding: 6px 0 2px 0; text-align: ${align};">${copy.revisedCapture}</td>
            <td style="padding: 6px 0 2px 0; font-family: monospace; text-align: ${oppAlign};">${formatMoney(capturedTotal, currency)}</td>
          </tr>
        </table>
      </div>

      <!-- Customer Action Prompt Callout -->
      <div style="margin-top: 12px; padding: 10px 14px; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 12.5px; line-height: 1.5; color: #9a3412;">
        <strong>💬 ${copy.customerActionTitle}</strong><br>
        ${copy.customerActionPrompt}
      </div>
    </div>
  `
}

function generatePackedHtml(
  order: IOrder,
  locale: EmailLocale,
  pickupSettings?: IPickupSettings,
  generalSettings?: IGeneralSettings | { contact?: { email?: string; phone?: string } } | null
): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const isPickup = order.customer?.fulfillmentMethod === 'PICKUP'
  const customerName = order.customer?.fullName || ''

  const pickup = pickupSettings || DEFAULT_PICKUP_CONFIG
  const street = pickup.address?.street || 'Åttingsstigen 41'
  const postalCode = pickup.address?.postalCode || '302 54'
  const city = pickup.address?.city || 'Halmstad'
  const fullAddress = `${street}, ${postalCode} ${city}`

  const pickupHours =
    pickup.pickupHours?.[locale] ||
    pickup.pickupHours?.sv ||
    pickup.pickupHours?.en ||
    pickup.pickupHours?.ar ||
    'Måndag - Fredag: 10:00 - 18:00 | Lördag: 11:00 - 15:00'

  const instructions =
    pickup.instructions?.[locale] ||
    pickup.instructions?.sv ||
    pickup.instructions?.en ||
    pickup.instructions?.ar ||
    ''

  const copy = {
    ar: {
      heading: isPickup ? 'طلبك جاهز للاستلام من المتجر!' : 'تم تجهيز طلبك بنجاح!',
      greeting: `مرحباً ${customerName}،`,
      body: isPickup
        ? `يسعدنا إبلاغك بأن طلبك رقم <strong>${order.orderReference}</strong> أصبح مجهزاً بالكامل ومتاحاً للاستلام الآن في المتجر.`
        : `لقد انتهينا من تجهيز وتغليف طلبك رقم <strong>${order.orderReference}</strong>. الطرد جاهز الآن وفي انتظار تسليمه لشركة الشحن (DHL). سنرسل لك رسالة أخرى برابط التتبع بمجرد خروج الشحنة.`,
      pickupCardTitle: 'معلومات الاستلام من المتجر',
      addressLabel: 'عنوان المتجر',
      hoursLabel: 'أوقات الاستلام',
      instructionsLabel: 'تعليمات الاستلام',
      tableTitle: isPickup ? 'محتويات الطلب المجهز للاستلام:' : 'محتويات الشحنة المجهزة:',
    },
    sv: {
      heading: isPickup ? 'Din order är redo att hämtas i butik!' : 'Din order är färdigpackad!',
      greeting: `Hej ${customerName},`,
      body: isPickup
        ? `Din order <strong>${order.orderReference}</strong> är nu färdigpackad och finns redo för avhämtning i vår butik.`
        : `Vi har nu packat din order <strong>${order.orderReference}</strong>. Paketet inväntar upphämtning av DHL. Vi meddelar dig med spårningslänk så snart transportören har hämtat paketet.`,
      pickupCardTitle: 'Information för utlämning i butik',
      addressLabel: 'Hämtadress',
      hoursLabel: 'Öppettider för utlämning',
      instructionsLabel: 'Instruktioner',
      tableTitle: isPickup ? 'Färdigpackade artiklar för avhämtning:' : 'Packade artiklar:',
    },
    en: {
      heading: isPickup ? 'Your order is ready for in-store pickup!' : 'Your order is packed!',
      greeting: `Hello ${customerName},`,
      body: isPickup
        ? `Your order <strong>${order.orderReference}</strong> is packed and ready for collection at our store.`
        : `We have packed your order <strong>${order.orderReference}</strong>. It is now awaiting courier collection by DHL. We will notify you with tracking details as soon as it is dispatched.`,
      pickupCardTitle: 'In-Store Pickup Information',
      addressLabel: 'Pickup Address',
      hoursLabel: 'Pickup Hours',
      instructionsLabel: 'Instructions',
      tableTitle: isPickup ? 'Items ready for collection:' : 'Packed items:',
    },
  }[locale]

  const pickupInfoBox = isPickup
    ? `
    <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 20px; margin: 22px 0; text-align: ${align};">
      <div style="font-weight: bold; color: #166534; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #bbf7d0; padding-bottom: 8px;">
        📍 ${copy.pickupCardTitle}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1f2937;">
        <tr>
          <td style="padding: 6px 0; vertical-align: top; width: 32%; color: #374151; font-weight: bold;">
            ${copy.addressLabel}:
          </td>
          <td style="padding: 6px 0; vertical-align: top; color: #111827; font-weight: 500;">
            ${fullAddress}
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; vertical-align: top; width: 32%; color: #374151; font-weight: bold;">
            ${copy.hoursLabel}:
          </td>
          <td style="padding: 6px 0; vertical-align: top; color: #166534; font-weight: 700;">
            ${pickupHours}
          </td>
        </tr>
        ${
          instructions
            ? `
        <tr>
          <td style="padding: 6px 0; vertical-align: top; width: 32%; color: #374151; font-weight: bold;">
            ${copy.instructionsLabel}:
          </td>
          <td style="padding: 6px 0; vertical-align: top; color: #4b5563;">
            ${instructions}
          </td>
        </tr>
        `
            : ''
        }
      </table>
    </div>
    `
    : ''

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: ${isPickup ? '#16a34a' : '#0284c7'}; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">${copy.heading}</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px;">${copy.greeting}</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">${copy.body}</p>

        ${pickupInfoBox}

        ${renderPackedShortageCallout(order, locale, generalSettings)}

        <h3 style="font-size: 14px; margin-top: 24px; margin-bottom: 0;">${copy.tableTitle}</h3>
        ${renderItemsTable(order, locale)}
        ${hasShortages(order) ? renderTotalsAndTax(order, locale) : ''}
      </div>
    </div>
  `
}

function generateDispatchedReceiptHtml(
  order: IOrder,
  trackingCode: string | undefined,
  carrier: string = 'DHL',
  locale: EmailLocale = 'sv'
): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const isDhl = !carrier || carrier.toUpperCase().includes('DHL')
  const trackingUrl = trackingCode
    ? isDhl
      ? `https://www.dhl.com/se-sv/home/tracking.html?tracking-id=${encodeURIComponent(trackingCode)}`
      : `https://www.postnord.se/vara-verktyg/spara-brev-paket-och-pall?shipmentId=${encodeURIComponent(trackingCode)}`
    : '#'
  const receiptUrl = `${process.env.BASE_URL || 'https://siwar.se'}/order/confirmation/${order._id}`

  const totalCharged = order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor
  const authorizedTotal = order.pricing.authorizedTotalMinor || order.pricing.grandTotalMinor
  const releasedAmount =
    order.pricing.releasedOrRefundedMinor !== undefined
      ? order.pricing.releasedOrRefundedMinor
      : Math.max(0, authorizedTotal - totalCharged)

  const copy = {
    ar: {
      heading: 'تم شحن طلبك - الفاتورة النهائية',
      greeting: `مرحباً ${order.customer.fullName}،`,
      intro: `يسرنا إبلاغك بأن طلبك رقم <strong>${order.orderReference}</strong> قد تم تسليمه لشركة الشحن (${carrier || 'DHL'}) وهو الآن في طريقه إليك.`,
      settlementNotice: 'تم سحب المبلغ النهائي بنجاح من وسيلة الدفع الخاصة بك.',
      trackingBtn: (carrier || 'DHL').toUpperCase().includes('DHL') ? 'تتبع الشحنة على DHL' : `تتبع الشحنة على ${carrier}`,
      trackingCodeLabel: 'رقم التتبع (Kolli-ID):',
      receiptBtn: 'عرض الفاتورة الضريبية الكاملة',
      addressTitle: 'عنوان التسليم:',
    },
    sv: {
      heading: 'Din order har skickats - Slutgiltigt kvitto',
      greeting: `Hej ${order.customer.fullName},`,
      intro: `Ditt paket för order <strong>${order.orderReference}</strong> har lämnats över till ${carrier || 'DHL'} och är nu på väg till dig.`,
      settlementNotice: 'Det slutgiltiga beloppet har nu dragits från ditt betalkort.',
      trackingBtn: (carrier || 'DHL').toUpperCase().includes('DHL') ? 'Spåra paketet hos DHL' : `Spåra paketet hos ${carrier}`,
      trackingCodeLabel: 'Kolli-ID / Försändelse-ID:',
      receiptBtn: 'Öppna fullständigt kvitto',
      addressTitle: 'Leveransadress:',
    },
    en: {
      heading: 'Your order has been dispatched - Final Receipt',
      greeting: `Hello ${order.customer.fullName},`,
      intro: `Your package for order <strong>${order.orderReference}</strong> has been handed over to ${carrier || 'DHL'} and is on its way.`,
      settlementNotice: 'The final fulfilled amount has now been captured from your payment method.',
      trackingBtn: (carrier || 'DHL').toUpperCase().includes('DHL') ? 'Track Package on DHL' : `Track Package on ${carrier}`,
      trackingCodeLabel: 'Tracking Number (Kolli-ID):',
      receiptBtn: 'Open Complete Tax Receipt',
      addressTitle: 'Delivery Address:',
    },
  }[locale]

  let shortageAuditNoteHtml = ''
  if (hasShortages(order)) {
    const auditText = {
      ar: `تم شحن الطلب مع تعديل لعدم توفر بعض الأصناف. إجمالي المبلغ المخصوم: ${formatMoney(totalCharged, order.currency)} (تم تحرير/إرجاع ${formatMoney(releasedAmount, order.currency)}).`,
      sv: `Ordern skickades med justering för varubrist. Totalt debiterat: ${formatMoney(totalCharged, order.currency)} (${formatMoney(releasedAmount, order.currency)} har släppts/återbetalats).`,
      en: `The order was dispatched with adjustments for item shortage. Total captured: ${formatMoney(totalCharged, order.currency)} (${formatMoney(releasedAmount, order.currency)} has been released/refunded).`,
    }[locale]

    const accentBorder = isRtl
      ? 'border-right: 4px solid #f59e0b; border-left: 1px solid #fde68a;'
      : 'border-left: 4px solid #f59e0b; border-right: 1px solid #fde68a;'

    shortageAuditNoteHtml = `
      <div style="background-color: #fffbeb; border-top: 1px solid #fde68a; border-bottom: 1px solid #fde68a; ${accentBorder} border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #92400e; line-height: 1.5; text-align: ${align};">
        <strong>ℹ️ ${auditText}</strong>
      </div>
    `
  }

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: #15803d; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">${copy.heading}</h1>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 15px;">${copy.greeting}</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">${copy.intro}</p>

        <!-- Tracking Card -->
        ${
          trackingCode
            ? `
          <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; text-align: center; margin: 18px 0;">
            <div style="font-size: 13px; color: #4b5563; margin-bottom: 4px;">${copy.trackingCodeLabel}</div>
            <div style="font-size: 18px; font-weight: bold; font-family: monospace; margin-bottom: 12px;">${trackingCode}</div>
            <a href="${trackingUrl}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 9px 18px; border-radius: 5px; font-size: 13px; font-weight: bold; display: inline-block;">
              ${copy.trackingBtn}
            </a>
          </div>
        `
            : ''
        }

        ${shortageAuditNoteHtml}

        <p style="font-size: 12px; color: #6b7280; font-style: italic;">${copy.settlementNotice}</p>

        <!-- Delivery Address summary -->
        ${
          order.customer.address
            ? `
          <div style="background-color: #fafafa; border: 1px solid #f3f4f6; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 13px;">
            <strong style="color: #374151;">${copy.addressTitle}</strong><br>${order.customer.address.street}<br>
            ${order.customer.address.postalCode} ${order.customer.address.city}
          </div>
        `
            : ''
        }

        <!-- Final Immutable Items & Taxes -->
        ${renderItemsTable(order, locale)}
        ${renderTotalsAndTax(order, locale)}

        <div style="margin-top: 28px; text-align: center;">
          <a href="${receiptUrl}" style="background-color: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            ${copy.receiptBtn}
          </a>
        </div>
      </div>
    </div>
  `
}

function generateContactInquiryHtml(params: {
  fullName: string
  email: string
  phone?: string
  orderReference?: string
  categoryLabel: string
  message: string
}): string {
  const { fullName, email, phone, orderReference, categoryLabel, message } = params
  // Escape message for HTML safety
  const safeMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')

  const safeName = fullName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeEmail = email.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safePhone = (phone || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeOrder = (orderReference || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `
    <div dir="ltr" style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: #15803d; color: #ffffff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">Nytt kundmeddelande</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Mottaget via kontaktformuläret på siwar.se</p>
      </div>

      <div style="padding: 24px;">
        <!-- Metadata Box -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; width: 140px; font-weight: 600;">Avsändare:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: bold;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">E-postadress:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              <a href="mailto:${safeEmail}" style="color: #15803d; text-decoration: underline; font-weight: 600;">${safeEmail}</a>
            </td>
          </tr>
          ${
            phone
              ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Telefon:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              <a href="tel:${safePhone}" style="color: #111827; text-decoration: none;">${safePhone}</a>
            </td>
          </tr>`
              : ''
          }
          ${
            orderReference
              ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Ordernummer:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-family: monospace; font-weight: bold; color: #111827;">#${safeOrder}</td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: 600;">Kategori:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              <span style="display: inline-block; background-color: #f3f4f6; color: #374151; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                ${categoryLabel}
              </span>
            </td>
          </tr>
        </table>

        <!-- Message Box -->
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 18px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em;">Meddelande:</h3>
          <div style="font-size: 15px; line-height: 1.6; color: #1f2937; word-break: break-word;">
            ${safeMessage}
          </div>
        </div>

        <!-- Quick Reply Callout -->
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #065f46; line-height: 1.5;">
          💡 <strong>Tips:</strong> Du kan svara kunden direkt genom att trycka på <em>Svara</em> i ditt e-postprogram (Svarsadressen är förinställd till <strong>${safeEmail}</strong>).
        </div>
      </div>

      <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 14px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        Siwar Webstore Kundkontakt &bull; Åttingsstigen 41, 302 54 Halmstad
      </div>
    </div>
  `
}

export {
  generateConfirmationHtml,
  generatePackedHtml,
  generateDispatchedReceiptHtml,
  generateContactInquiryHtml,
  resolveStoreContact,
}