import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'

export default function Footer() {
  const { lang, setLang, t } = useLanguage()
  const { currencies, currency, setCurrency } = useCurrency()

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-row">
          <div className="site-footer-links">
            <p className="site-footer-copyright">
              © {new Date().getFullYear()} Itsgenygarts
            </p>
            <Link to="/faq">{t('faq.title')}</Link>
            <Link to="/legal">{t('legal.nav')}</Link>
            <Link to="/profile?tab=delete">{t('footer.other')}</Link>
          </div>

          <div className="site-footer-controls">
            {currencies.length > 1 && (
              <select
                className="footer-currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="footer-language-button"
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
