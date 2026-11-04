import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CategoryModal from '../../src/components/CategoryModal.jsx';
import { adminGetCustomsProfiles } from '../../src/services/api.js';
jest.mock('../../src/services/api.js', () => ({ adminGetCustomsProfiles: jest.fn() }));
const profiles = [
  { key: 'hat', kind: 'product', name: 'Bonnet', scope: '100 % acrylique' },
  { key: 'yarn', kind: 'yarn', name: 'Fil acrylique', scope: '100 % acrylique' },
];
beforeEach(() => adminGetCustomsProfiles.mockReset().mockResolvedValue(profiles));

it('sets a simple bandana default in one choice without asking for fibres', async () => {
  adminGetCustomsProfiles.mockResolvedValue([{ key: 'international-crocheted-scarf', kind: 'product', internationalOnly: true,
    name: 'Bandana au crochet', articleType: 'flat-scarf', articleLabel: 'Bandana au crochet', hsCode: '611710' }]);
  const onSave = jest.fn(async () => ({}));
  render(<CategoryModal category={{ id: 1, nameFr: 'Bandana', nameEn: 'Bandana' }} onSave={onSave} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Oui, c’est ça' }));
  expect(screen.queryByLabelText('Composition du produit fini')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pays de fabrication par défaut'), { target: { value: 'CA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nameFr: 'Bandana', customsProfileKey: 'international-crocheted-scarf', customsOriginCountry: 'CA' })));
});

it('saves a category association while preserving bilingual data', async () => {
  const onSave = jest.fn(async () => ({}));
  const onClose = jest.fn();
  render(<CategoryModal category={{ id: 1, nameFr: 'Bonnets', nameEn: 'Hats' }} onSave={onSave} onClose={onClose} />);
  await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Type d’article'), { target: { value: 'hat' } });
  fireEvent.change(screen.getByLabelText('Pays de fabrication par défaut'), { target: { value: 'CA' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nameFr: 'Bonnets', nameEn: 'Hats', customsProfileKey: 'hat', customsOriginCountry: 'CA' }));
});

it('filters yarn profiles and permits clearing a category association', async () => {
  const onSave = jest.fn(async () => ({}));
  render(<CategoryModal kind="yarn" category={{ id: 1, name: 'Acrylique', customsProfileKey: 'yarn' }} onSave={onSave} onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
  expect(screen.queryByRole('option', { name: 'Bonnet' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Type d’article'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ customsProfileKey: null })));
});
