import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrencies } from '../services/api.js'
import { readLocalStorage, writeLocalStorage } from '../utils/browserStorage.js'

const CurrencyContext = createContext()

export function CurrencyProvider({ children }) {
  const [currencies, setCurrencies] = useState([])
  const [currency, setCurrencyState] = useState(() => readLocalStorage('currency', 'CAD'))

  useEffect(() => {
    getCurrencies()
      .then((data) => setCurrencies(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  function setCurrency(code) {
    setCurrencyState(code)
    writeLocalStorage('currency', code)
  }

  const current = currencies.find((c) => c.code === currency)
  const rate = current ? Number(current.rate) : 1
  const symbol = current ? current.symbol : '$'

  function formatPrice(amountCAD) {
    return `${(Number(amountCAD) * rate).toFixed(2)} ${symbol}`
  }

  return (
    <CurrencyContext.Provider value={{ currencies, currency, setCurrency, rate, symbol, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
