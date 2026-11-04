import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function ProductImageLightbox({ src, alt, onClose, onTouchStart, onTouchEnd, onTouchCancel }) {
  const { t } = useLanguage()
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <dialog ref={dialogRef} className="product-photo-lightbox" aria-label={`${t('products.enlargeImage')}: ${alt}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}>
      <button type="button" className="product-photo-lightbox-close" aria-label={t('common.close')} onClick={onClose}>×</button>
      <img src={src} alt={alt} className="product-photo-lightbox-image" draggable={false}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel} />
    </dialog>,
    document.body
  )
}
