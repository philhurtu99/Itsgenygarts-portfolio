import { render, screen } from '@testing-library/react';
import { TermsFRSection, TermsENSection } from '../../src/pages/legal/Terms.jsx';
import { PrivacyFRSection, PrivacyENSection } from '../../src/pages/legal/Privacy.jsx';
import { MentionsFRSection, MentionsENSection } from '../../src/pages/legal/Mentions.jsx';
import { siteConfig } from '../../src/config/site.js';

jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ t: (key) => key, lang: 'fr' }),
}));

it.each([
  [TermsFRSection, PrivacyFRSection, MentionsFRSection],
  [TermsENSection, PrivacyENSection, MentionsENSection],
])('keeps public legal sections free of the merchant address, phone and developer warnings', (Terms, Privacy, Mentions) => {
  const { container } = render(<><Terms /><Privacy /><Mentions /></>);
  expect(container).not.toHaveTextContent(siteConfig.businessAddress);
  expect(container).not.toHaveTextContent(/578.*8319/);
  expect(container).not.toHaveTextContent(/Configuration légale incomplète|Legal configuration incomplete|VITE_|\[full business address\]|\[server location\]/);
  expect(screen.getByRole('link', { name: siteConfig.contactEmail })).toHaveAttribute('href', `mailto:${siteConfig.contactEmail}`);
  expect(screen.getByRole('link', { name: /retours|Returns Policy/ })).toHaveAttribute('href', '/legal/returns');
});
