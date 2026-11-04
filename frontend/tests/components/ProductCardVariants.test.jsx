import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductCard from '../../src/components/ProductCard.jsx';
import { LanguageProvider } from '../../src/context/LanguageContext.jsx';

jest.mock('../../src/context/CurrencyContext.jsx', () => ({ useCurrency: () => ({ formatPrice: n => `${n} $` }) }));
jest.mock('../../src/components/FavoriteButton.jsx', () => () => null);
const item = { id: 3, name: 'Octopus', price: 15, stockQuantity: 10,
  images: [{ imageUrl: '/cover.jpg', variantId: null }],
  variants: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, label: String.fromCharCode(65 + index),
    status: 'AVAILABLE', images: [{ imageUrl: `/photo-${index}.jpg` }] })) };
let width;
let resize;
let originalObserver;
beforeEach(() => {
  width = 136;
  localStorage.setItem('lang', 'fr');
  originalObserver = window.ResizeObserver;
  window.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} disconnect() {} };
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.classList.contains('product-card-swatches') ? width : 0;
  });
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { width: this.classList.contains('product-swatch') ? 19 : 12 };
  });
  const originalStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation(element => element.classList.contains('product-card-swatches')
    ? { paddingLeft: '3px', paddingRight: '3px', columnGap: '6px' } : originalStyle(element));
});
afterEach(() => { window.ResizeObserver = originalObserver; jest.restoreAllMocks(); localStorage.removeItem('lang'); });
function show(product = item) {
  return render(<LanguageProvider><MemoryRouter><Routes>
    <Route path="/" element={<ProductCard product={product} />} />
    <Route path="/products/3" element={<h1>Toutes les variantes</h1>} />
  </Routes></MemoryRouter></LanguageProvider>);
}
it('fits the preview to the card, counts remaining options and expands again after resizing', () => {
  show();
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(4);
  expect(screen.getByRole('link', { name: 'Voir les autres variantes : 6' })).toHaveTextContent('+6');
  width = 230; act(() => resize());
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(8);
  expect(screen.getByRole('link', { name: 'Voir les autres variantes : 2' })).toHaveTextContent('+2');
  width = 260; act(() => resize());
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(10);
  expect(screen.queryByRole('link', { name: /Voir les autres/ })).not.toBeInTheDocument();
  width = 42; act(() => resize());
  expect(screen.queryAllByRole('button', { name: /^Variation/ })).toHaveLength(0);
  expect(screen.getByRole('link', { name: 'Voir les autres variantes : 10' })).toHaveTextContent('+10');
  width = 136; act(() => resize());
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(4);
});
it('opens the product from the counter and keeps all photos reachable by swiping', () => {
  const { container } = show();
  const photo = container.querySelector('.product-card-media');
  for (let index = 0; index < 10; index++) {
    fireEvent.touchStart(photo, { touches: [{ clientX: 180, clientY: 20 }] });
    fireEvent.touchEnd(photo, { changedTouches: [{ clientX: 20, clientY: 22 }] });
  }
  expect(screen.getByAltText('Octopus')).toHaveAttribute('src', '/photo-9.jpg');
  fireEvent.click(screen.getByRole('link', { name: 'Voir les autres variantes : 6' }));
  expect(screen.getByRole('heading', { name: 'Toutes les variantes' })).toBeInTheDocument();
});
it('does not count sold variations and hides the counter when every option fits', () => {
  show({ ...item, variants: item.variants.map((variant, index) => ({ ...variant, status: index < 2 ? 'AVAILABLE' : 'SOLD' })) });
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(2);
  expect(screen.queryByRole('link', { name: /Voir les autres/ })).not.toBeInTheDocument();
});
it('translates the counter in English', () => {
  localStorage.setItem('lang', 'en');
  show();
  expect(screen.getByRole('link', { name: 'View additional variants: 6' })).toHaveTextContent('+6');
});
it('shows all three options when they fit without a counter', () => {
  show({ ...item, variants: item.variants.slice(0, 3) });
  expect(screen.getAllByRole('button', { name: /^Variation/ })).toHaveLength(3);
  expect(screen.queryByRole('link', { name: /Voir les autres/ })).not.toBeInTheDocument();
});
it('shows a compact count when exactly one variation is hidden', () => {
  width = 118;
  show({ ...item, variants: item.variants.slice(0, 5) });
  expect(screen.getByRole('link', { name: 'Voir les autres variantes : 1' })).toHaveTextContent('+1');
});
