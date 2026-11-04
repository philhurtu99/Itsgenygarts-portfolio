import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { readJsonLocalStorage, writeJsonLocalStorage } from '../utils/browserStorage.js'

const CookieConsentContext = createContext(null)

const STORAGE_KEY = 'cookie_consent_v1'

const DEFAULT_CONSENT = {
  essential: true,
  analytics: false,
  marketing: false,
  decided: false,
  updatedAt: null,
}

function loadConsent() {
  const parsed = readJsonLocalStorage(STORAGE_KEY, null)
  return parsed ? { ...DEFAULT_CONSENT, ...parsed, essential: true } : DEFAULT_CONSENT
}

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(loadConsent)

  useEffect(() => {
    writeJsonLocalStorage(STORAGE_KEY, consent)
  }, [consent])

  const acceptAll = useCallback(() => {
    setConsent({ essential: true, analytics: true, marketing: true, decided: true, updatedAt: new Date().toISOString() })
  }, [])

  const rejectAll = useCallback(() => {
    setConsent({ essential: true, analytics: false, marketing: false, decided: true, updatedAt: new Date().toISOString() })
  }, [])

  const savePreferences = useCallback((prefs) => {
    setConsent({
      essential: true,
      analytics: Boolean(prefs.analytics),
      marketing: Boolean(prefs.marketing),
      decided: true,
      updatedAt: new Date().toISOString(),
    })
  }, [])

  const reopen = useCallback(() => {
    setConsent((c) => ({ ...c, decided: false }))
  }, [])

  return (
    <CookieConsentContext.Provider value={{ consent, acceptAll, rejectAll, savePreferences, reopen }}>
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider')
  return ctx
}
