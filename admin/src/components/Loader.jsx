export default function Loader({ label = 'Chargement...' }) {
  return (
    <div className="loading" role="status" aria-label={label}>
      <div className="site-spinner" aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
      <span className="loading-label">{label}</span>
    </div>
  )
}
