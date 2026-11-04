import { useState } from 'react'
import { shouldApplyCustomerPrefillFromInput } from '../utils/customerPrefill.js'

export default function CustomerPrefillInput({
  value,
  suggestion,
  onChange,
  onSelectSuggestion,
  ...props
}) {
  const [focused, setFocused] = useState(false)
  const showSuggestion = focused
    && shouldApplyCustomerPrefillFromInput(value, suggestion)
    && String(value || '') !== String(suggestion || '')

  function selectSuggestion(event) {
    event.preventDefault()
    setFocused(false)
    onSelectSuggestion?.(suggestion)
  }

  return (
    <div className="customer-prefill-field">
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (showSuggestion && event.key === 'Enter') {
            selectSuggestion(event)
          } else if (event.key === 'Escape') {
            setFocused(false)
          }
          props.onKeyDown?.(event)
        }}
        aria-autocomplete="list"
      />
      {showSuggestion && (
        <button
          type="button"
          className="customer-prefill-suggestion"
          onMouseDown={(event) => event.preventDefault()}
          onClick={selectSuggestion}
        >
          {suggestion}
        </button>
      )}
    </div>
  )
}
