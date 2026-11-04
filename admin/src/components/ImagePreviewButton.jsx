import { useRef, useState } from 'react'
import ImageLightbox from './ImageLightbox.jsx'

export default function ImagePreviewButton({ src, alt, imageStyle, images = [] }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  const seen = new Set()
  const previewImages = [src, ...images].flatMap((image) => {
    const url = typeof image === 'string' ? image : image?.imageUrl || image?.storagePathOrUrl
    if (!url || seen.has(url)) return []
    seen.add(url)
    return [{ storagePathOrUrl: url, alt }]
  })

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button type="button" className="admin-image-preview" ref={triggerRef}
        aria-label={`Agrandir l’image de ${alt}`} onClick={() => setOpen(true)}>
        <img src={src} alt={alt} style={imageStyle} />
        {previewImages.length > 1 && <span className="admin-image-count" aria-hidden="true">+{previewImages.length - 1}</span>}
      </button>
      {open && <ImageLightbox images={previewImages} initialIndex={0} onClose={close} />}
    </>
  )
}
