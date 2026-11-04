import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react'

export const PRODUCT_STEPS = ['Informations', 'Photos', 'Expédition', 'Publication']
const ERROR_STEPS = { name: 0, price: 0, stock: 0, images: 1, package: 2, customs: 2 }

export function errorsForStep(errors, step) {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => step === undefined || ERROR_STEPS[key] === step))
}

export function WizardStep({ index, activeStep, children }) {
  return <section hidden={activeStep !== index} className="product-wizard-step">{children}</section>
}

export default function ProductWizard({ title, onClose, onSave, validate, busy, saving, apiError, saveStatus, quickSave = false, children }) {
  const [step, setStep] = useState(0)
  const bodyRef = useRef(null)
  const titleRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    titleRef.current?.focus({ preventScroll: true })
  }, [step])

  function moveTo(next) {
    if (busy) return
    if (next > step && Object.keys(validate(step)).length) return
    setStep(next)
  }

  function save() {
    if (busy || saving) return
    const errors = validate()
    const invalidStep = Object.keys(errors).map((key) => ERROR_STEPS[key]).find((index) => index !== undefined)
    if (invalidStep !== undefined) {
      setStep(invalidStep)
      return
    }
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()} onKeyDown={(e) => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose() }
      if (e.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex="0"]')]
          .filter((el) => !el.disabled && el.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
          e.preventDefault(); last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus()
        }
      }
    }}>
      <div className="modal product-wizard" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <div className="product-wizard-header-actions">
            {quickSave && (
              <button type="button" className="modal-close product-wizard-save" onClick={save} disabled={busy || saving}
                aria-label={saving ? 'Sauvegarde en cours' : 'Sauvegarder le produit'}
                title={saving ? 'Sauvegarde en cours…' : 'Sauvegarder le produit'}>
                <Save size={20} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fermer">×</button>
          </div>
        </div>
        {saveStatus && <div role="status" className={`product-wizard-autosave ${saveStatus.state}`}>
          {saveStatus.text}
          {saveStatus.state === 'error' && <button type="button" className="btn btn-secondary btn-sm" onClick={saveStatus.flush}>Réessayer</button>}
        </div>}
        <nav className="product-wizard-progress" aria-label="Étapes du produit">
          {PRODUCT_STEPS.map((label, index) => (
            <button key={label} type="button" className={`product-wizard-tab${step === index ? ' active' : ''}`}
              aria-current={step === index ? 'step' : undefined} aria-label={`${index + 1}. ${label}`}
              disabled={busy} onClick={() => moveTo(index)}>
              <span className="product-wizard-number">{index + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="modal-body" ref={bodyRef}>
          {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}
          <h2 className="product-wizard-heading" ref={titleRef} tabIndex={-1}>{PRODUCT_STEPS[step]}</h2>
          {children(step)}
        </div>
        <div className="modal-footer product-wizard-footer">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => step ? moveTo(step - 1) : onClose()}>
            {step > 0 && <ArrowLeft size={18} aria-hidden="true" />}{step ? 'Précédent' : saveStatus ? 'Fermer' : 'Annuler'}
          </button>
          {step < PRODUCT_STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => moveTo(step + 1)}>
              Suivant <ArrowRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
              <Check size={18} aria-hidden="true" />{saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
