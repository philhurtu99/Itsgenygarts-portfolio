export default function ProductSummary({ form, photoCount, kind = 'product' }) {
  return (
    <dl className="product-wizard-summary">
      <dt>Nom français</dt><dd>{form.nameFr || '—'}</dd>
      <dt>Nom anglais</dt><dd>{form.nameEn || '—'}</dd>
      <dt>Prix</dt><dd>{Number(form.price || 0).toFixed(2)} $ CAD</dd>
      <dt>{kind === 'yarn' ? 'Stock' : 'Variations'}</dt><dd>{kind === 'yarn' ? Number(form.stock || 0) : form.stock || 1}</dd>
      <dt>Photos</dt><dd>{photoCount}</dd>
      <dt>Colis</dt><dd>{form.packageWeightGrams ? `${form.packageWeightGrams} g · ${form.packageLengthCm} × ${form.packageWidthCm} × ${form.packageHeightCm} cm` : 'Non renseigné'}</dd>
      <dt>Douanes</dt><dd>{!form.customsHsCode ? 'Non configurées'
        : !form.customsOriginCountry || !Number(form.customsWeightGrams) ? `À compléter · ${[!form.customsOriginCountry ? 'pays de fabrication' : '', !Number(form.customsWeightGrams) ? 'poids de l’article' : ''].filter(Boolean).join(' et ')}`
          : `${form.customsProfileKey ? 'Profil préconfiguré' : 'Réglages personnalisés'} · ${form.customsOriginCountry} · ${form.customsWeightGrams} g nets`}</dd>
    </dl>
  )
}
