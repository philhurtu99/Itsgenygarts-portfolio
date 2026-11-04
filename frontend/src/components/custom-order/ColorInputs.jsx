export default function ColorInputs({ colors, onChange, t }) {
  function updateColor(idx, hex) {
    const next = [...colors]
    next[idx] = hex
    onChange(next)
  }

  function removeColor(idx) {
    onChange(colors.filter((_, i) => i !== idx))
  }

  function addColor() {
    if (colors.length < 5) onChange([...colors, '#ffffff'])
  }

  return (
    <div>
      <div className="color-inputs">
        {colors.map((color, index) => (
          <div key={index} className="color-input-group">
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(index, e.target.value)}
            />
            <input
              type="text"
              value={color}
              maxLength={7}
              onChange={(e) => {
                const value = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) updateColor(index, value)
              }}
            />
            <button type="button" className="color-input-remove" onClick={() => removeColor(index)}>×</button>
          </div>
        ))}
        {colors.length < 5 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={addColor}>
            {t('custom.addColor')}
          </button>
        )}
      </div>
    </div>
  )
}
