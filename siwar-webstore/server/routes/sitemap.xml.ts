// server/routes/sitemap.xml.ts
import { Product } from '~/server/models/Product'
import { Category } from '~/server/models/Category'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface AlternateLink {
  hreflang: string
  href: string
}

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: string
  alternates: AlternateLink[]
}

export default defineEventHandler(async (event) => {
  const siteUrl = 'https://siwar.se'
  const today = new Date().toISOString().split('T')[0]

  // 1. Static Storefront & Policy Pages
  const staticPages = [
    { path: '', changefreq: 'daily' as const, priority: '1.0' }, // Home
    { path: 'catalog', changefreq: 'daily' as const, priority: '0.9' },
    { path: 'about', changefreq: 'monthly' as const, priority: '0.6' },
    { path: 'contact', changefreq: 'monthly' as const, priority: '0.6' },
    { path: 'oppettider', changefreq: 'monthly' as const, priority: '0.6' },
    { path: 'villkor', changefreq: 'monthly' as const, priority: '0.4' },
    { path: 'angerratt', changefreq: 'monthly' as const, priority: '0.4' },
    { path: 'integritetspolicy', changefreq: 'monthly' as const, priority: '0.4' },
    { path: 'frakt', changefreq: 'monthly' as const, priority: '0.4' },
  ]

  const urlEntries: SitemapUrl[] = []

  // Add static pages
  for (const page of staticPages) {
    const arUrl = page.path ? `${siteUrl}/${page.path}` : `${siteUrl}/`
    const svUrl = page.path ? `${siteUrl}/sv/${page.path}` : `${siteUrl}/sv`
    const enUrl = page.path ? `${siteUrl}/en/${page.path}` : `${siteUrl}/en`

    const alternates: AlternateLink[] = [
      { hreflang: 'ar', href: arUrl },
      { hreflang: 'sv', href: svUrl },
      { hreflang: 'en', href: enUrl },
      { hreflang: 'x-default', href: arUrl },
    ]

    // Localized variant for Arabic (default)
    urlEntries.push({
      loc: arUrl,
      lastmod: today,
      changefreq: page.changefreq,
      priority: page.priority,
      alternates,
    })

    // Localized variant for Swedish
    urlEntries.push({
      loc: svUrl,
      lastmod: today,
      changefreq: page.changefreq,
      priority: page.priority,
      alternates,
    })

    // Localized variant for English
    urlEntries.push({
      loc: enUrl,
      lastmod: today,
      changefreq: page.changefreq,
      priority: page.priority,
      alternates,
    })
  }

  // 2. Query Active Categories from MongoDB
  try {
    if (typeof (Category as any).find === 'function') {
      const categories = await Category.find({ isActive: { $ne: false } })
        .select('slug name updatedAt')
        .lean()
        .exec()

      for (const cat of categories as any[]) {
        const arSlug = cat.slug?.ar || cat.slug?.sv || cat.slug?.en || String(cat._id)
        const svSlug = cat.slug?.sv || cat.slug?.en || cat.slug?.ar || String(cat._id)
        const enSlug = cat.slug?.en || cat.slug?.sv || cat.slug?.ar || String(cat._id)

        const arUrl = `${siteUrl}/catalog?category=${encodeURIComponent(arSlug)}`
        const svUrl = `${siteUrl}/sv/catalog?category=${encodeURIComponent(svSlug)}`
        const enUrl = `${siteUrl}/en/catalog?category=${encodeURIComponent(enSlug)}`

        const lastmod = cat.updatedAt
          ? new Date(cat.updatedAt).toISOString().split('T')[0]
          : today

        const alternates: AlternateLink[] = [
          { hreflang: 'ar', href: arUrl },
          { hreflang: 'sv', href: svUrl },
          { hreflang: 'en', href: enUrl },
          { hreflang: 'x-default', href: arUrl },
        ]

        urlEntries.push(
          { loc: arUrl, lastmod, changefreq: 'daily', priority: '0.8', alternates },
          { loc: svUrl, lastmod, changefreq: 'daily', priority: '0.8', alternates },
          { loc: enUrl, lastmod, changefreq: 'daily', priority: '0.8', alternates }
        )
      }
    }
  } catch {
    // Fallback if database is unavailable
  }

  // 3. Query Active Products from MongoDB
  try {
    if (typeof (Product as any).find === 'function') {
      const products = await Product.find({ isActive: { $ne: false } })
        .select('_id updatedAt')
        .lean()
        .exec()

      for (const prod of products as any[]) {
        const id = String(prod._id)
        const arUrl = `${siteUrl}/products/${id}`
        const svUrl = `${siteUrl}/sv/products/${id}`
        const enUrl = `${siteUrl}/en/products/${id}`

        const lastmod = prod.updatedAt
          ? new Date(prod.updatedAt).toISOString().split('T')[0]
          : today

        const alternates: AlternateLink[] = [
          { hreflang: 'ar', href: arUrl },
          { hreflang: 'sv', href: svUrl },
          { hreflang: 'en', href: enUrl },
          { hreflang: 'x-default', href: arUrl },
        ]

        urlEntries.push(
          { loc: arUrl, lastmod, changefreq: 'weekly', priority: '0.8', alternates },
          { loc: svUrl, lastmod, changefreq: 'weekly', priority: '0.8', alternates },
          { loc: enUrl, lastmod, changefreq: 'weekly', priority: '0.8', alternates }
        )
      }
    }
  } catch {
    // Fallback if database is unavailable
  }

  // 4. Generate Valid XML String
  const xmlLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ]

  for (const entry of urlEntries) {
    xmlLines.push('  <url>')
    xmlLines.push(`    <loc>${escapeXml(entry.loc)}</loc>`)
    for (const alt of entry.alternates) {
      xmlLines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`)
    }
    if (entry.lastmod) {
      xmlLines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
    }
    if (entry.changefreq) {
      xmlLines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`)
    }
    if (entry.priority) {
      xmlLines.push(`    <priority>${escapeXml(entry.priority)}</priority>`)
    }
    xmlLines.push('  </url>')
  }

  xmlLines.push('</urlset>')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600, s-maxage=86400')

  return xmlLines.join('\n')
})

