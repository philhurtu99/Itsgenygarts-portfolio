import { createContext, useContext, useState, useCallback } from 'react'
import fr from '../i18n/fr.js'
import en from '../i18n/en.js'
import { readLocalStorage, writeLocalStorage } from '../utils/browserStorage.js'

const translations = { fr, en }
const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = readLocalStorage('lang')
    if (saved === 'fr' || saved === 'en') return saved
    const browserLang = navigator.language?.slice(0, 2)
    return browserLang === 'en' ? 'en' : 'fr'
  })

  function setLang(code) {
    if (code !== 'fr' && code !== 'en') return
    setLangState(code)
    writeLocalStorage('lang', code)
  }

  const t = useCallback((key, vars) => {
    const keys = key.split('.')
    let val = translations[lang]
    for (const k of keys) {
      val = val?.[k]
      if (val === undefined) break
    }
    if (val === undefined) {
      let fallback = translations.fr
      for (const k of keys) {
        fallback = fallback?.[k]
        if (fallback === undefined) break
      }
      val = fallback ?? key
    }
    if (typeof val === 'string' && vars) {
      return val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
    }
    return val
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
