// tests/unit/section2.admin-social.spec.ts
import { describe, it, expect } from 'vitest'
import {
  SOCIAL_PLATFORM_OPTIONS,
  VALID_SOCIAL_PLATFORMS,
  getSocialPlatformIcon,
  getSocialPlatformOption,
  isValidSocialUrl,
  type ISocialLink,
} from '~/utils/social'

describe('Section 2. Store Settings Admin - Social Media Links', () => {
  describe('1. Platform Configuration & Icon Mapping', () => {
    it('provides all 6 platform options with Iconify icons', () => {
      expect(SOCIAL_PLATFORM_OPTIONS).toHaveLength(6)

      expect(getSocialPlatformIcon('instagram')).toBe('skill-icons:instagram')
      expect(getSocialPlatformIcon('facebook')).toBe('logos:facebook')
      expect(getSocialPlatformIcon('tiktok')).toBe('logos:tiktok-icon')
      expect(getSocialPlatformIcon('whatsapp')).toBe('logos:whatsapp-icon')
      expect(getSocialPlatformIcon('youtube')).toBe('logos:youtube-icon')
      expect(getSocialPlatformIcon('x')).toBe('simple-icons:x')
    })

    it('returns default fallback icon for unknown platform', () => {
      expect(getSocialPlatformIcon('unknown' as any)).toBe('lucide:share-2')
    })

    it('returns platform details with placeholder', () => {
      const fb = getSocialPlatformOption('facebook')
      expect(fb?.label).toBe('Facebook')
      expect(fb?.placeholder).toContain('facebook.com')
    })
  })

  describe('2. Social Media URL Validation', () => {
    it('accepts valid https and http URLs', () => {
      expect(isValidSocialUrl('https://instagram.com/siwar.butik')).toBe(true)
      expect(isValidSocialUrl('https://facebook.com/siwar.butik')).toBe(true)
      expect(isValidSocialUrl('https://tiktok.com/@siwar.butik')).toBe(true)
      expect(isValidSocialUrl('https://wa.me/4635123456')).toBe(true)
      expect(isValidSocialUrl('http://siwar.se')).toBe(true)
    })

    it('rejects invalid or malformed URLs', () => {
      expect(isValidSocialUrl('')).toBe(false)
      expect(isValidSocialUrl('   ')).toBe(false)
      expect(isValidSocialUrl('not-a-url')).toBe(false)
      expect(isValidSocialUrl('instagram.com/without-protocol')).toBe(false)
      expect(isValidSocialUrl('ftp://example.com')).toBe(false)
      expect(isValidSocialUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('3. Social Media Link Management Operations', () => {
    it('supports adding, reordering, toggling, and removing social links', () => {
      const socialLinks: ISocialLink[] = []

      // Add Instagram
      socialLinks.push({
        platform: 'instagram',
        url: 'https://instagram.com/siwar',
        isActive: true,
        sortOrder: 0,
      })
      expect(socialLinks).toHaveLength(1)
      expect(socialLinks[0]?.isActive).toBe(true)

      // Add Facebook
      socialLinks.push({
        platform: 'facebook',
        url: 'https://facebook.com/siwar',
        isActive: true,
        sortOrder: 1,
      })
      expect(socialLinks).toHaveLength(2)

      // Toggle visibility
      if (socialLinks[1]) {
        socialLinks[1].isActive = false
      }
      
      expect(socialLinks[1]?.isActive).toBe(false)

      // Reorder (move Facebook up)
      const item = socialLinks.splice(1, 1)[0]
      if (item) {
        socialLinks.splice(0, 0, item)
      }
      
      socialLinks.forEach((l, idx) => {
        l.sortOrder = idx
      })
      expect(socialLinks[0]?.platform).toBe('facebook')
      expect(socialLinks[0]?.sortOrder).toBe(0)
      expect(socialLinks[1]?.platform).toBe('instagram')
      expect(socialLinks[1]?.sortOrder).toBe(1)

      // Remove
      socialLinks.splice(0, 1)
      expect(socialLinks).toHaveLength(1)
      expect(socialLinks[0]?.platform).toBe('instagram')
    })
  })

  describe('4. Storefront Footer & Social Shelf Display Rules', () => {
    it('filters out inactive links and links with missing/blank URLs', () => {
      const rawLinks: ISocialLink[] = [
        { platform: 'instagram', url: 'https://instagram.com/siwar', isActive: true, sortOrder: 2 },
        { platform: 'facebook', url: 'https://facebook.com/siwar', isActive: false, sortOrder: 0 },
        { platform: 'tiktok', url: '   ', isActive: true, sortOrder: 1 },
        { platform: 'whatsapp', url: 'https://wa.me/4635123456', isActive: true, sortOrder: 0 },
      ]

      const activeSorted = rawLinks
        .filter((l) => l && l.isActive !== false && typeof l.url === 'string' && l.url.trim().length > 0)
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      expect(activeSorted).toHaveLength(2)
      expect(activeSorted[0]?.platform).toBe('whatsapp')
      expect(activeSorted[1]?.platform).toBe('instagram')
    })

    it('determines whether footer has active social links to show', () => {
      const emptyStore: { socialLinks?: ISocialLink[] } = { socialLinks: [] }
      const hasActive1 = Array.isArray(emptyStore.socialLinks) &&
        emptyStore.socialLinks.some((l) => l && l.isActive !== false && typeof l.url === 'string' && l.url.trim().length > 0)
      expect(hasActive1).toBe(false)

      const activeStore: { socialLinks?: ISocialLink[] } = {
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com/siwar', isActive: true, sortOrder: 0 },
        ],
      }
      const hasActive2 = Array.isArray(activeStore.socialLinks) &&
        activeStore.socialLinks.some((l) => l && l.isActive !== false && typeof l.url === 'string' && l.url.trim().length > 0)
      expect(hasActive2).toBe(true)
    })
  })
})
