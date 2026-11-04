const mockToggleFavorite = jest.fn();

jest.mock('../../src/context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ formatPrice: (n) => `${n} $` }),
}));
jest.mock('../../src/context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ lang: 'fr', t: (key) => ({
    'products.noImage': "Pas d'image",
    'products.soldOut': 'Vendu',
    'products.variation': 'Variation',
    'favorites.add': 'Ajouter aux favoris',
  }[key] || key) }),
}));
jest.mock('../../src/context/FavoriteContext.jsx', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: mockToggleFavorite }),
}));

import { act, render as renderComponent, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ProductCard from '../../src/components/ProductCard.jsx';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function Wrapper({ children }) {
  return <MemoryRouter>{children}<Location /></MemoryRouter>;
}
function render(ui) {
  return renderComponent(ui, { wrapper: Wrapper });
}

beforeEach(() => mockToggleFavorite.mockReset());

describe('ProductCard', () => {
  const baseProduct = { id: 1, name: 'Chapeau', price: 25, stockQuantity: 3, mainImageUrl: '/img/chapeau.jpg' };

  it('shows the product name and formatted price', () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByRole('heading', { name: 'Chapeau' })).toBeInTheDocument();
    expect(screen.getByText('25 $')).toBeInTheDocument();
  });

  it('gives the product image descriptive alternative text', () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByAltText('Chapeau')).toHaveAttribute('src', '/img/chapeau.jpg');
  });

  it('provides a placeholder when no image is available', () => {
    render(<ProductCard product={{ ...baseProduct, mainImageUrl: null }} />);
    expect(screen.getByText("Pas d'image")).toBeInTheDocument();
  });

  it('identifies sold-out products while preserving access to their detail page', () => {
    render(<ProductCard product={{ ...baseProduct, soldOut: true }} />);
    expect(screen.getByText('Vendu')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Chapeau' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'Chapeau' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/products/1');
    });
  });

  it('navigates to the detail page from the product image', () => {
    render(<ProductCard product={baseProduct} />);
    fireEvent.click(screen.getByAltText('Chapeau'));
    expect(screen.getByTestId('location')).toHaveTextContent('/products/1');
  });

  it('navigates to the same detail page from the product title', () => {
    render(<ProductCard product={baseProduct} />);
    fireEvent.click(screen.getByRole('heading', { name: 'Chapeau' }).querySelector('a'));
    expect(screen.getByTestId('location')).toHaveTextContent('/products/1');
  });

  it('supports the alternate product identifier returned by existing API records', () => {
    render(<ProductCard product={{ ...baseProduct, id: undefined, _id: 'legacy-1' }} />);
    screen.getAllByRole('link', { name: 'Chapeau' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/products/legacy-1');
    });
  });

  it('toggles a favorite without navigating away', async () => {
    render(<ProductCard product={baseProduct} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Ajouter aux favoris.*Chapeau/ }));
    });
    expect(mockToggleFavorite).toHaveBeenCalledWith(baseProduct);
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('shows a category supplied as a string', () => {
    render(<ProductCard product={{ ...baseProduct, category: 'Chapeaux' }} />);
    expect(screen.getByText('Chapeaux')).toBeInTheDocument();
  });

  it('shows the localized name of a category object', () => {
    render(<ProductCard product={{ ...baseProduct, category: { name: 'Hats', nameFr: 'Chapeaux' } }} />);
    expect(screen.getByText('Chapeaux')).toBeInTheDocument();
  });

  it('keeps the correct product link when the card is rerendered', () => {
    const { rerender } = render(<ProductCard product={baseProduct} />);
    rerender(<ProductCard product={{ ...baseProduct, id: 2, name: 'Sac' }} />);
    screen.getAllByRole('link', { name: 'Sac' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/products/2');
    });
  });

  it('does not add unnecessary swatches for a single variation', () => {
    render(<ProductCard product={{ ...baseProduct, variants: [{ id: 10, label: 'A', status: 'AVAILABLE' }] }} />);
    expect(screen.queryByRole('button', { name: /Variation/ })).not.toBeInTheDocument();
  });

  it('lets the visitor preview the image of a selected variation without leaving the card', () => {
    render(<ProductCard product={{ ...baseProduct,
      variants: [{ id: 10, label: 'A', status: 'AVAILABLE' }, { id: 11, label: 'B', status: 'AVAILABLE' }],
      images: [{ imageUrl: '/a.jpg', variantId: 10 }, { imageUrl: '/b.jpg', variantId: 11 }],
    }} />);
    const variation = screen.getByRole('button', { name: 'Variation B' });
    fireEvent.click(variation);
    expect(variation).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByAltText('Chapeau')).toHaveAttribute('src', '/b.jpg');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});
