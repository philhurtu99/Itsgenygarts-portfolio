import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getFeaturedProducts, getProducts } from '../services/api.js'
import ProductCard from '../components/ProductCard.jsx'
import Loader from '../components/Loader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import SeoHead from '../components/SeoHead.jsx'
import { getLocalPreviewProducts } from '../utils/localPreviewProducts.js'
import { localizedName } from '../utils/localizedFields.js'
import { sortProductsByAvailability } from '../utils/productAvailability.js'
import { customOrdersEnabled } from '../config/features.js'

const FLY_SQUARES = [
  { bg: '#DD7A8F', w: 155, h: 125, top: '4%',  left: '1%',   bob: -18, rot: -2,   dur: 3.2, dly: 0   },
  { bg: '#6FC7CE', w: 135, h: 148, top: '11%', left: '7%',   bob: -13, rot: 1.5,  dur: 2.9, dly: .3  },
  { bg: '#F95D00', w: 88,  h: 75,  top: '43%', left: '9%',   bob: -15, rot: -1,   dur: 2.7, dly: .2  },
  { bg: '#DD7A8F', w: 145, h: 138, top: '61%', left: '0%',   bob: -17, rot: 1,    dur: 3.1, dly: .5  },
  { bg: '#6FC7CE', w: 158, h: 165, top: '69%', left: '8%',   bob: -11, rot: -2,   dur: 3.0, dly: .1  },
  { bg: '#F95D00', w: 68,  h: 84,  top: '7%',  right: '17%', bob: -19, rot: -1.5, dur: 2.8, dly: .4  },
  { bg: '#DD7A8F', w: 158, h: 128, top: '2%',  right: '0%',  bob: -15, rot: 2,    dur: 3.0, dly: 0   },
  { bg: '#6FC7CE', w: 148, h: 138, top: '39%', right: '2%',  bob: -13, rot: -2,   dur: 3.5, dly: .3  },
  { bg: '#D4A952', w: 68,  h: 68,  top: '74%', right: '21%', bob: -9,  rot: 1,    dur: 2.9, dly: .6  },
  { bg: '#DD7A8F', w: 48,  h: 48,  top: '79%', right: '17%', bob: -7,  rot: -3,   dur: 3.3, dly: .2  },
  { bg: '#F95D00', w: 38,  h: 38,  top: '68%', right: '5%',  bob: -11, rot: 2,    dur: 2.6, dly: .8  },
  { bg: '#D4A952', w: 50,  h: 50,  top: '39%', left: '17%',  bob: -9,  rot: 3,    dur: 3.6, dly: .6  },
  { bg: '#D4A952', w: 95,  h: 78,  top: '81%', left: '13%',  bob: -7,  rot: 2,    dur: 3.4, dly: .7  },
]

const BG_SQUARES = [
  { bg: '#DD7A8F', op: .65, w: 100, h: 100, top: '8%',  left: '3%',   bob: -14, rot: -3, dur: 4.1, dly: .2  },
  { bg: '#6FC7CE', op: .60, w: 78,  h: 78,  top: '15%', left: '14%',  bob: -10, rot: 2,  dur: 3.8, dly: .8  },
  { bg: '#D4A952', op: .70, w: 52,  h: 52,  top: '55%', left: '5%',   bob: -7,  rot: 4,  dur: 4.4, dly: .4  },
  { bg: '#F95D00', op: .60, w: 66,  h: 66,  top: '72%', left: '20%',  bob: -12, rot: -2, dur: 3.6, dly: 1   },
  { bg: '#DD7A8F', op: .55, w: 120, h: 90,  top: '80%', left: '0%',   bob: -17, rot: 1,  dur: 4.2, dly: .1  },
  { bg: '#6FC7CE', op: .65, w: 88,  h: 88,  top: '6%',  right: '4%',  bob: -11, rot: -1, dur: 3.9, dly: .5  },
  { bg: '#D4A952', op: .60, w: 62,  h: 62,  top: '22%', right: '12%', bob: -8,  rot: 3,  dur: 4.3, dly: .9  },
  { bg: '#F95D00', op: .65, w: 82,  h: 72,  top: '50%', right: '5%',  bob: -13, rot: -2, dur: 3.7, dly: .3  },
  { bg: '#DD7A8F', op: .55, w: 56,  h: 56,  top: '65%', right: '15%', bob: -10, rot: 2,  dur: 4.0, dly: .7  },
  { bg: '#6FC7CE', op: .60, w: 105, h: 95,  top: '78%', right: '3%',  bob: -16, rot: -3, dur: 4.5, dly: .2  },
]

const CATEGORY_ACCENTS = ['#DD7A8F', '#6FC7CE', '#D4A952', '#F95D00']

function sqStyle(sq) {
  return {
    background: sq.bg,
    width: sq.w,
    height: sq.h,
    top: sq.top,
    left: sq.left,
    right: sq.right,
    opacity: sq.op ?? 1,
    '--bob': `${sq.bob}px`,
    '--rot': `${sq.rot}deg`,
    '--dur': `${sq.dur}s`,
    '--dly': `${sq.dly}s`,
  }
}

function getHeroTitleParts(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 3) return [title, '', '']

  return [words[0], words.slice(1, -1).join(' '), words[words.length - 1]]
}

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [categoryProducts, setCategoryProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { t, lang } = useLanguage()
  const triggeredRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadHomeProducts() {
      setLoading(true)
      setError(null)

      const [featuredResult, allResult] = await Promise.allSettled([
        getFeaturedProducts(6),
        getProducts(),
      ])

      const featured = featuredResult.status === 'fulfilled'
        ? (Array.isArray(featuredResult.value) ? featuredResult.value : featuredResult.value.products || [])
        : []
      const all = allResult.status === 'fulfilled'
        ? (Array.isArray(allResult.value) ? allResult.value : allResult.value.products || [])
        : []
      const previewProducts = featured.length > 0 && all.length > 0
        ? []
        : await getLocalPreviewProducts()
      const resolvedAll = sortProductsByAvailability(all.length > 0 ? all : (previewProducts.length > 0 ? previewProducts : featured))
      const allFeatured = resolvedAll.filter((product) => product.isFeatured)
      const resolvedFeatured = sortProductsByAvailability(allFeatured.length > 0 ? allFeatured : (featured.length > 0 ? featured : resolvedAll)).slice(0, 6)

      if (cancelled) return

      setFeaturedProducts(resolvedFeatured)
      setCategoryProducts(resolvedAll)
      const allRequestsFailed = featuredResult.status === 'rejected' && allResult.status === 'rejected'
      if (resolvedFeatured.length === 0 && resolvedAll.length === 0 && allRequestsFailed) {
        const failure = featuredResult.reason || allResult.reason
        setError(failure?.message || 'Unable to load products')
      }
      setLoading(false)
    }

    loadHomeProducts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let compactTimer

    function runAnimation() {
      if (triggeredRef.current) return
      triggeredRef.current = true

      const squares = [...document.querySelectorAll('.fly-sq')]
      const navbar = document.getElementById('main-navbar')
      const hero = document.getElementById('home-hero')
      const heroLogo = document.getElementById('hero-logo')
      const scrollHint = document.getElementById('scroll-hint')

      // Fly squares toward navbar area (converge + fade)
      squares.forEach((sq, i) => {
        sq.style.setProperty('--fd', (i * 55) + 'ms')
        sq.classList.add('fly')
        requestAnimationFrame(() => requestAnimationFrame(() => {
          sq.style.top = '20px'
          sq.style.opacity = '0'
          sq.style.transform = 'scale(0.05)'
          // pull left-positioned squares toward center
          if (sq.style.left) sq.style.left = '48%'
          if (sq.style.right) { sq.style.right = ''; sq.style.left = '48%' }
        }))
      })

      // Logo flies to navbar position
      setTimeout(() => {
        if (heroLogo) {
          const navbarLogo = document.querySelector('#main-navbar .navbar-logo img')
          const navbarLogoRect = navbarLogo?.getBoundingClientRect()

          if (navbarLogoRect?.width && navbarLogoRect?.height) {
            heroLogo.style.setProperty('--hero-fly-left', `${navbarLogoRect.left}px`)
            heroLogo.style.setProperty('--hero-fly-top', `${navbarLogoRect.top}px`)
            heroLogo.style.setProperty('--hero-fly-size', `${Math.min(navbarLogoRect.width, navbarLogoRect.height)}px`)
          }

          heroLogo.classList.add('fly-logo')
        }
      }, 720)

      // Navbar materialises
      setTimeout(() => {
        if (navbar) navbar.classList.add('live')
      }, 820)

      // Swap to real navbar logo
      setTimeout(() => {
        if (heroLogo) {
          heroLogo.style.opacity = '0'
          heroLogo.style.pointerEvents = 'none'
        }
      }, 1720)

      // Show tagline
      setTimeout(() => {
        const tagline = document.getElementById('hero-tagline')
        if (tagline) tagline.classList.add('show')
      }, 1180)

      // Keep the original full-screen entrance, then reveal the product shelf.
      compactTimer = setTimeout(() => {
        if (hero) hero.classList.add('compact')
      }, 2050)
    }

    const timer = setTimeout(runAnimation, 160)
    const onScroll = () => { if (window.scrollY > 40) runAnimation() }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      clearTimeout(timer)
      clearTimeout(compactTimer)
      window.removeEventListener('scroll', onScroll)
      triggeredRef.current = false
    }
  }, [])

  const desc = lang === 'fr'
    ? 'Découvrez nos créations crochet artisanales faites main — cardigans, bonnets, accessoires personnalisables. Livraison Canada, États-Unis, France.'
    : 'Discover our handmade crochet creations — cardigans, beanies, customizable accessories. Shipping to Canada, USA, France.'
  const heroTitleParts = getHeroTitleParts(t('home.heroTitle'))
  const categoryGroups = useMemo(() => {
    const groups = new Map()

    categoryProducts.forEach((product) => {
      const category = product?.category
      if (!category) return

      const key = typeof category === 'object'
        ? category.name || category.id || category._id
        : category
      if (!key) return

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: typeof category === 'object' ? localizedName(category, lang) : category,
          products: [],
        })
      }
      groups.get(key).products.push(product)
    })

    return [...groups.values()].sort((a, b) => a.label.localeCompare(
      b.label,
      lang === 'en' ? 'en-CA' : 'fr-CA',
      { sensitivity: 'base', numeric: true }
    ))
  }, [categoryProducts, lang])

  function scrollToFeaturedProducts() {
    document.getElementById('featured-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <SeoHead url="/" description={desc} />

      {/* ── HERO ── */}
      <section className="hero" id="home-hero">
        {/* Background squares — always visible */}
        {BG_SQUARES.map((sq, i) => (
          <div key={`bg-${i}`} className="sq bg-sq" style={sqStyle(sq)} />
        ))}

        {/* Flying squares — animate off screen */}
        {FLY_SQUARES.map((sq, i) => (
          <div key={`fly-${i}`} className="sq fly-sq" style={sqStyle(sq)} />
        ))}

        {/* Centered logo — flies to navbar */}
        <div className="hero-logo" id="hero-logo">
          <img src="/logo.png" alt="Itsgenygarts" width="300" height="300" decoding="async" fetchpriority="high" />
        </div>

        {/* Tagline — revealed after animation */}
        <div className="hero-tagline" id="hero-tagline">
          <div className="tagline-title">
            {heroTitleParts.map((part, index) => (
              part ? (
                <span
                  key={`${part}-${index}`}
                  className="tw"
                  style={{
                    '--i': index,
                    ...(index === 1 ? { color: 'var(--color-primary)' } : {}),
                  }}
                >
                  {index > 0 ? ' ' : ''}{part}
                </span>
              ) : null
            ))}
          </div>
          <p className="tw tagline-sub" style={{ '--i': 3, fontSize: '1.1rem' }}>
            {t('home.heroSubtitle')}
          </p>
        </div>

        <button type="button" className="scroll-hint" id="scroll-hint" onClick={scrollToFeaturedProducts}>
          {t('home.scroll')}
        </button>
      </section>

      <aside className="home-shipping-notice" lang={lang} aria-label={t('home.shippingNoticeLabel')} tabIndex={0}>
        <p className="sr-only">{t('home.usShippingNotice')}</p>
        <div className="home-shipping-notice-viewport" aria-hidden="true">
          <div className="home-shipping-notice-track">
            <span>{t('home.usShippingNotice')}</span>
          </div>
        </div>
      </aside>

      {/* ── FEATURED PRODUCTS ── */}
      <section id="featured-products" className="home-featured-products">
        <div className="home-featured-products-inner">
          <div className="home-featured-products-heading">
            <h2>
              {t('home.featured')}
            </h2>
            <Link to="/products" className="home-featured-products-link">
              {t('home.seeAll')} →
            </Link>
          </div>

          {loading && <Loader label={t('products.loading')} />}
          {error && <div className="alert alert-error">{t('home.loadError')}</div>}
          {!loading && !error && featuredProducts.length === 0 && (
            <div className="empty-state">{t('home.noProducts')}</div>
          )}
          {!loading && !error && featuredProducts.length > 0 && (
            <div className="product-grid home-featured-products-grid">
              {featuredProducts.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {!loading && !error && categoryGroups.length > 0 && (
        <div className="home-category-collections">
          {categoryGroups.map((group, index) => (
            <section
              className="home-category-collection"
              key={group.key}
              style={{ '--home-category-accent': CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length] }}
            >
              <div className="home-category-collection-heading">
                <div>
                  <span className="home-category-collection-accent" aria-hidden="true" />
                  <h2>{group.label}</h2>
                </div>
                <Link
                  to={`/products?category=${encodeURIComponent(group.key)}`}
                  className="home-featured-products-link"
                >
                  {t('home.seeAll')} →
                </Link>
              </div>
              <div className="product-grid home-category-products-grid">
                {group.products.slice(0, 4).map((product) => (
                  <ProductCard key={product._id || product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── FEATURES ── */}
      <section className="home-features">
        <h2 className="sr-only">{lang === 'fr' ? 'Pourquoi choisir Itsgenygarts' : 'Why choose Itsgenygarts'}</h2>
        <div className="home-features-inner">
          {[
            { icon: '🧶', bg: '#FFF0F3', label: t('home.handmade'),     desc: t('home.handmadeDesc') },
            { icon: '🎨', bg: '#F0FBF7', label: t('home.customizable'), desc: t('home.customizableDesc') },
            { icon: '💌', bg: '#FFFAF0', label: t('home.shipping'),     desc: t('home.shippingDesc') },
          ].map((f) => (
            <div key={f.label} style={{ textAlign: 'center' }}>
              <div className="home-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.25rem' }}>{f.label}</h3>
              <p style={{ fontSize: '.875rem', color: 'var(--color-text-muted)', margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ background: 'var(--color-primary)', padding: '5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(255,255,255,.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <h2 style={{ color: '#fff', fontSize: '2.25rem', fontWeight: 700, marginBottom: '.75rem', position: 'relative' }}>
          {t('home.ctaTitle')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,.88)', fontSize: '1.05rem', maxWidth: 500, margin: '0 auto 2rem', position: 'relative' }}>
          {t('home.ctaSubtitle')}
        </p>
        <div className="home-cta-actions">
          <Link to="/custom-order" className="btn-pink btn-pink-on-primary">
            {customOrdersEnabled ? t('home.ctaCustom') : t('home.ctaCustomComingSoon')}
          </Link>
          <Link to="/custom-order" className="btn-pink-outline btn-pink-outline-on-primary">
            {customOrdersEnabled ? t('home.ctaQuote') : t('home.ctaQuoteComingSoon')}
          </Link>
        </div>
      </section>

    </div>
  )
}
