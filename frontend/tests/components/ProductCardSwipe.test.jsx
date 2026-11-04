import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductCard from '../../src/components/ProductCard.jsx';

jest.mock('../../src/context/CurrencyContext.jsx', () => ({ useCurrency: () => ({ formatPrice: (n) => `${n} $` }) }));
jest.mock('../../src/context/LanguageContext.jsx', () => ({ useLanguage: () => ({ lang: 'fr', t: (key) => key }) }));
jest.mock('../../src/components/FavoriteButton.jsx', () => () => null);

const product = {
  id: 3, name: 'Bandana', price: 25, stockQuantity: 2,
  images: [{ imageUrl: '/cover.jpg', variantId: null }],
  variants: [
    { id: 10, label: 'A', images: [{ imageUrl: '/a.jpg' }] },
    { id: 11, label: 'B', images: [{ imageUrl: '/b.jpg' }] },
  ],
};

function showCard(item = product) {
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<ProductCard product={item} />} />
    <Route path="/products/3" element={<h1>Fiche détaillée</h1>} />
  </Routes></MemoryRouter>);
}

function swipe(element, direction = 'left') {
  fireEvent.touchStart(element, { touches: [{ clientX: direction === 'left' ? 180 : 20, clientY: 20 }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: direction === 'left' ? 20 : 180, clientY: 22 }] });
}

it('swipes the home card through variations and back to the cover after selecting a color', () => {
  const { container } = showCard();
  const link = container.querySelector('.product-card-media');
  const image = screen.getByAltText('Bandana');
  expect(image).toHaveAttribute('src', '/cover.jpg');
  swipe(link);
  expect(image).toHaveAttribute('src', '/a.jpg');
  expect(screen.getByRole('button', { name: 'products.variation A' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'products.variation B' }));
  expect(image).toHaveAttribute('src', '/b.jpg');
  swipe(link, 'right');
  expect(image).toHaveAttribute('src', '/a.jpg');
  swipe(link, 'right');
  expect(image).toHaveAttribute('src', '/cover.jpg');
  expect(screen.getByRole('button', { name: 'products.variation A' })).toHaveAttribute('aria-pressed', 'false');
});

it('keeps a swipe on the home page but still opens details on a deliberate tap', () => {
  const { container } = showCard();
  const link = container.querySelector('.product-card-media');
  swipe(link);
  fireEvent.click(link);
  expect(screen.queryByRole('heading', { name: 'Fiche détaillée' })).not.toBeInTheDocument();
  fireEvent.touchStart(link, { touches: [{ clientX: 60, clientY: 20 }] });
  fireEvent.touchEnd(link, { changedTouches: [{ clientX: 60, clientY: 20 }] });
  fireEvent.click(link);
  expect(screen.getByRole('heading', { name: 'Fiche détaillée' })).toBeInTheDocument();
});

it('leaves the displayed image unchanged during vertical scrolling and cancelled gestures', () => {
  const { container } = showCard();
  const link = container.querySelector('.product-card-media');
  fireEvent.touchStart(link, { touches: [{ clientX: 180, clientY: 20 }] });
  fireEvent.touchEnd(link, { changedTouches: [{ clientX: 120, clientY: 190 }] });
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/cover.jpg');
  fireEvent.touchStart(link, { touches: [{ clientX: 180, clientY: 20 }] });
  fireEvent.touchCancel(link);
  fireEvent.touchEnd(link, { changedTouches: [{ clientX: 20, clientY: 20 }] });
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/cover.jpg');
});

it('keeps a favorite pinned to its saved variation', () => {
  const { container } = showCard({ ...product, productVariantId: 11, variantImageUrl: '/b.jpg' });
  swipe(container.querySelector('.product-card-media'));
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/b.jpg');
});

it('never shows a sold variation in swatches or when swiping the home card', () => {
  const { container } = showCard({
    ...product,
    variants: product.variants.map((variant, index) => ({ ...variant, status: index === 0 ? 'AVAILABLE' : 'SOLD' })),
  });
  const link = container.querySelector('.product-card-media');
  expect(screen.queryByRole('button', { name: 'products.variation B' })).not.toBeInTheDocument();
  swipe(link);
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/a.jpg');
  swipe(link);
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/cover.jpg');
});

it('does not resurrect a sold cover when no photos remain available', () => {
  showCard({ ...product, mainImageUrl: '/b.jpg', images: [{ imageUrl: '/b.jpg', variantId: 11 }], variants: [] });
  expect(screen.queryByAltText('Bandana')).not.toBeInTheDocument();
  expect(screen.getByText('products.noImage')).toBeInTheDocument();
});

it('keeps the ordinary photos of a sold simple product visible', () => {
  showCard({ ...product, soldOut: true, stockQuantity: 0, variants: [], mainImageUrl: '/photo.jpg',
    images: [{ imageUrl: '/photo.jpg', variantId: null }] });
  expect(screen.getByAltText('Bandana')).toHaveAttribute('src', '/photo.jpg');
  expect(screen.getByText('products.soldOut')).toBeInTheDocument();
});
