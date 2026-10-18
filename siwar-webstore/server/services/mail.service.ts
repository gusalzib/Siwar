// server/services/mail.service.ts
import { Resend } from 'resend'
import type { IOrder } from '~/server/models/Order'

export type EmailLocale = 'ar' | 'sv' | 'en'

interface SendDispatchParams {
  order: IOrder
  trackingCode?: string
  carrier?: string
}

function getResendClient() {
  const config = useRuntimeConfig()
  const apiKey = (config.resendApiKey as string | undefined) || process.env.RESEND_API_KEY || process.env.MAIL_API_KEY
  if (!apiKey) {
    console.warn('[MailService] RESEND_API_KEY is not configured. Email will be logged to console.')
    return null
  }
  return new Resend(apiKey)
}

function getFromAddress(): string {
  const config = useRuntimeConfig()
  return (config.mailFrom as string | undefined) || process.env.MAIL_FROM || process.env.MAIL_FROM_ADDRESS || 'Siwar Webstore <order@siwar.se>'
}

function formatMoney(amountMinor: number, currency = 'SEK'): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`
}

export const mailService = {
  /**
   * 1. Order Confirmation (Triggered upon AUTHORIZED / PAID)
   */
  async sendOrderConfirmation(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getFromAddress()
    const to = order.customer.email

    const subjects: Record<EmailLocale, string> = {
      ar: `تأكيد الطلب #${order.orderReference} - متجر سوار`,
      sv: `Orderbekräftelse #${order.orderReference} - Siwar`,
      en: `Order Confirmation #${order.orderReference} - Siwar Store`,
    }

    const html = generateConfirmationHtml(order, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subjects[locale]}`)
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
   * 2. Ready for In-Store Pickup (Triggered when Pickup order is PACKED)
   */
  async sendReadyForPickup(order: IOrder, locale: EmailLocale = 'sv') {
    const resend = getResendClient()
    const from = getFromAddress()
    const to = order.customer.email

    const subjects: Record<EmailLocale, string> = {
      ar: `طلبك #${order.orderReference} جاهز للاستلام من المتجر`,
      sv: `Din order #${order.orderReference} är redo att hämtas!`,
      en: `Your order #${order.orderReference} is ready for pickup!`,
    }

    const html = generatePickupReadyHtml(order, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: PICKUP] To: ${to} | Subject: ${subjects[locale]}`)
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
   * 3. Carrier Dispatch Alert (Triggered when Delivery order is DISPATCHED)
   */
  async sendOrderDispatched(params: SendDispatchParams, locale: EmailLocale = 'sv') {
    const { order, trackingCode, carrier = 'PostNord' } = params
    const resend = getResendClient()
    const from = getFromAddress()
    const to = order.customer.email

    const subjects: Record<EmailLocale, string> = {
      ar: `تم شحن طلبك #${order.orderReference} عبر ${carrier}`,
      sv: `Din order #${order.orderReference} har skickats med ${carrier}`,
      en: `Your order #${order.orderReference} has been dispatched via ${carrier}`,
    }

    const html = generateDispatchedHtml(order, trackingCode, carrier, locale)

    if (!resend) {
      console.log(`[MOCK EMAIL: DISPATCH] To: ${to} | Kolli-ID: ${trackingCode}`)
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

// ----------------- HTML Template Generators -----------------

function generateConfirmationHtml(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'
  const oppAlign = isRtl ? 'left' : 'right'

  const labels = {
    ar: {
      heading: 'شكراً لطلبك من متجر سوار!',
      intro: `مرحباً ${order.customer.fullName}، لقد استلمنا طلبك بنجاح. سنقوم بإشعارك فور تجهيزه.`,
      orderRef: 'رقم الطلب:',
      date: 'تاريخ الطلب:',
      fulfillment: 'طريقة الاستلام:',
      pickup: 'استلام من المتجر',
      delivery: 'توصيل عبر الطرود',
      items: 'المنتجات',
      qty: 'الكمية',
      price: 'السعر',
      shipping: 'الشحن',
      moms12: 'ضريبة 12% (أغذية)',
      moms25: 'ضريبة 25% (بضائع/شحن)',
      totalMoms: 'إجمالي ضريبة القيمة المضافة',
      grandTotal: 'المجموع الكلي',
      viewReceipt: 'عرض الفاتورة الإلكترونية',
    },
    sv: {
      heading: 'Tack för din beställning hos Siwar!',
      intro: `Hej ${order.customer.fullName}, vi har tagit emot din beställning. Vi meddelar dig när den hanteras.`,
      orderRef: 'Ordernummer:',
      date: 'Orderdatum:',
      fulfillment: 'Leveranssätt:',
      pickup: 'Hämta i butik',
      delivery: 'Postpaket',
      items: 'Artiklar',
      qty: 'Antal',
      price: 'Pris',
      shipping: 'Frakt',
      moms12: 'Moms 12% (livsmedel)',
      moms25: 'Moms 25% (övrigt/frakt)',
      totalMoms: 'Varav moms totalt',
      grandTotal: 'Totalt belopp',
      viewReceipt: 'Visa kvitto online',
    },
    en: {
      heading: 'Thank you for your order at Siwar!',
      intro: `Hello ${order.customer.fullName}, we have received your order. We will notify you once it is ready.`,
      orderRef: 'Order Reference:',
      date: 'Order Date:',
      fulfillment: 'Fulfillment:',
      pickup: 'In-Store Pickup',
      delivery: 'Parcel Delivery',
      items: 'Items',
      qty: 'Qty',
      price: 'Price',
      shipping: 'Shipping',
      moms12: 'VAT 12% (Groceries)',
      moms25: 'VAT 25% (Goods/Shipping)',
      totalMoms: 'Total VAT included',
      grandTotal: 'Grand Total',
      viewReceipt: 'View Receipt Online',
    },
  }[locale]

  const itemsRows = order.items
    .map((item) => {
      const name = item.name[locale] || item.name.sv || item.name.en || item.name.ar
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: ${align};">
            <strong>${name}</strong>${item.sku ? `<br><small style="color:#777">SKU: ${item.sku}</small>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: ${oppAlign};">
            ${formatMoney(item.unitPriceMinor * item.quantity, order.currency)}
          </td>
        </tr>
      `
    })
    .join('')

  const baseUrl = process.env.BASE_URL || 'https://ibrahim-alzoubi.se'
  const receiptUrl = `${baseUrl}/order/confirmation/${order._id}`

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222; line-height: 1.5;">
      <div style="background-color: #15803d; color: #fff; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">${labels.heading}</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${labels.intro}</p>
        <p>
          <strong>${labels.orderRef}</strong> ${order.orderReference}<br>
          <strong>${labels.date}</strong> ${new Date(order.createdAt).toLocaleDateString()}<br>
          <strong>${labels.fulfillment}</strong> ${order.customer.fulfillmentMethod === 'PICKUP' ? labels.pickup : labels.delivery}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; text-align: ${align};">${labels.items}</th>
              <th style="padding: 8px; text-align: center;">${labels.qty}</th>
              <th style="padding: 8px; text-align: ${oppAlign};">${labels.price}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="margin-top: 20px; padding-top: 12px; border-top: 2px solid #333;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>${labels.shipping}:</span>
            <span>${formatMoney(order.pricing.shippingFeeMinor, order.currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-bottom: 12px;">
            <span>${labels.grandTotal}:</span>
            <span>${formatMoney(order.pricing.grandTotalMinor, order.currency)}</span>
          </div>
          <div style="font-size: 12px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px;">
            <div>${labels.moms12}: ${formatMoney(order.pricing.taxSplit?.moms12?.momsAmountMinor || 0, order.currency)}</div>
            <div>${labels.moms25}: ${formatMoney(order.pricing.taxSplit?.moms25?.momsAmountMinor || 0, order.currency)}</div>
            <strong>${labels.totalMoms}: ${formatMoney(order.pricing.taxSplit?.totalMomsMinor || 0, order.currency)}</strong>
          </div>
        </div>

        <div style="margin-top: 28px; text-align: center;">
          <a href="${receiptUrl}" style="background-color: #15803d; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            ${labels.viewReceipt}
          </a>
        </div>
      </div>
    </div>
  `
}

function generatePickupReadyHtml(order: IOrder, locale: EmailLocale): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const labels = {
    ar: {
      title: 'طلبك جاهز للاستلام!',
      msg: `مرحباً ${order.customer.fullName}، لقد انتهينا من تجهيز طلبك رقم <strong>${order.orderReference}</strong> وهو جاهز الآن للاستلام من المتجر.`,
      addressTitle: 'عنوان المتجر ومواعيد العمل:',
      storeInfo: 'متجر سوار - Storgatan 12, Halmstad<br>ساعات العمل: الإثنين - السبت: 10:00 - 19:00 | الأحد: 11:00 - 17:00',
      instruction: 'يرجى إبراز رقم الطلب أو هذه الرسالة لموظف المتجر عند الاستلام.',
    },
    sv: {
      title: 'Din order är redo att hämtas!',
      msg: `Hej ${order.customer.fullName}, din beställning <strong>${order.orderReference}</strong> är nu färdigpackad och kan hämtas i butiken.`,
      addressTitle: 'Butiksadress & Öppettider:',
      storeInfo: 'Siwar Butik - Storgatan 12, Halmstad<br>Öppettider: Mån–Lör: 10:00–19:00 | Sön: 11:00–17:00',
      instruction: 'Visa upp ditt ordernummer eller detta mejl för personalen vid utlämning.',
    },
    en: {
      title: 'Your order is ready for pickup!',
      msg: `Hello ${order.customer.fullName}, your order <strong>${order.orderReference}</strong> has been packed and is ready for pickup at our store.`,
      addressTitle: 'Store Address & Hours:',
      storeInfo: 'Siwar Store - Storgatan 12, Halmstad<br>Opening Hours: Mon–Sat: 10:00–19:00 | Sun: 11:00–17:00',
      instruction: 'Please present your order reference or this email to the staff upon collection.',
    },
  }[locale]

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
      <div style="background-color: #0284c7; color: #fff; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">${labels.title}</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${labels.msg}</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0369a1;">${labels.addressTitle}</h3>
          <p style="margin-bottom: 0;">${labels.storeInfo}</p>
        </div>
        <p style="font-size: 14px; color: #555;">${labels.instruction}</p>
      </div>
    </div>
  `
}

function generateDispatchedHtml(order: IOrder, trackingCode?: string, carrier = 'PostNord', locale: EmailLocale = 'sv'): string {
  const isRtl = locale === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const trackingUrl = trackingCode
    ? `https://www.postnord.se/vara-verktyg/spara-brev-paket-och-pall?shipmentId=${trackingCode}`
    : '#'

  const labels = {
    ar: {
      title: 'تم شحن طلبك!',
      msg: `مرحباً ${order.customer.fullName}، لقد تم تسليم شحنتك رقم <strong>${order.orderReference}</strong> إلى شركة الشحن (${carrier}).`,
      trackingTitle: 'معلومات التتبع (Kolli-ID):',
      trackBtn: 'تتبع الشحنة مباشرة',
      destination: `عنوان التسليم: ${order.customer.address?.street}, ${order.customer.address?.postalCode} ${order.customer.address?.city}`,
    },
    sv: {
      title: 'Din order har skickats!',
      msg: `Hej ${order.customer.fullName}, ditt paket för order <strong>${order.orderReference}</strong> har nu lämnats över till ${carrier}.`,
      trackingTitle: 'Försändelse-ID (Kolli-ID):',
      trackBtn: 'Spåra ditt paket hos PostNord',
      destination: `Leveransadress: ${order.customer.address?.street}, ${order.customer.address?.postalCode} ${order.customer.address?.city}`,
    },
    en: {
      title: 'Your order is on its way!',
      msg: `Hello ${order.customer.fullName}, your package for order <strong>${order.orderReference}</strong> has been handed over to ${carrier}.`,
      trackingTitle: 'Tracking Number (Kolli-ID):',
      trackBtn: 'Track Package on PostNord',
      destination: `Delivery Address: ${order.customer.address?.street}, ${order.customer.address?.postalCode} ${order.customer.address?.city}`,
    },
  }[locale]

  return `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
      <div style="background-color: #15803d; color: #fff; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">${labels.title}</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${labels.msg}</p>
        <p style="font-size: 13px; color: #555;">${labels.destination}</p>
        ${
          trackingCode
            ? `
          <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 14px;">${labels.trackingTitle}</p>
            <p style="font-family: monospace; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">${trackingCode}</p>
            <a href="${trackingUrl}" style="background-color: #0284c7; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; display: inline-block;">
              ${labels.trackBtn}
            </a>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `
}