import { useEffect, useRef, useState } from 'react'

export default function SortablePhotoRow({ images, renderImage, onReorder, disabled = false }) {
  const [draft, setDraft] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const listRef = useRef(null)
  const dragRef = useRef(null)
  const timerRef = useRef(null)
  const propsRef = useRef(null)
  propsRef.current = { images, onReorder, disabled }

  useEffect(() => {
    let mounted = true
    function move(event) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      drag.x = event.clientX
      drag.y = event.clientY
      if (!drag.active && drag.pointerType === 'mouse' && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6) drag.active = true
      if (!drag.active) return
      event.preventDefault()
      setDragging({ image: drag.image, x: drag.x, y: drag.y })
      const row = listRef.current
      const bounds = row.getBoundingClientRect()
      if (drag.x < bounds.left + 24) row.scrollLeft -= 16
      if (drag.x > bounds.right - 24) row.scrollLeft += 16
      const target = document.elementFromPoint(drag.x, drag.y)?.closest('[data-sortable-photo]')
      if (!target || !row.contains(target)) return
      const from = drag.ordered.findIndex(image => image.id === drag.image.id)
      const to = drag.ordered.findIndex(image => String(image.id) === target.dataset.sortablePhoto)
      if (to < 0 || from === to) return
      const next = [...drag.ordered]
      next.splice(to, 0, next.splice(from, 1)[0])
      drag.ordered = next
      setDraft(next)
    }
    async function finish(event) {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      clearTimeout(timerRef.current)
      dragRef.current = null
      setDragging(null)
      const changed = drag.ordered.some((image, index) => image.id !== drag.initial[index].id)
      if (event.type === 'pointercancel' || !changed) { setDraft(null); return }
      try {
        await propsRef.current.onReorder(drag.ordered)
        if (mounted) setAnnouncement('Nouvel ordre des photos enregistré.')
      } catch { /* The product form displays the API error and retains the saved order. */ }
      finally { if (mounted) setDraft(null) }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      mounted = false
      clearTimeout(timerRef.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [])

  function start(event, image) {
    if (disabled || dragRef.current || event.target.closest('button') || (event.button != null && event.button !== 0)) return
    event.currentTarget.focus({ preventScroll: true })
    const drag = { pointerId: event.pointerId, pointerType: event.pointerType || 'mouse', image,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      initial: [...images], ordered: [...images], active: false }
    dragRef.current = drag
    if (drag.pointerType !== 'mouse') {
      timerRef.current = setTimeout(() => {
        if (dragRef.current !== drag) return
        drag.active = true
        setDragging({ image, x: drag.x, y: drag.y })
      }, 220)
    }
  }

  async function moveWithKeyboard(event, image) {
    if (disabled || event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const from = images.findIndex(item => item.id === image.id)
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? images.length - 1 : from + (event.key === 'ArrowLeft' ? -1 : 1)
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    next.splice(to, 0, next.splice(from, 1)[0])
    setDraft(next)
    try { await onReorder(next); setAnnouncement(`Photo déplacée à la position ${to + 1}.`) }
    catch { /* The product form displays the API error. */ }
    finally { setDraft(null) }
  }

  return <>
    <p className="photo-order-help">Glisse les photos pour changer leur ordre. Sur mobile, maintiens puis déplace. La première est la photo principale.</p>
    <div ref={listRef} className="photo-order-list" role="list" aria-label="Ordre des photos" aria-busy={disabled}>
      {(draft || images).map((image, index) => <div key={image.id} role="listitem" tabIndex={disabled ? -1 : 0}
        className={`photo-order-item${dragging?.image.id === image.id ? ' is-dragging' : ''}`}
        data-sortable-photo={image.id} aria-label={`Photo ${index + 1}${index === 0 ? ', principale' : ''}. Flèches gauche et droite pour déplacer.`}
        onPointerDown={event => start(event, image)} onKeyDown={event => moveWithKeyboard(event, image)}
        onDragStart={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}>
        {renderImage(image)}
        {index === 0 && <span className="photo-order-cover">Principale</span>}
      </div>)}
    </div>
    {dragging && <img src={dragging.image.imageUrl} alt="" aria-hidden="true" className="photo-order-ghost" style={{ left: dragging.x - 36, top: dragging.y - 36 }} />}
    <span role="status" className="photo-order-status">{announcement}</span>
  </>
}
