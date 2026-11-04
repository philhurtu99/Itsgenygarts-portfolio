import { useEffect, useMemo, useRef, useState } from 'react'
import {
  adminCancelCustomTapToPayPayment,
  adminCreateCustomTapToPayIntent,
  adminCreateMarketCustomOrder,
  adminCreateSessionToken,
  adminGetCustomOrders,
  adminRecordCustomOrderPayment,
  adminSendCustomOrderPaymentLink,
  adminSyncCustomTapToPayPayment,
  adminUploadCustomOrderFinalImage,
  getAdminAuthToken,
  setAdminAuthToken,
} from '../../services/api.js'

const emptyForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerLanguage: 'fr',
  category: 'Commande sur mesure',
  description: '',
  price: '',
  paymentPlan: 'deposit',
  depositMode: 'percent',
  depositPercent: '50',
  depositAmount: '',
  paymentMethod: 'TAP_TO_PAY',
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} $`
}

function financials(order) {
  const total = Math.max(0, Number(order?.price || 0))
  const paid = Math.min(total, Math.max(0, Number(order?.amountPaid || 0)))
  return { total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100) }
}

function paymentAmount(form) {
  const total = Number(form.price || 0)
  if (form.paymentPlan === 'none') return 0
  if (form.paymentPlan === 'full') return total
  if (form.depositMode === 'percent') {
    return Math.round((total * Number(form.depositPercent || 0) / 100) * 100) / 100
  }
  return Math.round(Number(form.depositAmount || 0) * 100) / 100
}

function paymentKindFor(plan) {
  if (plan === 'deposit') return 'DEPOSIT'
  if (plan === 'full') return 'FULL'
  return 'BALANCE'
}

function paymentMethodLabel(method) {
  return {
    CASH: 'Cash',
    E_TRANSFER: 'Virement Interac',
    TAP_TO_PAY: 'Tap to Pay',
    PAYMENT_LINK: 'Lien Stripe',
  }[method] || method
}

export default function CustomMarketPanel() {
  const [form, setForm] = useState(emptyForm)
  const [photos, setPhotos] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [tapPayment, setTapPayment] = useState(null)
  const [balanceOrderId, setBalanceOrderId] = useState(null)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceMethod, setBalanceMethod] = useState('TAP_TO_PAY')
  const [balancePhoto, setBalancePhoto] = useState(null)
  const fileInputRef = useRef(null)
  const isNativeApp = typeof window !== 'undefined' && !!window.ReactNativeWebView

  const photoPreviews = useMemo(() => photos.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  })), [photos])
  const balancePhotoPreview = useMemo(
    () => (balancePhoto ? URL.createObjectURL(balancePhoto) : ''),
    [balancePhoto],
  )

  useEffect(() => () => photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)), [photoPreviews])
  useEffect(() => () => {
    if (balancePhotoPreview) URL.revokeObjectURL(balancePhotoPreview)
  }, [balancePhotoPreview])

  async function loadOrders() {
    try {
      const data = await adminGetCustomOrders({ limit: 100 })
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  useEffect(() => {
    function handleTapStarted(event) {
      if (event.detail?.itemType !== 'custom') return
      setTapPayment((current) => ({
        ...current,
        paymentIntentId: event.detail.paymentIntentId,
        customOrderId: event.detail.customOrderId || current?.customOrderId,
      }))
    }

    function handleTapResult(event) {
      if (event.detail?.itemType !== 'custom') return
      setSaving(false)
      if (event.detail?.success) {
        setMessage('Paiement custom confirmé. Le solde a été mis à jour.')
        setTapPayment(null)
        setBalanceOrderId(null)
        setBalanceAmount('')
        setBalancePhoto(null)
        resetForm()
        loadOrders()
      } else if (event.detail?.cancelled) {
        setTapPayment(null)
      } else {
        setError(event.detail?.message || 'Paiement Tap to Pay échoué.')
        setTapPayment(null)
      }
    }

    window.addEventListener('itsgenygarts:tap-to-pay-started', handleTapStarted)
    window.addEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
    return () => {
      window.removeEventListener('itsgenygarts:tap-to-pay-started', handleTapStarted)
      window.removeEventListener('itsgenygarts:tap-to-pay-result', handleTapResult)
    }
  }, [])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setPhotos([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addPhotos(files) {
    const incoming = Array.from(files || [])
    setPhotos((current) => {
      const next = [...current]
      incoming.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`
        if (!next.some((item) => `${item.name}-${item.size}-${item.lastModified}` === key)) next.push(file)
      })
      return next.slice(0, 5)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePhoto(file) {
    setPhotos((current) => current.filter((item) => item !== file))
  }

  async function startTapToPay(order, amount, kind) {
    setTapPayment({ customOrderId: order.id, amount, kind })
    if (isNativeApp) {
      let token = getAdminAuthToken()
      if (!token) {
        const session = await adminCreateSessionToken()
        token = session.token
        setAdminAuthToken(token)
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'START_TAP_TO_PAY',
        payload: {
          itemType: 'custom',
          token,
          customOrderId: order.id,
          amount,
          kind,
        },
      }))
      return
    }

    const intent = await adminCreateCustomTapToPayIntent(order.id, { amount, kind })
    setTapPayment({ ...intent, customOrderId: order.id, amount, kind })
  }

  async function collectPayment(order, amount, kind, method) {
    if (method === 'TAP_TO_PAY') {
      await startTapToPay(order, amount, kind)
      return { pending: true }
    }
    if (method === 'PAYMENT_LINK') {
      if (!order.customerEmail) throw new Error('Un courriel client est requis pour envoyer un lien de paiement.')
      const result = await adminSendCustomOrderPaymentLink(order.id, { amount, kind })
      setPaymentLink(result.checkoutUrl)
      return { pending: true, link: true }
    }
    await adminRecordCustomOrderPayment(order.id, { amount, kind, method })
    return { pending: false }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setPaymentLink('')
    const total = Number(form.price)
    const amount = paymentAmount(form)
    if (!form.customerName.trim() || !form.description.trim()) {
      setError('Nom et description sont requis.')
      return
    }
    if (form.paymentPlan !== 'none' && form.paymentMethod === 'PAYMENT_LINK' && !form.customerEmail.trim()) {
      setError('Un courriel client est requis pour envoyer un lien de paiement.')
      return
    }
    if (!Number.isFinite(total) || total <= 0) {
      setError('Entre un prix total valide.')
      return
    }
    if (form.paymentPlan !== 'none' && (!Number.isFinite(amount) || amount <= 0 || amount > total)) {
      setError('Le dépôt doit être supérieur à 0 et ne peut pas dépasser le prix total.')
      return
    }

    setSaving(true)
    try {
      const data = new FormData()
      Object.entries({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        customerLanguage: form.customerLanguage,
        category: form.category.trim(),
        description: form.description.trim(),
        price: total.toFixed(2),
      }).forEach(([key, value]) => data.append(key, value))
      photos.forEach((file) => data.append('images', file))
      const order = await adminCreateMarketCustomOrder(data)

      if (form.paymentPlan === 'none') {
        setMessage(`Commande custom #${order.id} enregistrée sans paiement.`)
        resetForm()
        await loadOrders()
        return
      }

      const kind = paymentKindFor(form.paymentPlan)
      const result = await collectPayment(order, amount, kind, form.paymentMethod)
      if (result.link) {
        setMessage(`Commande #${order.id} créée. Le lien de paiement a été envoyé au client.`)
        resetForm()
      } else if (!result.pending) {
        setMessage(`${paymentMethodLabel(form.paymentMethod)} de ${money(amount)} enregistré sur la commande #${order.id}.`)
        resetForm()
      }
      await loadOrders()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    } finally {
      if (!isNativeApp || form.paymentMethod !== 'TAP_TO_PAY') setSaving(false)
    }
  }

  async function handleBalancePayment(order) {
    const { balance } = financials(order)
    const amount = Math.round(Number(balanceAmount || balance) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(`Entre un montant entre 0,01 $ et ${balance.toFixed(2)} $.`)
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    setPaymentLink('')
    try {
      const isFinalBalance = Math.abs(amount - balance) <= 0.001
      if (isFinalBalance && balancePhoto) {
        await adminUploadCustomOrderFinalImage(order.id, balancePhoto)
        setBalancePhoto(null)
      }
      const result = await collectPayment(order, amount, 'BALANCE', balanceMethod)
      if (result.link) {
        setMessage(`Lien de ${money(amount)} envoyé à ${order.customerEmail}.`)
      } else if (!result.pending) {
        setMessage(`Paiement de ${money(amount)} enregistré sur la commande #${order.id}.`)
      }
      if (!result.pending || result.link) {
        setBalanceOrderId(null)
        setBalanceAmount('')
        setBalancePhoto(null)
        await loadOrders()
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    } finally {
      if (!isNativeApp || balanceMethod !== 'TAP_TO_PAY') setSaving(false)
    }
  }

  async function syncTapToPay() {
    if (!tapPayment?.paymentIntentId) return
    setSaving(true)
    try {
      const result = await adminSyncCustomTapToPayPayment(tapPayment.paymentIntentId)
      if (result.status === 'succeeded') {
        setMessage('Paiement custom confirmé. Le solde a été mis à jour.')
        setTapPayment(null)
        setBalanceOrderId(null)
        setBalanceAmount('')
        setBalancePhoto(null)
        resetForm()
        await loadOrders()
      } else {
        setMessage(`Paiement non finalisé: ${result.status}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelTapToPay() {
    const paymentIntentId = tapPayment?.paymentIntentId
    if (isNativeApp) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CANCEL_TAP_TO_PAY',
        payload: { itemType: 'custom', paymentIntentId, token: getAdminAuthToken() || undefined },
      }))
    }
    if (paymentIntentId) await adminCancelCustomTapToPayPayment(paymentIntentId).catch(() => {})
    setTapPayment(null)
    setSaving(false)
  }

  function selectBalanceOrder(order) {
    setBalanceOrderId(order.id)
    setBalanceAmount(financials(order).balance.toFixed(2))
    setBalancePhoto(null)
    setPaymentLink('')
    setError('')
  }

  const openOrders = orders.filter((order) => financials(order).total > 0 && financials(order).balance > 0)
  const deposit = paymentAmount(form)

  return (
    <div className="custom-market-panel">
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="custom-market-section" onSubmit={handleCreate}>
        <div className="custom-market-heading">
          <div>
            <h2>Nouveau custom</h2>
            <p>Crée le dossier, ajoute les photos et encaisse un dépôt si nécessaire.</p>
          </div>
          <span className="badge badge-blue">Sur place</span>
        </div>

        <div className="custom-market-form-grid">
          <label className="form-group">
            <span className="form-label">Nom du client</span>
            <input className="form-input" value={form.customerName} onChange={(e) => updateForm('customerName', e.target.value)} required />
          </label>
          <label className="form-group">
            <span className="form-label">Courriel <small>(facultatif)</small></span>
            <input className="form-input" type="email" value={form.customerEmail} onChange={(e) => updateForm('customerEmail', e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Téléphone <small>(facultatif)</small></span>
            <input className="form-input" type="tel" value={form.customerPhone} onChange={(e) => updateForm('customerPhone', e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Langue des courriels</span>
            <select className="form-input" value={form.customerLanguage} onChange={(e) => updateForm('customerLanguage', e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Nom du projet</span>
            <input className="form-input" value={form.category} onChange={(e) => updateForm('category', e.target.value)} required />
          </label>
          <label className="form-group">
            <span className="form-label">Prix total</span>
            <input className="form-input" type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => updateForm('price', e.target.value)} placeholder="0.00" required />
          </label>
        </div>

        <label className="form-group">
          <span className="form-label">Description</span>
          <textarea className="form-input" rows={4} value={form.description} onChange={(e) => updateForm('description', e.target.value)} placeholder="Dimensions, couleurs, échéance et détails convenus..." required />
        </label>

        <div className="form-group">
          <span className="form-label">Photos</span>
          <input ref={fileInputRef} className="form-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" multiple onChange={(e) => addPhotos(e.target.files)} />
          {photoPreviews.length > 0 && (
            <div className="custom-market-photo-row">
              {photoPreviews.map((preview) => (
                <div key={`${preview.file.name}-${preview.file.lastModified}`}>
                  <img src={preview.url} alt="Aperçu custom" />
                  <button type="button" onClick={() => removePhoto(preview.file)} aria-label="Retirer cette photo">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <fieldset className="custom-market-payment-box">
          <legend>Paiement aujourd’hui</legend>
          <div className="custom-market-segments">
            <button type="button" className={form.paymentPlan === 'none' ? 'is-active' : ''} onClick={() => updateForm('paymentPlan', 'none')}>Aucun</button>
            <button type="button" className={form.paymentPlan === 'deposit' ? 'is-active' : ''} onClick={() => updateForm('paymentPlan', 'deposit')}>Dépôt</button>
            <button type="button" className={form.paymentPlan === 'full' ? 'is-active' : ''} onClick={() => updateForm('paymentPlan', 'full')}>Complet</button>
          </div>

          {form.paymentPlan === 'deposit' && (
            <div className="custom-market-form-grid">
              <label className="form-group">
                <span className="form-label">Calcul du dépôt</span>
                <select className="form-input" value={form.depositMode} onChange={(e) => updateForm('depositMode', e.target.value)}>
                  <option value="percent">Pourcentage</option>
                  <option value="amount">Montant fixe</option>
                </select>
              </label>
              {form.depositMode === 'percent' ? (
                <label className="form-group">
                  <span className="form-label">Pourcentage</span>
                  <input className="form-input" type="number" min="1" max="100" step="1" value={form.depositPercent} onChange={(e) => updateForm('depositPercent', e.target.value)} />
                </label>
              ) : (
                <label className="form-group">
                  <span className="form-label">Montant du dépôt</span>
                  <input className="form-input" type="number" min="0.01" step="0.01" value={form.depositAmount} onChange={(e) => updateForm('depositAmount', e.target.value)} />
                </label>
              )}
            </div>
          )}

          {form.paymentPlan !== 'none' && (
            <div className="custom-market-payment-summary">
              <label className="form-group">
                <span className="form-label">Méthode</span>
                <select className="form-input" value={form.paymentMethod} onChange={(e) => updateForm('paymentMethod', e.target.value)}>
                  <option value="TAP_TO_PAY">Tap to Pay</option>
                  <option value="CASH">Cash</option>
                  <option value="E_TRANSFER">Virement Interac</option>
                  <option value="PAYMENT_LINK" disabled={!form.customerEmail.trim()}>Lien Stripe (courriel requis)</option>
                </select>
              </label>
              <div><span>À encaisser</span><strong>{money(deposit)}</strong></div>
            </div>
          )}
        </fieldset>

        <div className="custom-market-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : form.paymentPlan === 'none' ? 'Créer la commande' : 'Créer et encaisser'}
          </button>
          {tapPayment && (
            <button className="btn btn-secondary" type="button" onClick={cancelTapToPay}>Annuler Tap to Pay</button>
          )}
        </div>
      </form>

      {paymentLink && (
        <div className="custom-market-link-result">
          <input className="form-input" readOnly value={paymentLink} onFocus={(e) => e.target.select()} />
          <button className="btn btn-primary btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(paymentLink)}>Copier le lien</button>
        </div>
      )}

      {!isNativeApp && tapPayment?.paymentIntentId && (
        <div className="custom-market-link-result">
          <span>PaymentIntent: {tapPayment.paymentIntentId}</span>
          <button className="btn btn-primary btn-sm" type="button" onClick={syncTapToPay} disabled={saving}>Vérifier le paiement</button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={cancelTapToPay}>Annuler</button>
        </div>
      )}

      <section className="custom-market-section">
        <div className="custom-market-heading">
          <div>
            <h2>Soldes à encaisser</h2>
            <p>Les dépôts sont conservés; seul le montant restant est proposé.</p>
          </div>
          <span className="badge badge-yellow">{openOrders.length} ouvert{openOrders.length > 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <p className="custom-market-muted">Chargement...</p>
        ) : openOrders.length === 0 ? (
          <p className="custom-market-empty">Aucun solde custom à encaisser.</p>
        ) : (
          <div className="custom-market-balance-list">
            {openOrders.map((order) => {
              const values = financials(order)
              const selected = balanceOrderId === order.id
              const amountToCollect = Math.round(Number(balanceAmount || values.balance) * 100) / 100
              const isFinalBalance = selected && Math.abs(amountToCollect - values.balance) <= 0.001
              const existingFinalImage = [...(order.images || [])]
                .filter((image) => image.purpose === 'FINAL_PRODUCT')
                .sort((a, b) => new Date(b.uploadedAtUtc || 0) - new Date(a.uploadedAtUtc || 0))[0]
              return (
                <article key={order.id} className="custom-market-balance-item">
                  <div className="custom-market-balance-main">
                    {order.images?.[0]?.storagePathOrUrl && <img src={order.images[0].storagePathOrUrl} alt="" />}
                    <div>
                      <strong>{order.customerName}</strong>
                      <span>#{order.id} · {order.category}</span>
                    </div>
                    <div className="custom-market-balance-value">
                      <span>Solde</span>
                      <strong>{money(values.balance)}</strong>
                    </div>
                  </div>
                  <div className="custom-market-progress" aria-label={`${money(values.paid)} payé sur ${money(values.total)}`}>
                    <span style={{ width: `${values.total ? Math.min(100, values.paid / values.total * 100) : 0}%` }} />
                  </div>
                  <div className="custom-market-balance-meta">Payé {money(values.paid)} sur {money(values.total)}</div>
                  {!selected ? (
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => selectBalanceOrder(order)}>Encaisser</button>
                  ) : (
                    <div className="custom-market-collect-row">
                      <label className="form-group">
                        <span className="form-label">Montant</span>
                        <input className="form-input" type="number" min="0.01" max={values.balance} step="0.01" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
                      </label>
                      <label className="form-group">
                        <span className="form-label">Méthode</span>
                        <select className="form-input" value={balanceMethod} onChange={(e) => setBalanceMethod(e.target.value)}>
                          <option value="TAP_TO_PAY">Tap to Pay</option>
                          <option value="CASH">Cash</option>
                          <option value="E_TRANSFER">Virement Interac</option>
                          <option value="PAYMENT_LINK" disabled={!order.customerEmail}>Lien Stripe (courriel requis)</option>
                        </select>
                      </label>
                      {isFinalBalance && (
                        <label className="form-group custom-market-final-photo">
                          <span className="form-label">Photo du produit terminé <small>(optionnelle)</small></span>
                          <input
                            className="form-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={(event) => setBalancePhoto(event.target.files?.[0] || null)}
                          />
                          {(balancePhotoPreview || existingFinalImage?.storagePathOrUrl) && (
                            <img src={balancePhotoPreview || existingFinalImage.storagePathOrUrl} alt="Produit terminé" />
                          )}
                        </label>
                      )}
                      <button className="btn btn-primary" type="button" disabled={saving} onClick={() => handleBalancePayment(order)}>Encaisser</button>
                      <button className="btn btn-secondary" type="button" onClick={() => {
                        setBalanceOrderId(null)
                        setBalancePhoto(null)
                      }}>Fermer</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
