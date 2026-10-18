// server/services/mail.service.ts
import { Resend } from 'resend'
import type { IOrder } from '~/server/models/Order'

export type EmailLocale = 'ar' | 'sv' | 'en'

function getResendClient() {
  const config = useRuntimeConfig()
  const apiKey = (config.resendApiKey as string | undefined) || process.env.RESEND_API_KEY || process.env.MAIL_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function formatMoney(amountMinor: number, currency = 'SEK'): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

function getMailFrom(): string {
  const config = useRuntimeConfig()
  return (
    (config.mailFrom as string | undefined) ||
    process.env.MAIL_FROM ||
    process.env.MAIL_FROM_ADDRESS ||
    'Siwar Webstore <order@ibrahim-alzoubi.se>'
  )
}

export const mailService = {
  /**
   * 1. Order Confirmation (Sent immediately upon payment authorization)
   */
  async sendOrderConfirmation(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer.email

    const subjects: Record<EmailLocale, string> = {
      ar: `تأكيد استلام الطلب #${order.orderReference} - متجر سوار`,
      sv: `Orderbekräftelse #${order.orderReference} - Siwar`,
      en: `Order Confirmation #${order.orderReference} - Siwar Store`,
    }

    const html = generateConfirmationHtml(order, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: CONFIRMATION] To: ${to} | Subject: ${subjects[locale]}`)
      return { id: 'mock-mail-id' }
    }

    return await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })
  },

  /**
   * 2. Order Packed (Sent when staff clicks 'Spara packstatus' -> PACKED)
   */
  async sendOrderPackedNotice(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer.email

    const isPickup = order.customer.fulfillmentMethod === 'PICKUP'

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

    const html = generatePackedHtml(order, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: PACKED] To: ${to} | Subject: ${subjects[locale]}`)
      return { id: 'mock-mail-id' }
    }

    return await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })
  },

  /**
   * Compatibility alias for in-store pickup
   */
  async sendReadyForPickup(order: IOrder, locale: EmailLocale = 'sv') {
    return this.sendOrderPackedNotice(order, locale)
  },

  /**
   * 3. Order Dispatched (Sent when staff clicks 'Slutför och Skicka' -> DISPATCHED)
   */
  async sendOrderDispatched(
    params: { order: IOrder; trackingCode?: string; carrier?: string },
    locale: EmailLocale = 'sv'
  ) {
    const { order, trackingCode, carrier = 'PostNord' } = params
    const resend = getResendClient()
    const from = getMailFrom()
    const to = order.customer.email

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

    return await resend.emails.send({
      from,
      to,
      subject: subjects[locale],
      html,
    })
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

      return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${align};">
          <strong style="font-size: 14px;">${name}</strong>
          ${item.sku ? `<br><span style="font-size: 11px; color: #6b7280; font-family: monospace;">SKU: ${item.sku}</span>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 13px;">
          ${qty} st
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${oppAlign}; font-size: 13px; font-family: monospace;">
          ${formatMoney(item.unitPriceMinor, order.currency)}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: ${oppAlign}; font-size: 13px; font-weight: bold; font-family: monospace;">
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

  const labels = {
    ar: {
      subtotal: 'مجموع المنتجات:',
      shipping: 'الشحن والتوصيل:',
      grandTotal: 'المجموع الكلي:',
      moms12: 'ضريبة 12% (أغذية):',
      moms25: 'ضريبة 25% (بضائع/شحن):',
      totalMoms: 'إجمالي ضريبة القيمة المضافة (Moms):',
    },
    sv: {
      subtotal: 'Delsumma varor:',
      shipping: 'Fraktkostnad:',
      grandTotal: 'Totalt belopp:',
      moms12: 'Moms 12% (livsmedel):',
      moms25: 'Moms 25% (övrigt/frakt):',
      totalMoms: 'Varav moms totalt:',
    },
    en: {
      subtotal: 'Items Subtotal:',
      shipping: 'Shipping Fee:',
      grandTotal: 'Grand Total:',
      moms12: 'VAT 12% (Food):',
      moms25: 'VAT 25% (Goods/Shipping):',
      totalMoms: 'Total VAT Included:',
    },
  }[locale]

  const totalCharged = order.pricing.capturedTotalMinor ?? order.pricing.grandTotalMinor
  const tax = order.pricing.taxSplit

  return `
    <div style="border-top: 2px solid #111827; padding-top: 14px; font-size: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; text-align: ${align}; color: #4b5563;">${labels.subtotal}</td>
          <td style="padding: 4px 0; text-align: ${oppAlign}; font-family: monospace;">${formatMoney(order.pricing.itemsTotalMinor, order.currency)}</td>
        </tr>
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
          <tr>
            <td style="text-align: ${align};">${labels.moms12}</td>
            <td style="text-align: ${oppAlign}; font-family: monospace;">${formatMoney(tax?.moms12?.momsAmountMinor || 0, order.currency)}</td>
          </tr>
          <tr>
            <td style="text-align: ${align};">${labels.moms25}</td>
            <td style="text-align: ${oppAlign}; font-family: monospace;">${formatMoney(tax?.moms25?.momsAmountMinor || 0, order.currency)}</td>
          </tr>
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
  const receiptUrl = `${process.env.BASE_URL || 'https://ibrahim-alzoubi.se'}/order/confirmation/${order._id}`

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

function generatePackedHtml(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const isPickup = order.customer.fulfillmentMethod === 'PICKUP'

  const copy = {
    ar: {
      heading: isPickup ? 'طلبك جاهز للاستلام!' : 'تم تجهيز طلبك بنجاح!',
      greeting: `مرحباً ${order.customer.fullName}،`,
      body: isPickup
        ? `يسعدنا إبلاغك بأن طلبك رقم <strong>${order.orderReference}</strong> أصبح جاهزاً للاستلام من المتجر في العنوان التالي: Storgatan 12, Halmstad.`
        : `لقد انتهينا من تجهيز وتغليف طلبك رقم <strong>${order.orderReference}</strong>. الطرد جاهز الآن وفي انتظار تسليمه لشركة الشحن (PostNord). سنرسل لك رسالة أخرى برابط التتبع بمجرد خروج الشحنة.`,
      tableTitle: 'محتويات الشحنة المجهزة:',
    },
    sv: {
      heading: isPickup ? 'Din order är redo att hämtas!' : 'Din order är färdigpackad!',
      greeting: `Hej ${order.customer.fullName},`,
      body: isPickup
        ? `Din order <strong>${order.orderReference}</strong> är nu färdigpackad och kan hämtas i butiken på Storgatan 12, Halmstad.`
        : `Vi har nu packat din order <strong>${order.orderReference}</strong>. Paketet inväntar upphämtning av PostNord. Vi meddelar dig med spårningslänk så snart transportören har hämtat paketet.`,
      tableTitle: 'Packade artiklar:',
    },
    en: {
      heading: isPickup ? 'Your order is ready for pickup!' : 'Your order is packed!',
      greeting: `Hello ${order.customer.fullName},`,
      body: isPickup
        ? `Your order <strong>${order.orderReference}</strong> is packed and ready for pickup at our store on Storgatan 12, Halmstad.`
        : `We have packed your order <strong>${order.orderReference}</strong>. It is now awaiting courier collection by PostNord. We will notify you with tracking details as soon as it is dispatched.`,
      tableTitle: 'Packed items:',
    },
  }[locale]

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: #0284c7; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">${copy.heading}</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px;">${copy.greeting}</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">${copy.body}</p>

        <h3 style="font-size: 14px; margin-top: 24px; margin-bottom: 0;">${copy.tableTitle}</h3>
        ${renderItemsTable(order, locale)}
      </div>
    </div>
  `
}

function generateDispatchedReceiptHtml(
  order: IOrder,
  trackingCode: string | undefined,
  carrier: string,
  locale: EmailLocale
): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const trackingUrl = trackingCode
    ? `https://www.postnord.se/vara-verktyg/spara-brev-paket-och-pall?shipmentId=${trackingCode}`
    : '#'
  const receiptUrl = `${process.env.BASE_URL || 'https://ibrahim-alzoubi.se'}/order/confirmation/${order._id}`

  const copy = {
    ar: {
      heading: 'تم شحن طلبك - الفاتورة النهائية',
      greeting: `مرحباً ${order.customer.fullName}،`,
      intro: `يسرنا إبلاغك بأن طلبك رقم <strong>${order.orderReference}</strong> قد تم تسليمه لشركة الشحن (${carrier}) وهو الآن في طريقه إليك.`,
      settlementNotice: 'تم سحب المبلغ النهائي بنجاح من وسيلة الدفع الخاصة بك.',
      trackingBtn: 'تتبع الشحنة على PostNord',
      trackingCodeLabel: 'رقم التتبع (Kolli-ID):',
      receiptBtn: 'عرض الفاتورة الضريبية الكاملة',
      addressTitle: 'عنوان التسليم:',
    },
    sv: {
      heading: 'Din order har skickats - Slutgiltigt kvitto',
      greeting: `Hej ${order.customer.fullName},`,
      intro: `Ditt paket för order <strong>${order.orderReference}</strong> har lämnats över till ${carrier} och är nu på väg till dig.`,
      settlementNotice: 'Det slutgiltiga beloppet har nu dragits från ditt betalkort.',
      trackingBtn: 'Spåra paketet hos PostNord',
      trackingCodeLabel: 'Kolli-ID / Försändelse-ID:',
      receiptBtn: 'Öppna fullständigt kvitto',
      addressTitle: 'Leveransadress:',
    },
    en: {
      heading: 'Your order has been dispatched - Final Receipt',
      greeting: `Hello ${order.customer.fullName},`,
      intro: `Your package for order <strong>${order.orderReference}</strong> has been handed over to ${carrier} and is on its way.`,
      settlementNotice: 'The final fulfilled amount has now been captured from your payment method.',
      trackingBtn: 'Track Package on PostNord',
      trackingCodeLabel: 'Tracking Number (Kolli-ID):',
      receiptBtn: 'Open Complete Tax Receipt',
      addressTitle: 'Delivery Address:',
    },
  }[locale]

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