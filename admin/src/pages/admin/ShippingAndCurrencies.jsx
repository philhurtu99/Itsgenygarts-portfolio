import { useEffect, useState } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import Loader from '../../components/Loader.jsx'
import { msg } from '../../utils/messages.js'
import {
  adminGetShippingZones,
  adminCreateShippingZone,
  adminUpdateShippingZone,
  adminDeleteShippingZone,
  adminGetCurrencies,
  adminCreateCurrency,
  adminUpdateCurrency,
  adminDeleteCurrency,
} from '../../services/api.js'

// ── Shipping Zones ───────────────────────────────────────────────────────────

function ZoneModal({ zone, onClose, onSave }) {
  const [form, setForm] = useState({
    name: zone?.name || '',
    countries: zone?.countries || '',
    isActive: zone?.isActive !== false,
    displayOrder: zone?.displayOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function handleSave() {
    if (!form.name.trim() || !form.countries.trim()) {
      setError(msg('nameCountriesRequired'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        countries: form.countries.trim(),
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder) || 0,
      }, zone?.id)
      onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">{zone ? 'Modifier la zone' : 'Nouvelle zone'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Nom <span className="required-mark">*</span></label>
            <input type="text" className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ex: Québec, Canada, États-Unis..." />
          </div>
          <div className="form-group">
            <label className="form-label">Pays / Codes <span className="required-mark">*</span></label>
            <input type="text" className="form-input" value={form.countries} onChange={(e) => set('countries', e.target.value)} placeholder="ex: CA-QC, CA, US, *" />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Codes pays ISO ou * pour international. Séparer par virgule.
            </p>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label className="form-label">Ordre</label>
              <input type="number" min="0" className="form-input" value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                Active
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Sauvegarder'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Currency ─────────────────────────────────────────────────────────────────

function CurrencyModal({ currency, onClose, onSave }) {
  const [form, setForm] = useState({
    code: currency?.code || '',
    symbol: currency?.symbol || '',
    rate: currency?.rate ?? '',
    isActive: currency?.isActive !== false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function handleSave() {
    if (!form.code.trim() || !form.symbol.trim() || !form.rate) {
      setError(msg('allFieldsRequired'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        code: form.code.trim().toUpperCase(),
        symbol: form.symbol.trim(),
        rate: Number(form.rate),
        isActive: form.isActive,
      }, currency?.id)
      onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">{currency ? 'Modifier la devise' : 'Nouvelle devise'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Code <span className="required-mark">*</span></label>
              <input type="text" className="form-input" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="CAD" maxLength={3} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Symbole <span className="required-mark">*</span></label>
              <input type="text" className="form-input" value={form.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="$" maxLength={5} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Taux (1 CAD = ?) <span className="required-mark">*</span></label>
            <input type="number" step="0.000001" min="0" className="form-input" value={form.rate} onChange={(e) => set('rate', e.target.value)} placeholder="1.000000" />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Taux par rapport au CAD. Ex: USD = 0.74, EUR = 0.68
            </p>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active (visible côté client)
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Sauvegarder'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function AdminShippingAndCurrencies() {
  const [zones, setZones] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [zoneModal, setZoneModal] = useState(undefined)
  const [currencyModal, setCurrencyModal] = useState(undefined)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [z, c] = await Promise.all([
        adminGetShippingZones(),
        adminGetCurrencies(),
      ])
      setZones(Array.isArray(z) ? z : [])
      setCurrencies(Array.isArray(c) ? c : [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSaveZone(data, id) {
    if (id) await adminUpdateShippingZone(id, data)
    else await adminCreateShippingZone(data)
    await load()
  }

  async function handleSaveCurrency(data, id) {
    if (id) await adminUpdateCurrency(id, data)
    else await adminCreateCurrency(data)
    await load()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      if (confirmDelete.type === 'zone') await adminDeleteShippingZone(confirmDelete.id)
      else await adminDeleteCurrency(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Livraison & Devises</h1>
        </div>

        {loading && <Loader label="Chargement..." />}

        {!loading && (
          <>
            {/* ── Zones de livraison ── */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div className="admin-section-header">
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Zones de livraison</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setZoneModal(null)}>+ Nouvelle zone</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Pays / Codes</th>
                      <th>Ordre</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>Aucune zone</td></tr>
                    ) : zones.map((z) => (
                      <tr key={z.id}>
                        <td data-label="Nom" style={{ fontWeight: 600 }}>{z.name}</td>
                        <td data-label="Pays / Codes" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{z.countries}</td>
                        <td data-label="Ordre">{z.displayOrder}</td>
                        <td data-label="Statut">{z.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setZoneModal(z)}>Modifier</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'zone', id: z.id, name: z.name })}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Devises ── */}
            <div>
              <div className="admin-section-header">
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Devises</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setCurrencyModal(null)}>+ Nouvelle devise</button>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Symbole</th>
                      <th>Taux (1 CAD =)</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>Aucune devise</td></tr>
                    ) : currencies.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Code" style={{ fontWeight: 600 }}>{c.code}</td>
                        <td data-label="Symbole">{c.symbol}</td>
                        <td data-label="Taux" style={{ fontFamily: 'monospace' }}>{Number(c.rate).toFixed(6)}</td>
                        <td data-label="Statut">{c.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setCurrencyModal(c)}>Modifier</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'currency', id: c.id, name: c.code })}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {zoneModal !== undefined && (
          <ZoneModal zone={zoneModal} onClose={() => setZoneModal(undefined)} onSave={handleSaveZone} />
        )}
        {currencyModal !== undefined && (
          <CurrencyModal currency={currencyModal} onClose={() => setCurrencyModal(undefined)} onSave={handleSaveCurrency} />
        )}

        {confirmDelete && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <span className="modal-title">Confirmer la suppression</span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)}>×</button>
              </div>
              <div className="modal-body"><p>Supprimer <strong>{confirmDelete.name}</strong> ?</p></div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={handleDelete}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
