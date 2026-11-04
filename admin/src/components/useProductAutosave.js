import { useEffect, useRef, useState } from 'react'

const changedFields = (next, previous) => Object.fromEntries(Object.entries(next)
  .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])))

// Send only modified fields, in order, without replacing newer edits with a response.
export default function useProductAutosave({ enabled, values, save, paused, validationError }) {
  const baseline = useRef(JSON.parse(JSON.stringify(values)))
  const latest = useRef(null)
  const inFlight = useRef(null)
  const timer = useRef(null)
  const mounted = useRef(true)
  const [status, setStatus] = useState({ state: 'idle', text: 'Sauvegarde automatique activée' })
  const [revision, setRevision] = useState(0)
  const encoded = JSON.stringify(values)
  latest.current = { enabled, values, save, paused, validationError }

  async function flush() {
    clearTimeout(timer.current)
    if (inFlight.current) {
      const success = await inFlight.current
      return success ? flush() : false
    }
    const current = latest.current
    if (!current.enabled) return true
    const patch = changedFields(current.values, baseline.current)
    if (!Object.keys(patch).length) return true
    if (current.validationError || current.paused) {
      setStatus({ state: 'pending', text: current.validationError || 'En attente de la fin de l’opération…' })
      return false
    }
    setStatus({ state: 'saving', text: 'Enregistrement…' })
    inFlight.current = (async () => {
      try {
        await current.save(patch)
        Object.assign(baseline.current, patch)
        if (mounted.current) {
          setStatus({ state: 'saved', text: 'Modifications enregistrées' })
          setRevision(value => value + 1)
        }
        return true
      } catch (error) {
        if (mounted.current) setStatus({ state: 'error', text: `Non enregistré : ${error.message}` })
        return false
      } finally {
        inFlight.current = null
      }
    })()
    return inFlight.current
  }

  useEffect(() => {
    if (!enabled || !Object.keys(changedFields(values, baseline.current)).length) return
    if (inFlight.current || paused) return
    setStatus({ state: 'pending', text: validationError || 'Modifications en attente…' })
    if (validationError) return
    timer.current = setTimeout(flush, 700)
    return () => clearTimeout(timer.current)
  }, [encoded, enabled, paused, validationError, revision])

  useEffect(() => {
    mounted.current = true
    const warnUnsaved = event => {
      const current = latest.current
      if (current.enabled && (inFlight.current || Object.keys(changedFields(current.values, baseline.current)).length)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnUnsaved)
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
      window.removeEventListener('beforeunload', warnUnsaved)
    }
  }, [])
  return { ...status, flush, waitForCurrent: () => inFlight.current || Promise.resolve() }
}
