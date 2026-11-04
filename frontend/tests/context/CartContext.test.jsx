jest.mock('../../src/services/api.js', () => ({
  syncServerCart: jest.fn(() => Promise.resolve([])),
  replaceServerCart: jest.fn((items) => Promise.resolve(items)),
  getServerCart: jest.fn(() => Promise.resolve([])),
  clearServerCart: jest.fn(() => Promise.resolve()),
  getProducts: jest.fn(() => Promise.resolve([])),
}));

import { render, screen, fireEvent, act } from '@testing-library/react';
import { CartProvider, useCart } from '../../src/context/CartContext.jsx';
import { getProducts, getServerCart, syncServerCart, replaceServerCart } from '../../src/services/api.js';

function Harness() {
  const { items, addToCart, removeFromCart, updateQuantity, clearCart, restoreCartItems, cartCount, cartTotal } = useCart();
  return (
    <div>
      <p data-testid="count">{cartCount}</p>
      <p data-testid="total">{cartTotal}</p>
      <p data-testid="items">{JSON.stringify(items.map((i) => ({ id: i.id, q: i.quantity, variantId: i.productVariantId || null, label: i.variantLabel || null })))}</p>
      <button onClick={() => addToCart({ id: 1, name: 'A', price: 10, stockQuantity: 2 })}>add-1</button>
      <button onClick={() => addToCart({ id: 2, name: 'B', price: 5, stockQuantity: 3 })}>add-2</button>
      <button onClick={() => addToCart({ id: 3, name: 'Out', price: 5, stockQuantity: 0 })}>add-oos</button>
      <button onClick={() => addToCart({ id: 6, name: 'Single', price: 10, stockQuantity: 1, variants: [{ id: 60, label: 'A', images: [] }] })}>add-single-variant</button>
      <button onClick={() => addToCart({ id: 7, name: 'Multi', price: 10, stockQuantity: 2, variants: [{ id: 70, label: 'A', images: [] }, { id: 71, label: 'B', images: [] }] }, 1, { id: 71, label: 'B', images: [] })}>add-multi-variant</button>
      <button onClick={() => removeFromCart(1)}>remove-1</button>
      <button onClick={() => updateQuantity(1, 0)}>set-0</button>
      <button onClick={() => updateQuantity(1, 5)}>set-5</button>
      <button onClick={() => clearCart()}>clear</button>
      <button onClick={() => restoreCartItems([{ id: 4, name: 'Saved', price: 12, stockQuantity: 1 }, { id: 5, name: 'Gone', price: 5, stockQuantity: 0 }])}>restore</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <CartProvider>
      <Harness />
    </CartProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  getServerCart.mockResolvedValue([]);
  replaceServerCart.mockImplementation(async items => items);
  getProducts.mockResolvedValue([
    { id: 1, name: 'A', price: 10, stockQuantity: 2 },
    { id: 2, name: 'B', price: 5, stockQuantity: 3 },
    { id: 3, name: 'Out', price: 5, stockQuantity: 0 },
  ]);
});

describe('CartContext', () => {
  it('starts empty', () => {
    renderHarness();
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('total').textContent).toBe('0');
  });

  it('adds a product to the cart', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('total').textContent).toBe('10');
  });

  it('refuses to add the same product twice (unique item cart)', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
      fireEvent.click(screen.getByText('add-1'));
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('refuses to add an out-of-stock product', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-oos'));
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('computes total across multiple products', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
      fireEvent.click(screen.getByText('add-2'));
    });
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('total').textContent).toBe('15');
  });

  it('removes a product', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
      fireEvent.click(screen.getByText('remove-1'));
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('removes the item when quantity is set to 0', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
      fireEvent.click(screen.getByText('set-0'));
    });
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('caps quantity at 1 (unique cart enforces qty <= 1)', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
      fireEvent.click(screen.getByText('set-5'));
    });
    expect(screen.getByTestId('items').textContent).toContain('"q":1');
  });

  it('persists items to localStorage', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-1'));
    });
    const stored = JSON.parse(localStorage.getItem('cart'));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(1);
  });

  it('keeps the sole variant id for stock but hides its label', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-single-variant'));
    });
    const stored = JSON.parse(localStorage.getItem('cart'));
    expect(stored[0]).toEqual(expect.objectContaining({
      productVariantId: 60,
      variantLabel: null,
    }));
    expect(screen.getByTestId('items').textContent).toContain('"variantId":60');
    expect(screen.getByTestId('items').textContent).toContain('"label":null');
  });

  it('keeps the selected label when the product has multiple variants', () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText('add-multi-variant'));
    });
    const stored = JSON.parse(localStorage.getItem('cart'));
    expect(stored[0]).toEqual(expect.objectContaining({
      productVariantId: 71,
      variantLabel: 'B',
    }));
  });

  it('clearCart empties state and localStorage', () => {
    renderHarness();
    act(() => { fireEvent.click(screen.getByText('add-1')); });
    act(() => { fireEvent.click(screen.getByText('add-2')); });
    act(() => { fireEvent.click(screen.getByText('clear')); });
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('cart'))).toEqual([]);
  });

  it('restores a saved checkout cart snapshot', async () => {
    renderHarness();
    await act(async () => {
      fireEvent.click(screen.getByText('restore'));
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('items').textContent).toContain('"id":4');
    expect(screen.getByTestId('items').textContent).not.toContain('"id":5');
    expect(JSON.parse(localStorage.getItem('cart'))).toHaveLength(1);
  });

  it('hydrates from localStorage on mount, dropping sold-out items', async () => {
    localStorage.setItem('cart', JSON.stringify([
      { id: 1, name: 'A', price: 10, stockQuantity: 2, quantity: 1 },
      { id: 2, name: 'OOS', price: 5, stockQuantity: 0, quantity: 1 },
    ]));
    await act(async () => {
      renderHarness();
      await Promise.resolve();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('items').textContent).toContain('"id":1');
    expect(screen.getByTestId('items').textContent).not.toContain('"id":2');
  });

  it('throws when useCart is used outside CartProvider', () => {
    const err = console.error;
    console.error = jest.fn();
    function Dangling() { useCart(); return null; }
    expect(() => render(<Dangling />)).toThrow(/CartProvider/);
    console.error = err;
  });

  it('replaces the account cart when its last item is removed and stays empty after remount', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ id: 1 }));
    let server = [{ id: 1, name: 'A', price: 10, stockQuantity: 1, quantity: 1 }];
    getServerCart.mockImplementation(async () => server);
    replaceServerCart.mockImplementation(async (next) => { server = next; return next; });
    const view = renderHarness();
    await act(async () => {});
    expect(screen.getByTestId('count').textContent).toBe('1');
    await act(async () => { fireEvent.click(screen.getByText('remove-1')); });
    expect(server).toEqual([]);
    expect(syncServerCart).not.toHaveBeenCalled();
    view.unmount();
    renderHarness();
    await act(async () => {});
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('saves rapid changes in order instead of dropping the removal while an add is pending', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ id: 1 }));
    let release;
    getServerCart.mockResolvedValue([]);
    replaceServerCart.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockImplementation(async next => next);
    renderHarness();
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('add-1')); });
    await act(async () => {
      fireEvent.click(screen.getByText('add-2'));
      fireEvent.click(screen.getByText('clear'));
    });
    expect(replaceServerCart).toHaveBeenCalledTimes(1);
    await act(async () => { release([]); });
    expect(replaceServerCart.mock.calls.map(([items]) => items.map(item => item.id))).toEqual([[1], [1, 2], []]);
    expect(localStorage.getItem('cart_pending_sync')).toBeNull();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('ignores a stale account read that completes after the cart was emptied', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ id: 1 }));
    localStorage.setItem('cart', JSON.stringify([{ id: 1, name: 'A', price: 10, stockQuantity: 1 }]));
    let release;
    getServerCart.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    replaceServerCart.mockImplementation(async next => next);
    renderHarness();
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('clear')); });
    await act(async () => { release([{ id: 1, name: 'A', price: 10, stockQuantity: 1 }]); });
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(JSON.parse(localStorage.getItem('cart'))).toEqual([]);
  });

  it('retries a failed empty-cart save before loading the older server cart after reload', async () => {
    localStorage.setItem('customer_info', JSON.stringify({ id: 1 }));
    let server = [{ id: 1, name: 'A', price: 10, stockQuantity: 1 }];
    getServerCart.mockImplementation(async () => server);
    replaceServerCart.mockRejectedValueOnce(new Error('Offline'));
    const view = renderHarness();
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByText('clear')); });
    expect(JSON.parse(localStorage.getItem('cart_pending_sync')).items).toEqual([]);
    view.unmount();
    replaceServerCart.mockImplementation(async next => { server = next; return next; });
    renderHarness();
    await act(async () => {});
    expect(server).toEqual([]);
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(localStorage.getItem('cart_pending_sync')).toBeNull();
  });
});
