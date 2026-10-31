// server/api/contact.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { mailService } from '~/server/services/mail.service'

export interface IContactFormBody {
  fullName: string
  email: string
  phone?: string
  orderReference?: string
  category?: 'general' | 'order' | 'product' | 'feedback'
  message: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<IContactFormBody>(event)

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Begäran saknar innehåll.',
    })
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const orderReference = typeof body.orderReference === 'string' ? body.orderReference.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const category = body.category || 'general'

  // Validation
  if (fullName.length < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vänligen ange ett giltigt namn (minst 2 tecken).',
    })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vänligen ange en giltig e-postadress.',
    })
  }

  if (message.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Meddelandet är för kort (minst 10 tecken krävs).',
    })
  }

  // Dispatch email to the store email (STORE_EMAIL) via mailService
  try {
    await mailService.sendContactMessage({
      fullName,
      email,
      phone: phone || undefined,
      orderReference: orderReference || undefined,
      category,
      message,
    })
  } catch (err: any) {
    console.error('[Contact Form] Failed to dispatch email notification:', err)
  }

  // Log contact inquiry for customer support
  console.info(`[Contact Form] New submission from ${fullName} <${email}> [Category: ${category}] [Order: ${orderReference || 'N/A'}]`)

  return {
    success: true,
    message: 'Tack för ditt meddelande! Vi återkommer så snart vi kan, normalt inom 24 timmar.',
    referenceId: `MSG-${Date.now().toString(36).toUpperCase()}`,
  }
})
