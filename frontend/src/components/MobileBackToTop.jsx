import { useEffect, useState } from 'react'

export default function MobileBackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function updateVisibility() {
      setVisible(window.scrollY > 420)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      className={`mobile-back-to-top${visible ? ' visible' : ''}`}
      onClick={scrollToTop}
      aria-label="Retour en haut"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  )
}
