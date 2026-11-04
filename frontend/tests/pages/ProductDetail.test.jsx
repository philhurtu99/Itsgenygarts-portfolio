import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from '../../src/pages/ProductDetail.jsx';
import ProductCard from '../../src/components/ProductCard.jsx';
import { getProduct, getProducts } from '../../src/services/api.js';

const mockAddToCart = jest.fn();
const mockToggleFavorite = jest.fn();
jest.mock('../../src/services/api.js', () => ({ getProduct: jest.fn(), getProducts: jest.fn() }));
jest.mock('../../src/context/CartContext.jsx', () => ({ useCart: () => ({ addToCart: mockAddToCart, items: [] }) }));
jest.mock('../../src/context/CurrencyContext.jsx', () => ({ useCurrency: () => ({ formatPrice: (n) => `${n} $` }) }));
jest.mock('../../src/context/LanguageContext.jsx', () => ({ useLanguage: () => ({ lang: 'fr', t: (key) => key }) }));
jest.mock('../../src/context/FavoriteContext.jsx', () => ({ useFavorites: () => ({ isFavorite: () => false, toggleFavorite: mockToggleFavorite }) }));
jest.mock('../../src/components/SeoHead.jsx', () => () => null);
jest.mock('../../src/components/JsonLd.jsx', () => () => null);

const product = {
  id: 1, name: 'Bandana', price: 25, stockQuantity: 2,
  variants: [
    { id: 10, label: 'A', colorHex: '#124ABC', images: [{ imageUrl: '/a.jpg' }] },
    { id: 11, label: 'B', colorHex: '#DE5287', images: [{ imageUrl: '/b.jpg' }] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  getProduct.mockResolvedValue(product);
  getProducts.mockResolvedValue([]);
});

function showProduct(item = product) {
  return render(
    <MemoryRouter initialEntries={['/products/1']}>
      <Routes><Route path="/products/:id" element={<><ProductCard product={item} /><ProductDetail /></>} /></Routes>
    </MemoryRouter>
  );
}

it('lets clients browse every sold variation of a republished sold product without buying', async () => {
  const item = { ...product, soldOut: true, stockQuantity: 0, showSoldVariants: true,
    variants: product.variants.map((variant) => ({ ...variant, status: 'SOLD' })),
    images: [{ imageUrl: '/cover.jpg', variantId: null }] };
  getProduct.mockResolvedValue(item);
  const { container } = showProduct(item);
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const gallery = container.querySelector('.product-gallery');
  fireEvent.click(container.querySelectorAll('.product-variant-options button')[1]);
  expect(within(gallery).getByRole('img', { name: 'Bandana', exact: true })).toHaveAttribute('src', '/b.jpg');
  swipePhoto(container.querySelector('.product-gallery-zoom-trigger'), 'right');
  expect(within(gallery).getByRole('img', { name: 'Bandana', exact: true })).toHaveAttribute('src', '/a.jpg');
  const buy = screen.getByRole('button', { name: 'products.addToCart' });
  expect(buy).toBeDisabled();
  fireEvent.click(buy);
  expect(mockAddToCart).not.toHaveBeenCalled();
});

it('shows a simple product photo once without presentation or variation controls', async () => {
  const image = { id: 97, imageUrl: '/lemon.jpg' };
  const item = { ...product, name: 'Lemon bag', stockQuantity: 1,
    mainImageUrl: image.imageUrl,
    images: [{ ...image, variantId: null }],
    variants: [{ id: 23, status: 'AVAILABLE', images: [{ ...image, variantId: 23 }] }] };
  getProduct.mockResolvedValue(item);
  const { container } = showProduct(item);
  await screen.findByRole('heading', { level: 1, name: 'Lemon bag' });
  expect(container.querySelector('.product-gallery-main')).toHaveAttribute('src', '/lemon.jpg');
  expect(container.querySelector('.product-gallery-thumbs')).not.toBeInTheDocument();
  expect(container.querySelector('.product-variant-options')).not.toBeInTheDocument();
  expect(container.querySelector('.product-card-swatches')).not.toBeInTheDocument();
});

it('keeps saved variation colors identical between catalogue and product detail', async () => {
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const card = container.querySelectorAll('.product-card-swatches button');
  const detail = container.querySelectorAll('.product-variant-options button');
  expect([...detail].map((button) => button.style.getPropertyValue('--swatch-color'))).toEqual(['#124ABC', '#DE5287']);
  expect([...card].map((button) => button.style.getPropertyValue('--swatch-color'))).toEqual([...detail].map((button) => button.style.getPropertyValue('--swatch-color')));
  fireEvent.click(detail[1]);
  expect(detail[1]).toHaveAttribute('aria-pressed', 'true');
  expect(within(container.querySelector('.product-gallery')).getByRole('img', { name: 'Bandana', exact: true })).toHaveAttribute('src', '/b.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'products.addToCart' }));
  expect(mockAddToCart).toHaveBeenCalledWith(expect.any(Object), 1, expect.objectContaining({ id: 11, colorHex: '#DE5287' }));
});

it('uses the same distinct fallback swatches when imported variations have no saved color', async () => {
  const item = { ...product, variants: product.variants.map((variant) => ({ ...variant, colorHex: null })) };
  getProduct.mockResolvedValue(item);
  const { container } = showProduct(item);
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const colors = (selector) => [...container.querySelectorAll(selector)].map((button) => button.style.getPropertyValue('--swatch-color'));
  expect(colors('.product-variant-options button')).toEqual(['#d9b9a5', '#8a9b82']);
  expect(colors('.product-variant-options button')).toEqual(colors('.product-card-swatches button'));
});

it('shows a presentation photo on the card and detail, then swipes to variations and selects their photos', async () => {
  const item = { ...product, images: [{ imageUrl: '/cover.jpg', variantId: null }, { imageUrl: '/overview.jpg', variantId: null }] };
  getProduct.mockResolvedValue(item);
  const { container } = showProduct(item);
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  expect(container.querySelector('.product-card-image')).toHaveAttribute('src', '/cover.jpg');
  const gallery = container.querySelector('.product-gallery');
  const main = () => within(gallery).getByRole('img', { name: 'Bandana', exact: true });
  expect(main()).toHaveAttribute('src', '/cover.jpg');
  expect(within(gallery).queryByText('products.variation A')).not.toBeInTheDocument();
  const swipe = () => {
    fireEvent.touchStart(container.querySelector('.product-gallery-zoom-trigger'), { touches: [{ clientX: 180, clientY: 20 }] });
    fireEvent.touchEnd(container.querySelector('.product-gallery-zoom-trigger'), { changedTouches: [{ clientX: 20, clientY: 22 }] });
  };
  swipe();
  expect(main()).toHaveAttribute('src', '/overview.jpg');
  swipe();
  expect(main()).toHaveAttribute('src', '/a.jpg');
  expect(within(gallery).getByText('products.variation A')).toBeInTheDocument();
  const variants = container.querySelector('.product-variant-options');
  fireEvent.click(within(variants).getByRole('button', { name: 'products.variation B' }));
  expect(main()).toHaveAttribute('src', '/b.jpg');
  fireEvent.click(container.querySelector('.product-gallery-thumb'));
  expect(main()).toHaveAttribute('src', '/cover.jpg');
  expect(within(gallery).queryByText('products.variation B')).not.toBeInTheDocument();
});

function swipePhoto(element, direction = 'left') {
  fireEvent.touchStart(element, { touches: [{ clientX: direction === 'left' ? 180 : 20, clientY: 20 }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: direction === 'left' ? 20 : 180, clientY: 22 }] });
}

it('swipes right from a selected color back through variations to the presentation photo', async () => {
  getProduct.mockResolvedValue({ ...product, images: [{ imageUrl: '/cover.jpg', variantId: null }] });
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const variants = container.querySelectorAll('.product-variant-options button');
  fireEvent.click(variants[1]);
  const main = container.querySelector('.product-gallery-main');
  const trigger = container.querySelector('.product-gallery-zoom-trigger');
  expect(main).toHaveAttribute('src', '/b.jpg');
  swipePhoto(trigger, 'right');
  expect(main).toHaveAttribute('src', '/a.jpg');
  expect(variants[0]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'products.addToCart' }));
  expect(mockAddToCart).toHaveBeenLastCalledWith(expect.any(Object), 1, expect.objectContaining({ id: 10 }));
  swipePhoto(trigger, 'right');
  expect(main).toHaveAttribute('src', '/cover.jpg');
  expect(container.querySelector('.product-gallery')).not.toHaveTextContent('products.variation A');
  // Showing the general photo keeps the chosen purchase option.
  expect(variants[0]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(trigger);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not change the photo when scrolling vertically or cancelling a touch gesture', async () => {
  getProduct.mockResolvedValue({ ...product, images: [{ imageUrl: '/cover.jpg', variantId: null }] });
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const trigger = container.querySelector('.product-gallery-zoom-trigger');
  fireEvent.touchStart(trigger, { touches: [{ clientX: 180, clientY: 20 }] });
  fireEvent.touchEnd(trigger, { changedTouches: [{ clientX: 120, clientY: 190 }] });
  expect(container.querySelector('.product-gallery-main')).toHaveAttribute('src', '/cover.jpg');
  fireEvent.touchStart(trigger, { touches: [{ clientX: 180, clientY: 20 }] });
  fireEvent.touchCancel(trigger);
  fireEvent.touchEnd(trigger, { changedTouches: [{ clientX: 20, clientY: 20 }] });
  expect(container.querySelector('.product-gallery-main')).toHaveAttribute('src', '/cover.jpg');
});

it('also swipes back to the presentation photo while the image is enlarged', async () => {
  const prototype = HTMLDialogElement.prototype;
  const showModal = prototype.showModal;
  const close = prototype.close;
  prototype.showModal = jest.fn(function () { this.setAttribute('open', ''); });
  prototype.close = jest.fn(function () { this.removeAttribute('open'); });
  let view;
  try {
    getProduct.mockResolvedValue({ ...product, images: [{ imageUrl: '/cover.jpg', variantId: null }] });
    view = showProduct();
    const { container } = view;
    await screen.findByRole('heading', { level: 1, name: 'Bandana' });
    fireEvent.click(container.querySelectorAll('.product-variant-options button')[1]);
    fireEvent.click(container.querySelector('.product-gallery-zoom-trigger'));
    const image = document.querySelector('.product-photo-lightbox-image');
    expect(image).toHaveAttribute('src', '/b.jpg');
    swipePhoto(image, 'right');
    expect(image).toHaveAttribute('src', '/a.jpg');
    swipePhoto(image, 'right');
    expect(image).toHaveAttribute('src', '/cover.jpg');
    swipePhoto(image);
    expect(image).toHaveAttribute('src', '/a.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(container.querySelector('.product-gallery-main')).toHaveAttribute('src', '/a.jpg');
  } finally {
    view?.unmount();
    prototype.showModal = showModal;
    prototype.close = close;
  }
});


it('places details before the accordions on mobile and restores desktop order when resizing', async () => {
  const originalMatchMedia = window.matchMedia;
  let onChange;
  const viewport = { matches: true, addEventListener: jest.fn((event, callback) => { onChange = callback; }), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => viewport);
  let view;
  try {
    view = showProduct();
    await screen.findByRole('heading', { level: 1, name: 'Bandana' });
    const story = () => view.container.querySelector('.product-story-section');
    const accordions = view.container.querySelector('.product-info-sections');
    expect(story().compareDocumentPosition(accordions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(accordions.compareDocumentPosition(view.container.querySelector('.product-story-facts')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(story().querySelector('.product-story-facts')).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('.product-story-section')).toHaveLength(1);
    act(() => { viewport.matches = false; onChange(); });
    expect(accordions.compareDocumentPosition(story()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(story().querySelector('.product-story-facts')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.product-story-facts')).toHaveLength(1);
    expect(view.container.querySelectorAll('.product-story-section')).toHaveLength(1);
    view.unmount();
    expect(viewport.removeEventListener).toHaveBeenCalledWith('change', onChange);
  } finally {
    view?.unmount();
    window.matchMedia = originalMatchMedia;
  }
});


it('uses a compact heart on the photo and favorites the selected variation without opening the zoom', async () => {
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  fireEvent.click(container.querySelectorAll('.product-variant-options button')[1]);
  const photo = container.querySelector('.product-gallery-media');
  expect(photo.querySelector('.favorite-button-compact')).toBeInTheDocument();
  expect(photo.querySelector('.favorite-button .action')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.product-gallery-favorite')).toHaveLength(1);
  fireEvent.click(within(photo).getByRole('checkbox', { name: 'favorites.add : Bandana' }));
  expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  expect(mockToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 1, selectedVariant: expect.objectContaining({ id: 11 }) }));
  expect(container.querySelector('.product-photo-lightbox')).not.toBeInTheDocument();
});


it.each([
  ['Bandana', 'Bandana', 'Bandana'],
  [{ name: 'Sacs', nameFr: 'Sacs & accessoires', nameEn: 'Bags & accessories' }, 'Sacs & accessoires', 'Sacs'],
])('links the category to the filtered catalogue and omits the repeated details label', async (category, label, filter) => {
  getProduct.mockResolvedValue({ ...product, category });
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const categoryLink = container.querySelector('.product-info-category');
  expect(categoryLink).toHaveTextContent(label);
  expect(categoryLink).toHaveAttribute('href', `/products?category=${encodeURIComponent(filter)}`);
  expect(container.querySelector('.product-story-heading > span')).not.toBeInTheDocument();
});


it('preserves single line breaks and consecutive blank lines from the admin description', async () => {
  const description = "Le sac fraise\nJ'ai créé ce sac afin d'utiliser mon fil jusqu'au dernier gramme.\nCe sac offre un volume de rangement généreux.\n\n\nLa couleur pourrait être différente en personne par rapport à un écran.";
  getProduct.mockResolvedValue({ ...product, descriptionFr: description });
  const { container } = showProduct();
  await screen.findByRole('heading', { level: 1, name: 'Bandana' });
  const copy = container.querySelector('.product-story-copy');
  expect(copy.querySelectorAll('p')).toHaveLength(1);
  expect(copy.textContent).toBe(description);
});
