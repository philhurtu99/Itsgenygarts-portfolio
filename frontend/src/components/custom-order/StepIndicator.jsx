export default function StepIndicator({ current, t }) {
  const steps = t('custom.steps')

  return (
    <div className="steps">
      {steps.map((step, index) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
          <div className={`step${index === current ? ' active' : index < current ? ' done' : ''}`}>
            <span className="step-num">{index < current ? '✓' : index + 1}</span>
            {step}
          </div>
          {index < steps.length - 1 && <span className="step-arrow">›</span>}
        </div>
      ))}
    </div>
  )
}
