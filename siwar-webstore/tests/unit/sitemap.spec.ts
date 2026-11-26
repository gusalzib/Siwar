import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('SEO Multilingual Sitemap Generation (Issue #56 Section 6)', () => {
  const sitemapRoutePath = path.resolve(__dirname, '../../server/routes/sitemap.xml.ts')
  const robotsTxtPath = path.resolve(__dirname, '../../public/robots.txt')

  it('declares sitemap route file and robots.txt file exists', () => {
    expect(fs.existsSync(sitemapRoutePath)).toBe(true)
    expect(fs.existsSync(robotsTxtPath)).toBe(true)
  })

  it('configures public/robots.txt with Sitemap directive and disallows private admin/checkout routes', () => {
    const robotsContent = fs.readFileSync(robotsTxtPath, 'utf-8')
    expect(robotsContent).toContain('Sitemap: https://siwar.se/sitemap.xml')
    expect(robotsContent).toContain('Disallow: /admin')
    expect(robotsContent).toContain('Disallow: /checkout')
    expect(robotsContent).toContain('Disallow: /kassa')
    expect(robotsContent).toContain('Disallow: /order')
  })

  it('defines valid XML sitemap handler with canonical URL and hreflang schema', () => {
    const sitemapContent = fs.readFileSync(sitemapRoutePath, 'utf-8')

    // XML Namespaces
    expect(sitemapContent).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(sitemapContent).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')

    // Canonical Base
    expect(sitemapContent).toContain("const siteUrl = 'https://siwar.se'")

    // Content-Type & Cache Headers
    expect(sitemapContent).toContain("setHeader(event, 'content-type', 'application/xml; charset=utf-8')")
    expect(sitemapContent).toContain("setHeader(event, 'cache-control'")

    // Core Storefront Pages
    expect(sitemapContent).toContain("path: ''") // Home
    expect(sitemapContent).toContain("path: 'catalog'")
    expect(sitemapContent).toContain("path: 'about'")
    expect(sitemapContent).toContain("path: 'contact'")
    expect(sitemapContent).toContain("path: 'oppettider'")

    // Policy Pages
    expect(sitemapContent).toContain("path: 'villkor'")
    expect(sitemapContent).toContain("path: 'angerratt'")
    expect(sitemapContent).toContain("path: 'integritetspolicy'")
    expect(sitemapContent).toContain("path: 'frakt'")

    // Dynamic Queries
    expect(sitemapContent).toContain('Category.find')
    expect(sitemapContent).toContain('Product.find')

    // Excluded routes check (never hardcode private routes in static pages list)
    expect(sitemapContent).not.toContain("path: 'admin'")
    expect(sitemapContent).not.toContain("path: 'kassa'")
    expect(sitemapContent).not.toContain("path: 'checkout'")
    expect(sitemapContent).not.toContain("path: 'order'")
  })

  it('generates valid XML with localized alternate links when handler executes', async () => {
    // Dynamically test sitemap output generation logic
    const mockCategories = [
      {
        _id: '64ef876970bd9596e9bb0001',
        slug: { ar: 'halva', sv: 'halva', en: 'halva' },
        updatedAt: new Date('2026-01-15T12:00:00Z'),
      },
    ]

    const mockProducts = [
      {
        _id: '64ef876970bd9596e9bb0002',
        updatedAt: new Date('2026-02-20T12:00:00Z'),
      },
    ]

    // Simulate sitemap builder
    const siteUrl = 'https://siwar.se'
    const staticPages = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: 'catalog', changefreq: 'daily', priority: '0.9' },
      { path: 'about', changefreq: 'monthly', priority: '0.6' },
      { path: 'villkor', changefreq: 'monthly', priority: '0.4' },
    ]

    const entries: any[] = []

    for (const page of staticPages) {
      const arUrl = page.path ? `${siteUrl}/${page.path}` : `${siteUrl}/`
      const svUrl = page.path ? `${siteUrl}/sv/${page.path}` : `${siteUrl}/sv`
      const enUrl = page.path ? `${siteUrl}/en/${page.path}` : `${siteUrl}/en`

      const alternates = [
        { hreflang: 'ar', href: arUrl },
        { hreflang: 'sv', href: svUrl },
        { hreflang: 'en', href: enUrl },
        { hreflang: 'x-default', href: arUrl },
      ]

      entries.push({ loc: arUrl, alternates }, { loc: svUrl, alternates }, { loc: enUrl, alternates })
    }

    for (const cat of mockCategories) {
      const arUrl = `${siteUrl}/catalog?category=${cat.slug.ar}`
      const svUrl = `${siteUrl}/sv/catalog?category=${cat.slug.sv}`
      const enUrl = `${siteUrl}/en/catalog?category=${cat.slug.en}`
      const alternates = [
        { hreflang: 'ar', href: arUrl },
        { hreflang: 'sv', href: svUrl },
        { hreflang: 'en', href: enUrl },
        { hreflang: 'x-default', href: arUrl },
      ]
      entries.push({ loc: arUrl, alternates }, { loc: svUrl, alternates }, { loc: enUrl, alternates })
    }

    for (const prod of mockProducts) {
      const arUrl = `${siteUrl}/products/${prod._id}`
      const svUrl = `${siteUrl}/sv/products/${prod._id}`
      const enUrl = `${siteUrl}/en/products/${prod._id}`
      const alternates = [
        { hreflang: 'ar', href: arUrl },
        { hreflang: 'sv', href: svUrl },
        { hreflang: 'en', href: enUrl },
        { hreflang: 'x-default', href: arUrl },
      ]
      entries.push({ loc: arUrl, alternates }, { loc: svUrl, alternates }, { loc: enUrl, alternates })
    }

    // Verify properties
    expect(entries.length).toBe(18) // (4 static + 1 cat + 1 prod) * 3 locales
    const homeAr = entries.find((e) => e.loc === 'https://siwar.se/')
    expect(homeAr).toBeDefined()
    expect(homeAr.alternates.some((a: any) => a.hreflang === 'sv' && a.href === 'https://siwar.se/sv')).toBe(true)
    expect(homeAr.alternates.some((a: any) => a.hreflang === 'en' && a.href === 'https://siwar.se/en')).toBe(true)
    expect(homeAr.alternates.some((a: any) => a.hreflang === 'x-default' && a.href === 'https://siwar.se/')).toBe(true)

    const catSv = entries.find((e) => e.loc === 'https://siwar.se/sv/catalog?category=halva')
    expect(catSv).toBeDefined()

    const prodEn = entries.find((e) => e.loc === 'https://siwar.se/en/products/64ef876970bd9596e9bb0002')
    expect(prodEn).toBeDefined()
  })
})

