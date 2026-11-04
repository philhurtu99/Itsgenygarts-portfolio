import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { adminGetExistingImages } from '../../src/services/api.js';
import { ProductModal } from '../../src/pages/admin/Products.jsx';
import { YarnModal } from '../../src/pages/admin/Yarn.jsx';

jest.mock('../../src/services/api.js', () => ({
  adminGetCustomsProfiles: jest.fn(async () => []),
  adminGetExistingImages: jest.fn(async () => []),
}));

const item = { id: 99, name: 'Bonnet', nameFr: 'Bonnet', nameEn: 'Hat', price: 25, stockQuantity: 1,
  images: [{ id: 1, imageUrl: '/photo.jpg', variantId: 10 }], variants: [{ id: 10, label: 'A' }],
  packageWeightGrams: 350, packageLengthCm: 25, packageWidthCm: 20, packageHeightCm: 8 };
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

it('lets the admin enable the gallery on a sold product without restoring stock', async () => {
  const onSave = jest.fn(async () => ({}));
  render(<ProductModal product={{ ...item, soldOut: true, stockQuantity: 0, variants: [{ id: 10, label: 'A', status: 'SOLD' }] }} categories={[]} onSave={onSave} onClose={jest.fn()} />);
  next(); next(); next();
  fireEvent.click(screen.getByLabelText('Afficher toutes les variations sur le produit vendu'));
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ soldOut: true, stockQuantity: 0, showSoldVariants: true }), []));
});

it('retains bilingual data, single-product photos and measures across steps until save', async () => {
  const onSave = jest.fn(async () => item);
  const onClose = jest.fn();
  render(<ProductModal product={item} categories={[]} onSave={onSave} onClose={onClose} />);
  fireEvent.click(within(screen.getByLabelText(/Nom français/).parentElement.parentElement).getByRole('button', { name: 'EN', exact: true }));
  fireEvent.change(screen.getByLabelText(/Nom anglais/), { target: { value: 'Winter hat' } });
  next();
  expect(screen.getByRole('heading', { name: 'Photos' })).toBeVisible();
  expect(screen.queryByText('Variation A')).not.toBeInTheDocument();
  expect(document.querySelector('img[src="/photo.jpg"]')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
  expect(screen.getByLabelText(/Nom anglais/)).toHaveValue('Winter hat');
  next(); next(); next();
  expect(screen.getByRole('heading', { name: 'Publication' })).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nameFr: 'Bonnet', nameEn: 'Winter hat', stockQuantity: 1, packageWeightGrams: 350, customsProfileKey: null }), []);
});

it('allows a draft without shipping measures but blocks publishing it', async () => {
  const onSave = jest.fn(async () => ({}));
  render(<ProductModal categories={[]} onSave={onSave} onClose={jest.fn()} />);
  next();
  expect(screen.getByRole('heading', { name: 'Informations' })).toBeVisible();
  fireEvent.change(screen.getByLabelText(/Nom français/), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '10' } });
  next(); next(); next();
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  expect(screen.getByRole('heading', { name: 'Expédition' })).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
  next();
  fireEvent.click(screen.getByLabelText(/Brouillon/));
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0]).toMatchObject({ isDraft: true, packageWeightGrams: null });
});

it('keeps existing variant photos, and blocks a missing variant photo', async () => {
  render(<ProductModal product={{ ...item, stockQuantity: 2, variants: [...item.variants, { id: 11, label: 'B' }] }} categories={[]} onClose={jest.fn()} onSave={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
  next();
  expect(screen.getByText('Variation A')).toBeVisible();
  expect(screen.getByText('Variation B')).toBeVisible();
  next();
  expect(screen.getByRole('heading', { name: 'Photos' })).toBeVisible();
  expect(screen.getByText(/Ajoutez au moins une photo/)).toHaveTextContent('B');
});

it('uses the same four steps for yarn without changing its stock', async () => {
  const onSave = jest.fn(async () => ({}));
  render(<YarnModal yarn={{ ...item, stockQuantity: 12 }} categories={[]} onClose={jest.fn()} onSave={onSave} />);
  next(); next(); next();
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ stockQuantity: 12, packageHeightCm: 8 }), []));
});

it('uploads a presentation image without associating it with a variation', async () => {
  adminGetExistingImages.mockResolvedValueOnce([{ url: '/cover.jpg', label: 'Présentation' }]);
  const multi = { ...item, stockQuantity: 2, variants: [...item.variants, { id: 11, label: 'B' }] };
  const updated = { ...multi, images: [...item.images, { id: 2, imageUrl: '/cover.jpg', variantId: null }] };
  const onImageUpload = jest.fn(async () => updated);
  render(<ProductModal product={multi} categories={[]} onClose={jest.fn()} onSave={jest.fn()} onImageUpload={onImageUpload} />);
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Choisir une photo de présentation existante' }));
  fireEvent.click(await screen.findByRole('img', { name: 'Présentation' }));
  await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(1));
  const fd = onImageUpload.mock.calls[0][1];
  expect(fd.get('existingImageUrl')).toBe('/cover.jpg');
  expect(fd.get('variantId')).toBeNull();
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Photos de présentation' })).getAllByRole('img', { hidden: true })).toHaveLength(2));
});

it('keeps a queued presentation photo independent when adding variations', async () => {
  adminGetExistingImages.mockResolvedValueOnce([{ url: '/cover.jpg', label: 'Présentation' }]);
  render(<ProductModal categories={[]} onClose={jest.fn()} onSave={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/Nom français/), { target: { value: 'Produit test' } });
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '10' } });
  next();
  expect(screen.queryByRole('region', { name: 'Photos de présentation' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Choisir la couleur de la variation A')).not.toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Ajouter une variation'));
  expect(screen.getByLabelText('Choisir la couleur de la variation A')).toBeVisible();
  expect(screen.getByLabelText('Choisir la couleur de la variation B')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Choisir une photo de présentation existante' }));
  fireEvent.click(await screen.findByRole('img', { name: 'Présentation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choisir une photo de présentation existante' }));
  fireEvent.click(screen.getByTitle('Retirer une variation'));
  expect(screen.queryByRole('region', { name: 'Photos de présentation' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Choisir la couleur de la variation A')).not.toBeInTheDocument();
  expect(document.querySelector('img[src="/cover.jpg"]')).toBeVisible();
  fireEvent.click(screen.getByTitle('Ajouter une variation'));
  expect(screen.getByLabelText('Choisir la couleur de la variation A')).toBeVisible();
  expect(screen.getByLabelText('Choisir la couleur de la variation B')).toBeVisible();
  const presentation = screen.getByRole('region', { name: 'Photos de présentation' });
  expect(presentation.querySelector('img[src="/cover.jpg"]')).toBeInTheDocument();
  expect(screen.getAllByText('Aucune photo pour cette variation.')).toHaveLength(2);
});

it('keeps ordinary product photos together without a presentation section', () => {
  render(<ProductModal product={{ ...item, images: [...item.images, { id: 2, imageUrl: '/general.jpg', variantId: null }] }} categories={[]} onClose={jest.fn()} onSave={jest.fn()} />);
  next();
  expect(screen.getByRole('heading', { name: 'Photos du produit' })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Photos de présentation' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Choisir la couleur de la variation A')).not.toBeInTheDocument();
  expect(document.querySelector('img[src="/photo.jpg"]')).toBeVisible();
  expect(document.querySelector('img[src="/general.jpg"]')).toBeVisible();
});

it('saves the photo order of an existing simple product and uses the returned order', async () => {
  const second = { id: 2, imageUrl: '/second.jpg', variantId: 10, order: 1 };
  const first = { ...item.images[0], order: 0 };
  const onImagesReorder = jest.fn(async () => ({ ...item, images: [{ ...second, order: 0 }, { ...first, order: 1 }] }));
  render(<ProductModal product={{ ...item, images: [first, second] }} categories={[]} onClose={jest.fn()} onSave={jest.fn()} onImagesReorder={onImagesReorder} />);
  next();
  fireEvent.keyDown(screen.getAllByRole('listitem')[1], { key: 'ArrowLeft' });
  await waitFor(() => expect(onImagesReorder).toHaveBeenCalledWith(99, [2, 1]));
  await waitFor(() => expect(document.querySelector('[data-sortable-photo]')).toHaveAttribute('data-sortable-photo', '2'));
});

it('autosaves an edited product without closing it, and flushes the last edit when closing', async () => {
  const onAutoSave = jest.fn(async () => item);
  const onClose = jest.fn();
  render(<ProductModal product={item} categories={[]} onAutoSave={onAutoSave} onClose={onClose} onSave={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
  expect(onAutoSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Nom français/), { target: { value: 'Bonnet bleu' } });
  await waitFor(() => expect(onAutoSave).toHaveBeenCalledWith(99, { nameFr: 'Bonnet bleu' }));
  expect(screen.getByRole('status')).toHaveTextContent('Modifications enregistrées');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '30' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Fermer', exact: true })[0]);
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(onAutoSave).toHaveBeenLastCalledWith(99, { price: 30 });
});

it('keeps unsaved edits open and offers a retry after an autosave error', async () => {
  const onAutoSave = jest.fn().mockRejectedValueOnce(new Error('Connexion interrompue')).mockResolvedValue(item);
  const onClose = jest.fn();
  render(<ProductModal product={item} categories={[]} onAutoSave={onAutoSave} onClose={onClose} onSave={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText(/Prix/), { target: { value: '30' } });
  await screen.findByRole('button', { name: 'Réessayer' });
  expect(screen.getByRole('status')).toHaveTextContent('Non enregistré : Connexion interrompue');
  expect(screen.getByLabelText(/Prix/)).toHaveValue(30);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Modifications enregistrées'));
});
