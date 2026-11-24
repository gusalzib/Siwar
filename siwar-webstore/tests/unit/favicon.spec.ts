import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Browser Tab Favicon & App Icons Configuration', () => {
  const publicDir = path.resolve(__dirname, '../../public')
  const nuxtConfigPath = path.resolve(__dirname, '../../nuxt.config.ts')

  it('ensures all essential favicon and app icon assets exist in /public', () => {
    const requiredFiles = [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'android-chrome-192x192.png',
      'android-chrome-512x512.png',
      'site.webmanifest',
    ]

    for (const file of requiredFiles) {
      const filePath = path.join(publicDir, file)
      expect(fs.existsSync(filePath), `Expected ${file} to exist in /public`).toBe(true)
      const stats = fs.statSync(filePath)
      expect(stats.size).toBeGreaterThan(0)
    }
  })

  it('validates site.webmanifest structure and icon references', () => {
    const manifestPath = path.join(publicDir, 'site.webmanifest')
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestContent)

    expect(manifest.name).toBe('Siwar')
    expect(manifest.short_name).toBe('Siwar')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    for (const icon of manifest.icons) {
      const relativePath = icon.src.replace(/^\//, '')
      const fullPath = path.join(publicDir, relativePath)
      expect(fs.existsSync(fullPath), `Icon referenced in manifest (${icon.src}) must exist`).toBe(true)
    }
  })

  it('verifies nuxt.config.ts registers favicon and manifest links in app.head', () => {
    const configContent = fs.readFileSync(nuxtConfigPath, 'utf-8')

    expect(configContent).toContain("href: '/favicon.ico'")
    expect(configContent).toContain("href: '/favicon-32x32.png'")
    expect(configContent).toContain("href: '/favicon-16x16.png'")
    expect(configContent).toContain("href: '/apple-touch-icon.png'")
    expect(configContent).toContain("href: '/site.webmanifest'")
    expect(configContent).toContain("rel: 'icon'")
    expect(configContent).toContain("rel: 'apple-touch-icon'")
    expect(configContent).toContain("rel: 'manifest'")
  })
})

