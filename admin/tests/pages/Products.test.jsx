import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminProducts from '../../src/pages/admin/Products.jsx';
import { adminGetProducts, adminGetCategories, getCategories } from '../../src/services/api.js';

jest.mock('../../src/pages/admin/Dashboard.jsx', () => ({ AdminSidebar: () => null }));
jest.mock('../../src/services/api.js', () => ({
  adminGetProducts: jest.fn(), adminGetCategories: jest.fn(), getCategories: jest.fn(),
}));
const categories = [{ id: 1, name: 'Bandana' }, { id: 2, name: 'Cardigan' }, { id: 3, name: 'Catégorie vide', isActive: false }];
const products = [
  { id: 1, name: 'Bandana disponible', categoryId: 1, category: categories[0], price: '25.00', stockQuantity: 1, isDraft: false },
  { id: 2, name: 'Bandana vendu', categoryId: 1, category: categories[0], price: '15.00', stockQuantity: 0, soldOut: false, isDraft: false },
  { id: 3, name: 'Cardigan brouillon', categoryId: 2, category: categories[1], price: '100.50', stockQuantity: 1, isDraft: true },
  { id: 4, name: 'Bandana vedette', categoryId: 1, category: categories[0], price: '35.00', stockQuantity: 2, isDraft: false, isFeatured: true },
];
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const names = () => [...document.querySelectorAll('tbody td[data-label="Nom"]')].map(node => node.textContent);
async function setup({ openFilters = true } = {}) {
  adminGetProducts.mockResolvedValue(products);
  adminGetCategories.mockResolvedValue(categories);
  render(<AdminProducts />);
  await waitFor(() => expect(screen.getByLabelText('Statut')).toBeInTheDocument());
  if (openFilters) fireEvent.click(screen.getByText('Filtres', { exact: true }));
}
beforeEach(() => jest.clearAllMocks());

it('loads every admin category including empty/inactive and draft-only categories', async () => {
  await setup();
  expect(adminGetCategories).toHaveBeenCalledTimes(1);
  expect(getCategories).not.toHaveBeenCalled();
  expect(screen.getByRole('option', { name: 'Cardigan' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Catégorie vide' })).toBeInTheDocument();
  change('Catégorie', '2'); expect(names()).toEqual(['Cardigan brouillon']);
  change('Catégorie', '3'); expect(names()).toEqual([]);
});

it('filters publication, stock and featured statuses using actual stock', async () => {
  await setup();
  change('Statut', 'draft'); expect(names()).toEqual(['Cardigan brouillon']);
  change('Statut', 'published'); expect(names()).toEqual(['Bandana disponible', 'Bandana vendu', 'Bandana vedette']);
  fireEvent.click(screen.getByLabelText('En stock')); expect(names()).toEqual(['Bandana vendu']);
  fireEvent.click(screen.getByLabelText('Vendu')); expect(names()).toEqual([]);
  fireEvent.click(screen.getByLabelText('En stock')); expect(names()).toEqual(['Bandana disponible', 'Bandana vedette']);
  change('Statut', 'featured'); expect(names()).toEqual(['Bandana vedette']);
});

it('combines category, status and price sorting, then resets', async () => {
  await setup();
  change('Catégorie', '2'); change('Statut', 'draft');
  change('Trier par prix', 'desc');
  expect(names()).toEqual(['Cardigan brouillon']);
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
  expect(names()).toEqual(products.map(p => p.name));
  expect(screen.getByRole('status')).toHaveTextContent('4 produits');
});

it('sorts numerically and restores the original fetched order', async () => {
  await setup();
  change('Trier par prix', 'asc');
  expect(names()).toEqual(['Bandana vendu', 'Bandana disponible', 'Bandana vedette', 'Cardigan brouillon']);
  change('Trier par prix', 'desc');
  expect(names()).toEqual(['Cardigan brouillon', 'Bandana vedette', 'Bandana disponible', 'Bandana vendu']);
  change('Trier par prix', 'default'); expect(names()).toEqual(products.map(p => p.name));
});

it('applies the same category and status results to mobile cards', async () => {
  await setup();
  change('Catégorie', '1'); fireEvent.click(screen.getByLabelText('Vendu'));
  expect(names()).toEqual(['Bandana disponible', 'Bandana vedette']);
  expect([...document.querySelectorAll('.admin-product-mobile-card h2')].map(n => n.textContent)).toEqual(names());
});


it('filters true variations including sold ones, combines filters and resets desktop and mobile lists', async () => {
  const items = products.map((product) => ({ ...product, variants: product.id === 4
    ? [{ id: 40, status: 'AVAILABLE' }, { id: 41, status: 'SOLD' }]
    : [{ id: product.id, status: product.stockQuantity ? 'AVAILABLE' : 'SOLD' }] }));
  adminGetProducts.mockResolvedValue(items);
  adminGetCategories.mockResolvedValue(categories);
  render(<AdminProducts />);
  await screen.findByLabelText('Variations');
  fireEvent.click(screen.getByText('Filtres', { exact: true }));
  change('Variations', 'with');
  expect(names()).toEqual(['Bandana vedette']);
  expect([...document.querySelectorAll('.admin-product-mobile-card h2')].map(n => n.textContent)).toEqual(names());
  change('Statut', 'draft'); expect(names()).toEqual([]);
  change('Statut', 'all'); change('Variations', 'without');
  expect(names()).toEqual(['Bandana disponible', 'Bandana vendu', 'Cardigan brouillon']);
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
  expect(screen.getByLabelText('Variations')).toHaveValue('all');
  expect(names()).toEqual(items.map(p => p.name));
});

it('opens the exact thumbnail on desktop and mobile without editing the item', async () => {
  const items = products.map((item, index) => index === 0 ? { ...item, mainImageUrl: '/preview.jpg', images: [{ imageUrl: '/preview.jpg' }, { imageUrl: '/detail.jpg' }], variants: [{ images: [{ imageUrl: '/preview.jpg' }, { imageUrl: '/variant.jpg' }] }] } : item);
  adminGetProducts.mockResolvedValue(items);
  adminGetCategories.mockResolvedValue(categories);
  render(<AdminProducts />);
  const buttons = await screen.findAllByRole('button', { name: 'Agrandir l’image de Bandana disponible' });
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Aperçu des images' });
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/preview.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/detail.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/variant.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/preview.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/preview.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  }
});


it('keeps filters collapsed by default and retains an active filter when collapsed', async () => {
  await setup({ openFilters: false });
  const disclosure = document.querySelector('.admin-product-filters');
  expect(disclosure).not.toHaveAttribute('open');
  fireEvent.click(disclosure.querySelector('summary'));
  expect(disclosure).toHaveAttribute('open');
  change('Statut', 'draft');
  fireEvent.click(disclosure.querySelector('summary'));
  expect(disclosure).not.toHaveAttribute('open');
  expect(disclosure.querySelector('summary')).toHaveTextContent('Filtres · actifs');
  expect(names()).toEqual(['Cardigan brouillon']);
});

it('combines publication with both independent availability choices and resets them', async () => {
  await setup();
  expect(screen.queryByRole('option', { name: 'En stock' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Vendu' })).not.toBeInTheDocument();
  change('Statut', 'draft');
  fireEvent.click(screen.getByLabelText('En stock'));
  expect(names()).toEqual([]);
  fireEvent.click(screen.getByLabelText('En stock'));
  expect(names()).toEqual(['Cardigan brouillon']);
  fireEvent.click(screen.getByLabelText('Vendu'));
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
  expect(screen.getByLabelText('En stock')).toBeChecked();
  expect(screen.getByLabelText('Vendu')).toBeChecked();
  expect(names()).toEqual(products.map(p => p.name));
});
