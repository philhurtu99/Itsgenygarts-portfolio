export function readLocalStorage(key, fallback = null) {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}

export function removeLocalStorage(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}

export function readJsonLocalStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJsonLocalStorage(key, value) {
  writeLocalStorage(key, JSON.stringify(value))
}

export function readSessionStorage(key, fallback = null) {
  try {
    return window.sessionStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeSessionStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}

export function removeSessionStorage(key) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}
