import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useFavorites } from '../context/FavoriteContext.jsx'
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { localizedName } from '../utils/localizedFields.js'

export default function Navbar() {
  const { items, removeFromCart, refreshCartAvailability, cartCount, cartTotal } = useCart()
  const { formatPrice } = useCurrency()
  const { favoriteCount } = useFavorites()
  const { isLoggedIn, customer, logoutCustomer, ready: customerAuthReady } = useCustomerAuth()
  const showCustomerProfile = customerAuthReady && isLoggedIn
  const { t, lang, setLang } = useLanguage()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isHome = pathname === '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  // On non-home pages, immediately make navbar live (pink pill)
  useEffect(() => {
    const nav = document.getElementById('main-navbar')
    if (!nav) return
    if (!isHome) {
      nav.classList.add('live')
    } else {
      nav.classList.remove('live')
    }
  }, [isHome])

  useEffect(() => {
    setMenuOpen(false)
    setCartOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return undefined

    function closeMenuOnOutsideClick(event) {
      if (event.target?.closest?.('#main-navbar')) return
      setMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeMenuOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeMenuOnOutsideClick)
  }, [menuOpen])

  async function handleLogout() {
    await logoutCustomer()
    setMenuOpen(false)
    setCartOpen(false)
    if (pathname === '/cart' || pathname === '/favorites') {
      navigate('/', { replace: true })
    }
  }

  return (
    <nav className={`navbar${menuOpen ? ' menu-open' : ''}`} id="main-navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <img src="/logo.png" alt="Itsgenygarts" width="46" height="46" decoding="async" />
        </Link>

        <button
          type="button"
          className={`navbar-mobile-cart${cartOpen ? ' active' : ''}`}
          aria-label={cartOpen ? t('nav.closeCart') : t('nav.cart')}
          aria-expanded={cartOpen}
          onClick={() => {
            refreshCartAvailability()
            setCartOpen((open) => !open)
            setMenuOpen(false)
          }}
        >
          <CartIcon />
          {cartCount > 0 && (
            <span className="navbar-mobile-cart-count">
              {cartCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="navbar-toggle"
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <button
          type="button"
          className="navbar-backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
        />

        <ul className="navbar-links">
          <li>
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              {t('nav.home')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/products" className={({ isActive }) => isActive ? 'active' : ''}>
              {t('nav.products')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/yarn" className={({ isActive }) => isActive ? 'active' : ''}>
              {t('nav.yarn')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/custom-order" className={({ isActive }) => isActive ? 'active' : ''}>
              {t('nav.custom')}
            </NavLink>
          </li>

          <li className="navbar-language-item">
            <button
              type="button"
              className="navbar-language-toggle"
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </li>

          <li>
            <NavLink
              to="/favorites"
              className={({ isActive }) => `navbar-icon-link navbar-favorite-link${isActive ? ' active' : ''}`}
              style={{ position: 'relative' }}
              aria-label={t('nav.favorites')}
            >
              <span aria-hidden="true" className="navbar-heart-icon">♡</span>
              {favoriteCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -10,
                  background: 'rgba(255,255,255,0.9)', color: 'var(--color-primary)',
                  borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
                  minWidth: 16, height: 16, lineHeight: '16px', textAlign: 'center',
                  padding: '0 4px',
                }}>
                  {favoriteCount}
                </span>
              )}
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/cart"
              className={({ isActive }) => `navbar-icon-link${isActive ? ' active' : ''}`}
              style={{ position: 'relative' }}
              aria-label={t('nav.cart')}
            >
              <CartIcon />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -10,
                  background: 'rgba(255,255,255,0.9)', color: 'var(--color-primary)',
                  borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
                  minWidth: 16, height: 16, lineHeight: '16px', textAlign: 'center',
                  padding: '0 4px',
                }}>
                  {cartCount}
                </span>
              )}
            </NavLink>
          </li>

          {showCustomerProfile ? (
            <>
              <li>
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `navbar-icon-link${isActive ? ' active' : ''}`}
                >
                  <UserIcon />
                  <span>{customer?.name?.split(' ')[0] || t('nav.profile')}</span>
                </NavLink>
              </li>
              <li>
                <button className="btn-ghost" onClick={handleLogout}>
                  {t('nav.logout')}
                </button>
              </li>
            </>
          ) : (
            <li>
              <NavLink
                to="/login"
                className={({ isActive }) => `navbar-icon-link${isActive ? ' active' : ''}`}
                aria-label={t('nav.login')}
              >
                <UserIcon />
              </NavLink>
            </li>
          )}
        </ul>

        {cartOpen && (
          <>
            <button
              type="button"
              className="navbar-cart-drawer-backdrop"
              aria-label="Fermer le panier"
              onClick={() => setCartOpen(false)}
            />
            <aside className="navbar-cart-drawer" aria-label={t('nav.cart')}>
              <div className="navbar-cart-drawer-header">
                <h2>{t('cart.title')}</h2>
                <button type="button" onClick={() => setCartOpen(false)} aria-label={t('nav.closeCart')}>×</button>
              </div>

              {items.length === 0 ? (
                <div className="navbar-cart-empty">
                  <CartIcon />
                  <p>{t('cart.empty')}</p>
                  <Link to="/products" className="btn btn-primary btn-sm" onClick={() => setCartOpen(false)}>
                    {t('cart.viewProducts')}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="navbar-cart-items">
                    {items.map((item) => (
                      <div className="navbar-cart-item" key={`${item.id}:${item.productVariantId || ''}`}>
                        {item.mainImageUrl ? (
                          <img src={item.mainImageUrl} alt={localizedName(item, lang)} width="58" height="58" loading="lazy" decoding="async" />
                        ) : (
                          <div className="navbar-cart-item-placeholder">🧶</div>
                        )}
                        <div className="navbar-cart-item-body">
                          <div className="navbar-cart-item-name">{localizedName(item, lang)}</div>
                          {item.variantLabel && (
                            <div className="navbar-cart-item-price">
                              {t('products.variation')} {item.variantLabel}
                            </div>
                          )}
                          <div className="navbar-cart-item-price">
                            {formatPrice(item.price * item.quantity)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="navbar-cart-remove"
                          aria-label={`${t('cart.remove')}: ${localizedName(item, lang)}${item.variantLabel ? ` (${t('products.variation')} ${item.variantLabel})` : ''}`}
                          title={t('cart.remove')}
                          onClick={() => removeFromCart(item.id, item.productVariantId)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="navbar-cart-drawer-footer">
                    <div>
                      <span>{t('cart.total')}</span>
                      <strong>{formatPrice(cartTotal)}</strong>
                    </div>
                    <Link to="/checkout" className="btn btn-primary" onClick={() => setCartOpen(false)}>
                      {t('cart.checkout')}
                    </Link>
                  </div>
                </>
              )}
            </aside>
          </>
        )}
      </div>
    </nav>
  )
}

function CartIcon() {
  return (
    <svg className="navbar-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h8.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="navbar-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
