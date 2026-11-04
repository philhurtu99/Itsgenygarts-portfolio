import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function cloudinaryDownloadUrl(url) {
  if (!url) return url
  return url.replace('/upload/', '/upload/fl_attachment/')
}

export default function ImageLightbox({ images, initialIndex, onClose, onIndexChange }) {
  const [idx, setIdx] = useState(initialIndex)
  const [touchStart, setTouchStart] = useState(null)

  const updateIndex = useCallback((value) => {
    setIdx((current) => {
      const nextValue = typeof value === 'function' ? value(current) : value
      const nextIndex = (nextValue + images.length) % images.length
      onIndexChange?.(nextIndex)
      return nextIndex
    })
  }, [images.length, onIndexChange])

  const prev = useCallback(() => updateIndex((i) => i - 1), [updateIndex])
  const next = useCallback(() => updateIndex((i) => i + 1), [updateIndex])

  function handleTouchStart(e) {
    const touch = e.touches?.[0]
    if (!touch) return
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }

  function handleTouchEnd(e) {
    if (!touchStart) return
    const touch = e.changedTouches?.[0]
    if (!touch) return
    const dx = touch.clientX - touchStart.x
    const dy = touch.clientY - touchStart.y
    setTouchStart(null)
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) next()
    else prev()
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  const img = images[idx]

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Aperçu des images"
      onClick={(e) => {
        e.stopPropagation()
        if (!e.target.closest('button, a, img')) onClose()
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '0.5rem' }}>
        <a
          href={cloudinaryDownloadUrl(img.storagePathOrUrl)}
          download
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'rgba(255,255,255,0.15)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
            padding: '0.4rem 0.85rem', fontSize: '0.875rem', textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Télécharger
        </a>
        <button
          onClick={onClose}
          aria-label="Fermer l’aperçu"
          autoFocus
          style={{
            background: 'rgba(255,255,255,0.15)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
            padding: '0.4rem 0.75rem', fontSize: '1.1rem', cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {images.length > 1 && (
        <div style={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
          {idx + 1} / {images.length}
        </div>
      )}

      {images.length > 1 && (
        <button aria-label="Photo précédente" onClick={prev} style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          minWidth: 44, minHeight: 44,
          background: 'rgba(0,0,0,0.55)', color: 'white',
          border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
          padding: '0.75rem 1rem', fontSize: '1.25rem', cursor: 'pointer',
        }}>‹</button>
      )}

      <img
        src={img.storagePathOrUrl}
        alt={img.alt || `Référence ${idx + 1}`}
        style={{ width: 'auto', height: 'auto', maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}
      />

      {images.length > 1 && (
        <button aria-label="Photo suivante" onClick={next} style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          minWidth: 44, minHeight: 44,
          background: 'rgba(0,0,0,0.55)', color: 'white',
          border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
          padding: '0.75rem 1rem', fontSize: '1.25rem', cursor: 'pointer',
        }}>›</button>
      )}

      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, display: 'flex', gap: '0.5rem', maxWidth: '90vw', overflowX: 'auto' }}>
          {images.map((im, i) => (
            <img
              key={i}
              src={im.storagePathOrUrl}
              alt=""
              onClick={() => updateIndex(i)}
              style={{
                width: 56, height: 56, flexShrink: 0, objectFit: 'cover', borderRadius: 4,
                border: i === idx ? '2px solid white' : '2px solid rgba(255,255,255,0.25)',
                cursor: 'pointer', opacity: i === idx ? 1 : 0.6,
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
