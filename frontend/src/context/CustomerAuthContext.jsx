import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getCustomerProfile, customerLogout } from '../services/api.js'
import { removeLocalStorage, writeJsonLocalStorage } from '../utils/browserStorage.js'

const CustomerAuthContext = createContext(null)

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCustomerProfile()
      .then((profile) => {
        if (cancelled) return
        writeJsonLocalStorage('customer_info', profile)
        setCustomer(profile)
      })
      .catch(() => {
        if (cancelled) return
        removeLocalStorage('customer_info')
        setCustomer(null)
      })
      .finally(() => !cancelled && setReady(true))
    return () => { cancelled = true }
  }, [])

  const loginCustomer = useCallback((customerInfo) => {
    writeJsonLocalStorage('customer_info', customerInfo)
    setCustomer(customerInfo)
  }, [])

  const logoutCustomer = useCallback(async () => {
    try { await customerLogout() } catch { /* ignore */ }
    removeLocalStorage('customer_info')
    setCustomer(null)
  }, [])

  const isLoggedIn = !!customer

  return (
    <CustomerAuthContext.Provider value={{ customer, loginCustomer, logoutCustomer, isLoggedIn, ready }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}
