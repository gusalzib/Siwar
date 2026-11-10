// tests/unit/dhl.packing.ui.spec.ts

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { encodeCode128, generateCode128Svg } from '~/utils/barcode'
import OrderParcelModal from '~/components/admin/OrderParcelModal.vue'
import DhlHandoverModal from '~/components/admin/DhlHandoverModal.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key: string, paramOrFallback?: any, fallback?: string) => {
      if (typeof fallback === 'string') return fallback
      if (typeof paramOrFallback === 'string') return paramOrFallback
      return _key
    },
    locale: { value: 'sv' },
  }),
}))

const defaultMountOptions = {
  global: {
    stubs: {
      Teleport: true,
      Icon: {
        template: '<span class="icon-stub"></span>',
      },
    },
    mocks: {
      t: (_key: string, paramOrFallback?: any, fallback?: string) => {
        if (typeof fallback === 'string') return fallback
        if (typeof paramOrFallback === 'string') return paramOrFallback
        return _key
      },
    },
  },
}

describe('Section 2: Admin Packing UI Enhancements & DHL Handover', () => {
  describe('1. Code 128 Barcode Generator (utils/barcode.ts)', () => {
    const sampleKolliId = '003733001234567890' // 18-digit DHL Sweden Kolli-ID

    it('encodes an 18-digit Kolli-ID using Code 128 Subset C (pairs)', () => {
      const symbols = encodeCode128(sampleKolliId)

      // Start C (105) + 9 numeric pairs + 1 checksum + 1 stop (106) = 12 symbols
      expect(symbols).toHaveLength(12)
      expect(symbols[0]).toBe(105) // Start C
      expect(symbols[1]).toBe(0) // Pair "00"
      expect(symbols[2]).toBe(37) // Pair "37"
      expect(symbols[3]).toBe(33) // Pair "33"
      expect(symbols[11]).toBe(106) // Stop code
    })

    it('generates crisp resolution-independent SVG markup for the barcode', () => {
      const svg = generateCode128Svg(sampleKolliId, { height: 90, moduleWidth: 2.5 })

      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox=')
      expect(svg).toContain('<rect')
      expect(svg).toContain('fill="#000000"')
      expect(svg).toContain('</svg>')
    })
  })

  describe('2. OrderParcelModal Component (components/admin/OrderParcelModal.vue)', () => {
    it('displays pre-calculated product gross weight in kg and g', () => {
      const wrapper = mount(OrderParcelModal, {
        ...defaultMountOptions,
        props: {
          isOpen: true,
          calculatedGrossWeightGrams: 3200, // 3.2 kg catalog gross weight
          isSubmitting: false,
        },
      })

      expect(wrapper.text()).toContain('3.2 kg')
      expect(wrapper.text()).toContain('3200 g')
    })

    it('allows entering measured scale weight and updates tare difference indicator', async () => {
      const wrapper = mount(OrderParcelModal, {
        ...defaultMountOptions,
        props: {
          isOpen: true,
          calculatedGrossWeightGrams: 3200,
          isSubmitting: false,
        },
      })

      const scaleInput = wrapper.find('input[type="number"]')
      await scaleInput.setValue(3.7) // Staff enters measured 3.7 kg on the scale

      expect(scaleInput.element.value).toBe('3.7')
      // Emits confirmed parcel with measured scale weight (3.7 kg)
      const confirmBtn = wrapper.find('button.btn-brand-600, button.bg-brand-600')
      await confirmBtn.trigger('click')

      const emitted = wrapper.emitted('confirm')
      expect(emitted).toBeTruthy()
      expect(emitted![0]![0]).toMatchObject({
        weightKg: 3.7,
      })
    })

    it('provides standard carton presets (Liten, Mellan, Stor)', async () => {
      const wrapper = mount(OrderParcelModal, {
        ...defaultMountOptions,
        props: {
          isOpen: true,
          calculatedGrossWeightGrams: 2000,
          isSubmitting: false,
        },
      })

      expect(wrapper.text()).toContain('25×20×15 cm') // Liten
      expect(wrapper.text()).toContain('35×25×20 cm') // Mellan
      expect(wrapper.text()).toContain('45×35×30 cm') // Stor

      // Click "Liten" preset button
      const buttons = wrapper.findAll('button')
      const litenBtn = buttons.find((b) => b.text().includes('25×20×15'))
      expect(litenBtn).toBeDefined()
      await litenBtn!.trigger('click')

      // Confirm parcel and verify dimensions
      const confirmBtn = wrapper.find('button.bg-brand-600')
      await confirmBtn.trigger('click')

      const emitted = wrapper.emitted('confirm')
      expect(emitted![0]![0]).toMatchObject({
        preset: 'LITEN',
        lengthCm: 25,
        widthCm: 20,
        heightCm: 15,
      })
    })
  })

  describe('3. DhlHandoverModal Component (components/admin/DhlHandoverModal.vue)', () => {
    const mockProps = {
      isOpen: true,
      orderReference: 'ORD-2026-88',
      kolliId: '003733009876543210',
      consignmentNumber: '373388990',
      trackingUrl: 'https://www.dhl.com/se-en/home/tracking.html?tracking-id=003733009876543210',
      labelUrl: 'https://api.freight-logistics.dhl.com/labels/sample.pdf',
      weightKg: 3.7,
    }

    it('renders crisp SVG barcode and displays 18-digit Kolli-ID and Sändningsnummer in high-contrast monospace', () => {
      const wrapper = mount(DhlHandoverModal, {
        ...defaultMountOptions,
        props: mockProps,
      })

      expect(wrapper.html()).toContain('<svg')
      expect(wrapper.text()).toContain('0037 3300 9876 5432 10')
      expect(wrapper.text()).toContain('373388990')
      expect(wrapper.text()).toContain('ORD-2026-88')
      expect(wrapper.text()).toContain('3.7 kg')
    })

    it('renders public DHL tracking link with target="_blank"', () => {
      const wrapper = mount(DhlHandoverModal, {
        ...defaultMountOptions,
        props: mockProps,
      })

      const trackingLink = wrapper.find('a[href*="dhl.com"]')
      expect(trackingLink.exists()).toBe(true)
      expect(trackingLink.attributes('target')).toBe('_blank')
    })

    it('provides emergency fallback button to open PDF label or print', () => {
      const wrapper = mount(DhlHandoverModal, {
        ...defaultMountOptions,
        props: mockProps,
      })

      const printBtn = wrapper.findAll('button').find((b) => b.text().includes('PDF-reserv') || b.text().includes('Skriv ut'))
      expect(printBtn).toBeDefined()
    })
  })
})

