import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductDetailModal from '../../src/components/ProductDetailModal.jsx';

jest.mock('../../src/context/CartContext.jsx', () => ({ useCart: () => ({ addToCart: jest.fn(), items: [] }) }));
jest.mock('../../src/context/CurrencyContext.jsx', () => ({ useCurrency: () => ({ formatPrice: (n) => `${n} $` }) }));
jest.mock('../../src/context/FavoriteContext.jsx', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: jest.fn() }) }));
jest.mock('../../src/context/LanguageContext.jsx', () => ({ useLanguage: () => ({ lang: 'en', t: (key, vars) => vars ? `${key} ${vars.number}` : key }) }));

const product = {
  id: 1, name: 'Bandana', price: 25, stockQuantity: 1,
  images: [{ id: 1, imageUrl: '/a.jpg' }, { id: 2, imageUrl: '/b.jpg' }],
};

it('names the dialog, traps keyboard focus and restores focus on unmount', async () => {
  const user = userEvent.setup();
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const { unmount } = render(<ProductDetailModal product={product} onClose={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: 'Bandana' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  const close = within(dialog).getByRole('button', { name: 'common.close' });
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(within(dialog).getByRole('button', { name: 'products.addToCart' })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  unmount();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
  opener.remove();
});

it('exposes photo selection as buttons and closes the lightbox before the product dialog', async () => {
  const onClose = jest.fn();
  const user = userEvent.setup();
  render(<ProductDetailModal product={product} onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'common.photo 2' }));
  expect(screen.getByRole('button', { name: 'common.photo 2' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Bandana', exact: true }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'common.close' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'common.close' })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});
