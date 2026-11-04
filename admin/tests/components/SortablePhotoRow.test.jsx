import { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SortablePhotoRow from '../../src/components/SortablePhotoRow.jsx';

const photos = [{ id: 1, imageUrl: '/one.jpg' }, { id: 2, imageUrl: '/two.jpg' }, { id: 3, imageUrl: '/three.jpg' }];
let reorder;
const originalPointerEvent = window.PointerEvent;
const originalElementFromPoint = document.elementFromPoint;
beforeAll(() => {
  window.PointerEvent = class extends MouseEvent {
    constructor(type, options = {}) {
      super(type, options);
      Object.defineProperty(this, 'pointerId', { value: options.pointerId ?? 1 });
      Object.defineProperty(this, 'pointerType', { value: options.pointerType ?? 'mouse' });
    }
  };
});
afterAll(() => { window.PointerEvent = originalPointerEvent; document.elementFromPoint = originalElementFromPoint; });
beforeEach(() => { reorder = jest.fn(); });
afterEach(() => jest.useRealTimers());
function Harness({ fail = false, disabled = false }) {
  const [images, setImages] = useState(photos);
  const save = async next => { reorder(next); if (fail) throw new Error('Network failed'); setImages(next); };
  return <SortablePhotoRow images={images} disabled={disabled} onReorder={save} renderImage={image => <img src={image.imageUrl} alt={`image-${image.id}`} />} />;
}
const ids = () => [...document.querySelectorAll('[data-sortable-photo]')].map(node => Number(node.dataset.sortablePhoto));
function movePhoto(pointerType = 'mouse') {
  const items = screen.getAllByRole('listitem');
  document.elementFromPoint = jest.fn(() => items[0]);
  fireEvent.pointerDown(items[2], { pointerId: 1, pointerType, button: 0, clientX: 180, clientY: 20 });
  return () => fireEvent.pointerMove(window, { pointerId: 1, pointerType, clientX: 10, clientY: 20 });
}
it('drags a saved photo to the first position and persists the new order on release', async () => {
  render(<Harness />);
  movePhoto()();
  expect(ids()).toEqual([3, 1, 2]);
  expect(reorder).not.toHaveBeenCalled();
  fireEvent.pointerUp(window, { pointerId: 1 });
  await waitFor(() => expect(ids()).toEqual([3, 1, 2]));
  expect(reorder).toHaveBeenCalledWith([photos[2], photos[0], photos[1]]);
});
it('requires a hold for touch then reorders on the same pointer gesture', async () => {
  jest.useFakeTimers();
  render(<Harness />);
  const move = movePhoto('touch');
  move(); expect(ids()).toEqual([1, 2, 3]);
  act(() => jest.advanceTimersByTime(220));
  move(); expect(ids()).toEqual([3, 1, 2]);
  await act(async () => fireEvent.pointerUp(window, { pointerId: 1, pointerType: 'touch' }));
  expect(reorder).toHaveBeenCalledWith([photos[2], photos[0], photos[1]]);
});
it('restores the existing order on a cancelled gesture without saving', () => {
  render(<Harness />);
  movePhoto()();
  fireEvent.pointerCancel(window, { pointerId: 1 });
  expect(ids()).toEqual([1, 2, 3]);
  expect(reorder).not.toHaveBeenCalled();
});
it('restores the saved order if the API rejects the reorder', async () => {
  render(<Harness fail />);
  movePhoto()();
  fireEvent.pointerUp(window, { pointerId: 1 });
  await waitFor(() => expect(ids()).toEqual([1, 2, 3]));
});
it('supports keyboard movement and prevents movement while saving', async () => {
  const view = render(<Harness />);
  fireEvent.keyDown(screen.getAllByRole('listitem')[1], { key: 'ArrowLeft' });
  await waitFor(() => expect(ids()).toEqual([2, 1, 3]));
  reorder.mockClear();
  view.rerender(<Harness disabled />);
  fireEvent.keyDown(screen.getAllByRole('listitem')[1], { key: 'ArrowLeft' });
  expect(reorder).not.toHaveBeenCalled();
});
