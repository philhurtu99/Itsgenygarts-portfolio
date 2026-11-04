export default function OptionsEditor({ options, onChange }) {
  function updateTitle(idx, field, value) {
    onChange(
      options.map((o, i) => {
        if (i !== idx) return o
        const next = { ...o, [field]: value }
        next.name = next.nameFr || next.nameEn || next.name || ''
        return next
      }),
    )
  }

  function addChoice(idx) {
    onChange(
      options.map((o, i) =>
        i === idx
          ? { ...o, choices: [...o.choices, { label: '', value: '' }] }
          : o,
      ),
    )
  }

  function updateChoice(optIdx, choiceIdx, field, value) {
    onChange(
      options.map((o, i) =>
        i === optIdx
          ? {
              ...o,
              choices: o.choices.map((c, j) =>
                j === choiceIdx ? { ...c, [field]: value } : c,
              ),
            }
          : o,
      ),
    )
  }

  function removeChoice(optIdx, choiceIdx) {
    onChange(
      options.map((o, i) =>
        i === optIdx
          ? { ...o, choices: o.choices.filter((_, j) => j !== choiceIdx) }
          : o,
      ),
    )
  }

  function removeOption(idx) {
    onChange(options.filter((_, i) => i !== idx))
  }

  function addOption() {
    onChange([...options, { name: '', nameFr: '', nameEn: '', choices: [] }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {options.map((opt, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '0.75rem',
          }}
        >
          <div style={{ marginBottom: '0.6rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'end',
              }}
            >
              <label style={{ display: 'flex', flex: '1 1 190px', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Titre français
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: Grandeur"
                  value={opt.nameFr || opt.name || ''}
                  onChange={(e) => updateTitle(i, 'nameFr', e.target.value)}
                  style={{ fontWeight: 600 }}
                />
              </label>
              <label style={{ display: 'flex', flex: '1 1 190px', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Titre anglais
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: Size"
                  value={opt.nameEn || ''}
                  onChange={(e) => updateTitle(i, 'nameEn', e.target.value)}
                  style={{ fontWeight: 600 }}
                />
              </label>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeOption(i)}>
                Supprimer
              </button>
            </div>
          </div>

          {opt.choices.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                paddingLeft: '0.25rem',
                marginBottom: '0.2rem',
              }}
            >
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Français
              </span>
              <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Anglais
              </span>
              <span style={{ width: 32 }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.25rem' }}>
            {opt.choices.map((c, j) => (
              <div key={j} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: Petit"
                  value={typeof c === 'string' ? c : c.label}
                  onChange={(e) => updateChoice(i, j, 'label', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: Small"
                  value={typeof c === 'string' ? c : c.value}
                  onChange={(e) => updateChoice(i, j, 'value', e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeChoice(i, j)}
                  style={{ flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addChoice(i)}
              style={{ alignSelf: 'flex-start', marginTop: '0.15rem' }}
            >
              + Choix
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addOption}>
        + Ajouter une option
      </button>
    </div>
  )
}
