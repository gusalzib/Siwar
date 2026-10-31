// tests/unit/section4.informational-social.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Section 4. Informational Content Pages & Social Shelf', () => {
  const aboutPath = path.resolve(__dirname, '../../pages/about.vue')
  const contactPath = path.resolve(__dirname, '../../pages/contact.vue')
  const aboutContent = fs.readFileSync(aboutPath, 'utf-8')
  const contactContent = fs.readFileSync(contactPath, 'utf-8')

  describe('1. About Page (/pages/about.vue)', () => {
    it('contains narrative detailing store heritage and Mediterranean specialties', () => {
      expect(aboutContent).toContain("t('aboutPage.badge'")
      expect(aboutContent).toContain("t('aboutPage.title'")
      expect(aboutContent).toContain("t('aboutPage.subtitle'")
      expect(aboutContent).toContain("t('aboutPage.story.p1'")
      expect(aboutContent).toContain("t('aboutPage.story.p2'")
    })

    it('displays 4 photo collage items with interactive expansion modal', () => {
      expect(aboutContent).toContain('storefront')
      expect(aboutContent).toContain('spices')
      expect(aboutContent).toContain('sweets')
      expect(aboutContent).toContain('delicacies')
      expect(aboutContent).toContain('openPhoto')
      expect(aboutContent).toContain('photoModalRef')
      expect(aboutContent).toContain('<dialog ref="photoModalRef" class="modal"')
      expect(aboutContent).toContain('class="modal-backdrop')
    })

    it('embeds SocialMediaShelf component prominently on the about page', () => {
      expect(aboutContent).toContain('<SocialMediaShelf')
      expect(aboutContent).toContain('t(\'aboutPage.social.title\'')
    })

    it('adheres to non-glassmorphism brand styling', () => {
      expect(aboutContent).not.toContain('backdrop-blur-md')
      expect(aboutContent).not.toContain('backdrop-blur-lg')
    })
  })

  describe('2. Contact Page (/pages/contact.vue)', () => {
    it('contains contact cards for phone, email, address, and hours', () => {
      expect(contactContent).toContain("t('contactPage.cards.phoneTitle'")
      expect(contactContent).toContain("t('contactPage.cards.emailTitle'")
      expect(contactContent).toContain("t('contactPage.cards.addressTitle'")
      expect(contactContent).toContain("t('contactPage.cards.hoursTitle'")
      expect(contactContent).toContain('tel:')
      expect(contactContent).toContain('mailto:')
      expect(contactContent).toContain('mapsUrl')
    })

    it('embeds SocialMediaShelf component prominently on the contact page', () => {
      expect(contactContent).toContain('<SocialMediaShelf')
      expect(contactContent).toContain("t('contactPage.social.title'")
    })

    it('includes a functional contact form with client validation', () => {
      expect(contactContent).toContain('fullName')
      expect(contactContent).toContain('email')
      expect(contactContent).toContain('phone')
      expect(contactContent).toContain('orderReference')
      expect(contactContent).toContain('message')
      expect(contactContent).toContain('validateForm')
      expect(contactContent).toContain('handleSubmit')
      expect(contactContent).toContain('/api/contact')
    })

    it('includes interactive Google Maps embed showcase', () => {
      expect(contactContent).toContain('<iframe')
      expect(contactContent).toContain('mapsEmbedUrl')
    })

    it('contains a dedicated WhatsApp contact card with dynamic store settings integration', () => {
      expect(contactContent).toContain("t('contactPage.cards.whatsappTitle'")
      expect(contactContent).toContain('whatsappUrl')
      expect(contactContent).toContain('logos:whatsapp-icon')
      expect(contactContent).toContain('whatsAppPhoneDisplay')
      expect(contactContent).toContain('desktopWhatsAppPrompt')
      expect(contactContent).toContain("t('contactPage.cards.whatsappFallbackBannerTitle'")
    })

    it('sanitizes phone numbers and generates platform-aware WhatsApp links', async () => {
      const { sanitizeWhatsAppNumber, getWhatsAppUrl } = await import('../../utils/social')
      
      // Sanitizing tests
      expect(sanitizeWhatsAppNumber('+46 35 123 456')).toBe('4635123456')
      expect(sanitizeWhatsAppNumber('070 123 45 67')).toBe('46701234567')
      expect(sanitizeWhatsAppNumber('https://wa.me/46701234567')).toBe('46701234567')
      expect(sanitizeWhatsAppNumber('https://web.whatsapp.com/send?phone=46701234567')).toBe('46701234567')
      
      // Mobile platform-aware URL: native deep link
      const mobileUrl = getWhatsAppUrl('+46 35 123 456', true)
      expect(mobileUrl).toBe('whatsapp://send?phone=4635123456')
      
      // Desktop platform-aware URL: WhatsApp Web
      const desktopUrl = getWhatsAppUrl('+46 35 123 456', false)
      expect(desktopUrl).toBe('https://web.whatsapp.com/send?phone=4635123456')
    })

    it('contains complete WhatsApp localization in sv.json, en.json, and ar.json', () => {
      const sv = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/sv.json'), 'utf-8'))
      const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8'))
      const ar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8'))

      for (const loc of [sv, en, ar]) {
        expect(loc.contactPage.cards.whatsappTitle).toBeDefined()
        expect(loc.contactPage.cards.whatsappDesc).toBeDefined()
        expect(loc.contactPage.cards.whatsappOpenApp).toBeDefined()
        expect(loc.contactPage.cards.whatsappOpenWeb).toBeDefined()
        expect(loc.contactPage.cards.whatsappFallbackNotice).toBeDefined()
        expect(loc.contactPage.cards.whatsappFallbackBannerTitle).toBeDefined()
        expect(loc.contactPage.cards.whatsappFallbackBannerDesc).toBeDefined()
        expect(loc.contactPage.cards.whatsappFallbackBannerAction).toBeDefined()
      }
    })
  })

  describe('3. Contact Form Submission API (server/api/contact.post.ts)', () => {
    const contactApiRaw = fs.readFileSync(path.resolve(__dirname, '../../server/api/contact.post.ts'), 'utf-8')

    it('implements validation for fullName, email, and message', () => {
      expect(contactApiRaw).toContain('fullName.length < 2')
      expect(contactApiRaw).toContain('emailRegex.test(email)')
      expect(contactApiRaw).toContain('message.length < 10')
      expect(contactApiRaw).toContain('referenceId')
    })

    it('dispatches contact inquiry email to store email via mailService', () => {
      expect(contactApiRaw).toContain('mailService.sendContactMessage')
    })

    it('executes mailService.sendContactMessage in mock mode without throwing', async () => {
      const { mailService } = await import('../../server/services/mail.service')
      const result = await mailService.sendContactMessage({
        fullName: 'Test Customer',
        email: 'customer@example.com',
        phone: '0701234567',
        orderReference: 'ORD-TEST-1',
        category: 'order',
        message: 'Hello, this is a test inquiry about my order.',
      })
      expect(result).toBeDefined()
      const messageId = 'id' in result ? result.id : result.data?.id
      expect(messageId).toBeDefined()
    })
  })

  describe('4. Navigation & Footer Integration', () => {
    const navContent = fs.readFileSync(path.resolve(__dirname, '../../layouts/default.vue'), 'utf-8')
    const footerContent = fs.readFileSync(path.resolve(__dirname, '../../components/StoreFooter.vue'), 'utf-8')

    it('exposes /about and /contact in navbar links', () => {
      expect(navContent).toContain("localePath('/about')")
      expect(navContent).toContain("localePath('/contact')")
    })

    it('exposes /about and /contact in footer links', () => {
      expect(footerContent).toContain("localePath('/about')")
      expect(footerContent).toContain("localePath('/contact')")
    })
  })
})
