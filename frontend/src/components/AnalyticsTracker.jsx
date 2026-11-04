import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useCookieConsent } from '../context/CookieConsentContext.jsx'
import { trackPageView } from '../services/api.js'

export default function AnalyticsTracker() {
  const location = useLocation()
  const { consent } = useCookieConsent()

  useEffect(() => {
    if (!consent.analytics) return

    const path = `${location.pathname}${location.search}`
    trackPageView({
      path,
      referrer: document.referrer || null,
    }).catch(() => {})
  }, [consent.analytics, location.pathname, location.search])

  return null
}
