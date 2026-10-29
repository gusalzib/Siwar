// utils/social.ts

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'youtube' | 'x'

export interface ISocialLink {
  platform: SocialPlatform
  url: string
  isActive: boolean
  sortOrder: number
}

export interface ISocialPlatformOption {
  platform: SocialPlatform
  label: string
  icon: string
  placeholder: string
}

/**
 * In-memory dropdown list of supported social media platforms and icons.
 * Icons use Iconify format compatible with @nuxt/icon:
 * - logos:facebook
 * - skill-icons:instagram
 * - logos:tiktok-icon
 * - logos:whatsapp-icon
 * - logos:youtube-icon
 * - simple-icons:x
 */
export const SOCIAL_PLATFORM_OPTIONS: readonly ISocialPlatformOption[] = [
  {
    platform: 'instagram',
    label: 'Instagram',
    icon: 'skill-icons:instagram',
    placeholder: 'https://instagram.com/siwar.butik',
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    icon: 'logos:facebook',
    placeholder: 'https://facebook.com/siwar.butik',
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    icon: 'logos:tiktok-icon',
    placeholder: 'https://tiktok.com/@siwar.butik',
  },
  {
    platform: 'whatsapp',
    label: 'WhatsApp',
    icon: 'logos:whatsapp-icon',
    placeholder: 'https://wa.me/4635123456',
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    icon: 'logos:youtube-icon',
    placeholder: 'https://youtube.com/@siwar.butik',
  },
  {
    platform: 'x',
    label: 'X (Twitter)',
    icon: 'simple-icons:x',
    placeholder: 'https://x.com/siwar_butik',
  },
] as const

export const VALID_SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'youtube',
  'x',
] as const

export function getSocialPlatformOption(platform: string): ISocialPlatformOption | undefined {
  return SOCIAL_PLATFORM_OPTIONS.find((opt) => opt.platform === platform)
}

export function getSocialPlatformIcon(platform: string): string {
  const option = getSocialPlatformOption(platform)
  return option ? option.icon : 'lucide:share-2'
}

export function getSocialPlatformLabel(platform: string): string {
  const option = getSocialPlatformOption(platform)
  return option ? option.label : platform
}

export function isValidSocialUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
