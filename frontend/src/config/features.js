function envFlag(value, fallback = false) {
  if (value === undefined) return fallback
  return String(value).trim().toLowerCase() === 'true'
}

export const customOrdersEnabled = envFlag(import.meta.env.VITE_CUSTOM_ORDERS_ENABLED)
