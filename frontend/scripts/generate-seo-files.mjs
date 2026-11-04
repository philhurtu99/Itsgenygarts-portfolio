import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(__dirname, '..')
const publicDir = path.join(frontendDir, 'public')

function parseEnvFile(content) {
  const env = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function loadFrontendEnv() {
  const files = ['.env', '.env.local', '.env.production', '.env.production.local']
  const env = {}

  for (const name of files) {
    const filePath = path.join(frontendDir, name)
    if (!fs.existsSync(filePath)) continue
    Object.assign(env, parseEnvFile(fs.readFileSync(filePath, 'utf8')))
  }

  return env
}

const DEFAULT_SITE_URL = 'http://localhost:3000'

function normalizeUrl(url) {
  const normalized = String(url || '').trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(normalized) ? normalized : DEFAULT_SITE_URL
}

const env = { ...loadFrontendEnv(), ...process.env }
const siteUrl = normalizeUrl(env.VITE_FRONTEND_URL)
const customOrdersEnabled = String(env.VITE_CUSTOM_ORDERS_ENABLED || '').trim().toLowerCase() === 'true'

const pages = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/products', changefreq: 'weekly', priority: '0.9' },
  ...(customOrdersEnabled ? [{ path: '/custom-order', changefreq: 'monthly', priority: '0.7' }] : []),
  { path: '/faq', changefreq: 'monthly', priority: '0.5' },
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((page) => `  <url>
    <loc>${siteUrl}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>
`

const robots = `User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /checkout
Disallow: /cart
Disallow: /profile
Disallow: /order-confirmation
Disallow: /verify-email
Disallow: /reset-password
Disallow: /forgot-password

Sitemap: ${siteUrl}/sitemap.xml
`

fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap)
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots)

console.log(`Generated sitemap.xml and robots.txt for ${siteUrl}`)
