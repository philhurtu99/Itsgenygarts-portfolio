import { useId } from 'react'
import { useFavorites } from '../context/FavoriteContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { isProductUnavailable } from '../utils/productAvailability.js'
import { getAvailableVariants } from '../utils/productVariants.js'
import { localizedName } from '../utils/localizedFields.js'

export default function FavoriteButton({ product, className = '', compact = false }) {
  const id = useId()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { t, lang } = useLanguage()
  const productId = Number(product?.id ?? product?._id)
  const variants = getAvailableVariants(product)
  const productVariantId = product?.selectedVariant?.id || product?.selectedVariantId || product?.productVariantId || variants[0]?.id || null
  const unavailable = isProductUnavailable(product)
  const checked = Number.isInteger(productId) && isFavorite(productId, productVariantId)

  if (unavailable) return null

  function stop(e) {
    e.stopPropagation()
  }

  function handleChange(e) {
    e.stopPropagation()
    toggleFavorite({ ...product, name: localizedName(product, lang) })
  }

  return (
    <div
      className={`favorite-button${compact ? ' favorite-button-compact' : ''}${className ? ` ${className}` : ''}`}
      onClick={stop}
    >
      <input
        type="checkbox"
        checked={checked}
        id={id}
        name={`favorite-${productId || id}`}
        value="favorite-button"
        aria-label={`${t(checked ? 'favorites.remove' : 'favorites.add')} : ${localizedName(product, lang)}`}
        onChange={handleChange}
      />
      <label htmlFor={id} className="favorite-button-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {!compact && (
          <div className="action">
            <span className="option-1">{t('favorites.add')}</span>
            <span className="option-2">{t('favorites.added')}</span>
          </div>
        )}
      </label>
    </div>
  )
}
