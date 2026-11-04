import { useEffect, useState, useMemo } from 'react'
import { AdminSidebar } from './Dashboard.jsx'
import { adminGetNewsletterStats, adminSendNewsletter } from '../../services/api.js'

const EMAIL_BRAND = {
  name: 'Itsgenygarts',
  email: import.meta.env.VITE_BUSINESS_EMAIL || import.meta.env.VITE_CONTACT_EMAIL || '',
  primary: '#DD7A8F',
  primaryDark: '#C4607A',
  secondary: '#6FC7CE',
  accent: '#FFFAF0',
  text: '#2C2018',
  muted: '#8A7A6A',
}

function escHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailHtml(lang, subject, body) {
  const biz = EMAIL_BRAND
  const en = lang === 'en'
  const copy = {
    htmlLang: en ? 'en' : 'fr',
    tagline: en ? 'Handmade crochet creations' : 'Créations crochet artisanales',
    greeting: en ? 'Hello' : 'Bonjour',
    previewName: en ? 'Customer first name' : 'Prénom client',
    emptyContent: en ? '(empty content)' : '(contenu vide)',
    receivedBecause: en
      ? 'You are receiving this email because you placed an order, requested a quote, created an account, or agreed to receive our news.'
      : 'Vous recevez cet email car vous avez passé une commande, demandé un devis, créé un compte ou accepté de recevoir nos nouvelles.',
    unsubscribeStart: en ? 'You can' : 'Vous pouvez',
    unsubscribeLink: en ? 'unsubscribe from newsletters' : 'vous désabonner des infolettres',
    unsubscribeEnd: en
      ? 'Order, quote, and payment emails will continue to be sent.'
      : "Les courriels liés à vos commandes, devis et paiements continueront d'être envoyés.",
  }
  const htmlBody = String(body || '')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('') || `<p style="margin:0 0 16px;">${escHtml(copy.emptyContent)}</p>`

  return `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${biz.accent};font-family:Arial,Helvetica,sans-serif;color:${biz.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(subject)} - ${escHtml(biz.name)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${biz.accent};border-collapse:collapse;">
    <tr>
      <td style="padding:32px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #F1D6DD;box-shadow:0 10px 30px rgba(44,32,24,0.10);border-collapse:separate;">
                <tr>
                  <td style="background:${biz.primary};padding:28px 30px;border-bottom:5px solid ${biz.secondary};">
                    <p style="margin:0 0 6px;color:rgba(255,255,255,0.78);font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;">${escHtml(copy.tagline)}</p>
                    <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.1;font-weight:800;">${escHtml(biz.name)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:34px 30px;color:${biz.text};font-size:16px;line-height:1.7;">
                    <h2 style="margin:0 0 18px;color:${biz.text};font-size:22px;line-height:1.25;font-weight:800;">${escHtml(subject)}</h2>
                    <p style="margin:0 0 16px;">${escHtml(copy.greeting)} <strong>${escHtml(copy.previewName)}</strong>,</p>
                    <div style="color:${biz.text};">
                      ${htmlBody}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background:#FFF5F7;padding:22px 30px;border-top:1px solid #F1D6DD;font-size:13px;color:${biz.muted};line-height:1.6;">
                    <p style="margin:0 0 6px;font-weight:700;color:${biz.text};">${escHtml(biz.name)}</p>
                    ${biz.email ? `<p style="margin:0 0 6px;"><a href="mailto:${escHtml(biz.email)}" style="color:${biz.primaryDark};text-decoration:none;font-weight:700;">${escHtml(biz.email)}</a></p>` : ''}
                    <p style="margin:0 0 8px;font-size:12px;">${escHtml(copy.receivedBecause)}</p>
                    <p style="margin:0;font-size:12px;">${escHtml(copy.unsubscribeStart)} <a href="#" style="color:${biz.primaryDark};font-weight:700;text-decoration:underline;">${escHtml(copy.unsubscribeLink)}</a>. ${escHtml(copy.unsubscribeEnd)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export default function Newsletter() {
  const [stats, setStats] = useState(null)
  const [form, setForm] = useState({
    subjectFr: '',
    bodyFr: '',
    subjectEn: '',
    bodyEn: '',
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLang, setPreviewLang] = useState('fr')

  useEffect(() => {
    adminGetNewsletterStats()
      .then((data) => setStats(data))
      .catch(() => {})
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setResult(null)
    setError(null)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!hasContent) return
    setSending(true)
    setResult(null)
    setError(null)
    try {
      const data = await adminSendNewsletter(form)
      setResult(data)
      setForm({ subjectFr: '', bodyFr: '', subjectEn: '', bodyEn: '' })
      setShowPreview(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const previewSubject = previewLang === 'en' ? form.subjectEn : form.subjectFr
  const previewBody = previewLang === 'en' ? form.bodyEn : form.bodyFr
  const previewHtml = useMemo(
    () => buildEmailHtml(
      previewLang,
      previewSubject || (previewLang === 'en' ? '(no subject)' : '(sans sujet)'),
      previewBody || (previewLang === 'en' ? '(empty content)' : '(contenu vide)')
    ),
    [previewLang, previewSubject, previewBody]
  )

  const hasContent =
    form.subjectFr.trim() &&
    form.bodyFr.trim() &&
    form.subjectEn.trim() &&
    form.bodyEn.trim()

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Infolettre</h1>
        </div>

        <div style={{ maxWidth: showPreview ? '100%' : 700 }}>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '1.75rem' }}>📧</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{stats ? stats.count : '—'}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                abonné{stats?.count !== 1 ? 's' : ''} actif{stats?.count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {stats?.count === 0 && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              Aucun client n'a consenti à recevoir des infolettres pour l'instant.
            </div>
          )}

          <div className={`newsletter-grid${showPreview ? ' has-preview' : ''}`}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Rédiger et envoyer</h2>

              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              {result && (
                <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                  ✓ Envoyé à {result.sent} / {result.total} abonné{result.total !== 1 ? 's' : ''}
                </div>
              )}

              <form onSubmit={handleSend}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem' }}>Version française</h3>
                    <div className="form-group">
                      <label className="form-label">Sujet français <span className="required-mark">*</span></label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.subjectFr}
                        onChange={(e) => set('subjectFr', e.target.value)}
                        placeholder="Sujet de l'infolettre"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contenu français <span className="required-mark">*</span></label>
                      <textarea
                        className="form-input"
                        value={form.bodyFr}
                        onChange={(e) => set('bodyFr', e.target.value)}
                        rows={8}
                        placeholder="Rédigez votre message en français..."
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        required
                      />
                    </div>
                  </section>

                  <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem' }}>English version</h3>
                    <div className="form-group">
                      <label className="form-label">English subject <span className="required-mark">*</span></label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.subjectEn}
                        onChange={(e) => set('subjectEn', e.target.value)}
                        placeholder="Newsletter subject"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">English content <span className="required-mark">*</span></label>
                      <textarea
                        className="form-input"
                        value={form.bodyEn}
                        onChange={(e) => set('bodyEn', e.target.value)}
                        rows={8}
                        placeholder="Write your message in English..."
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        required
                      />
                    </div>
                  </section>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPreview((v) => !v)}
                    disabled={!hasContent}
                  >
                    {showPreview ? 'Masquer l\'aperçu' : 'Aperçu courriel'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending || !hasContent}
                  >
                    {sending ? 'Envoi en cours…' : `Envoyer à ${stats?.count ?? '—'} abonné${stats?.count !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            </div>

            {showPreview && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    Aperçu — tel qu'il apparaîtra dans la boîte de réception
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn ${previewLang === 'fr' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPreviewLang('fr')}
                    >
                      Français
                    </button>
                    <button
                      type="button"
                      className={`btn ${previewLang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPreviewLang('en')}
                    >
                      English
                    </button>
                  </div>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  title="Aperçu infolettre"
                  style={{
                    width: '100%',
                    height: 600,
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: '#f9f5f2',
                  }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
