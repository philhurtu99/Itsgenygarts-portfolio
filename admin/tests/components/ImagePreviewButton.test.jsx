import { render, screen, fireEvent } from '@testing-library/react';
import ImagePreviewButton from '../../src/components/ImagePreviewButton.jsx';

it('allows opening with a button and closing with Escape or the backdrop', () => {
  render(<ImagePreviewButton src="/full.jpg" alt="Bandana" />);
  const trigger = screen.getByRole('button', { name: 'Agrandir l’image de Bandana' });
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Fermer l’aperçu' })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('dialog'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});


it('includes every distinct photo and supports arrows, keyboard and touch navigation', () => {
  render(<ImagePreviewButton src="/selected.jpg" alt="Bandana" images={[
    { imageUrl: '/second.jpg' }, { storagePathOrUrl: '/third.jpg' },
    { imageUrl: '/selected.jpg' }, { imageUrl: '/second.jpg' }, {},
  ]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Agrandir l’image de Bandana' }));
  const dialog = screen.getByRole('dialog');
  const photo = () => dialog.querySelector('img');
  expect(screen.getByText('1 / 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Agrandir l’image de Bandana' }).querySelector('.admin-image-count')).toHaveTextContent('+2');
  fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
  expect(photo()).toHaveAttribute('src', '/second.jpg');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(photo()).toHaveAttribute('src', '/third.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
  expect(photo()).toHaveAttribute('src', '/selected.jpg');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(photo()).toHaveAttribute('src', '/third.jpg');
  fireEvent.touchStart(dialog, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 100, clientY: 100 }] });
  expect(photo()).toHaveAttribute('src', '/selected.jpg');
});

it('does not show navigation arrows for a single distinct photo', () => {
  render(<ImagePreviewButton src="/only.jpg" alt="Pelote" images={[{ imageUrl: '/only.jpg' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Agrandir l’image de Pelote' }));
  expect(screen.queryByRole('button', { name: 'Photo suivante' })).not.toBeInTheDocument();
});


it('mounts outside thumbnail styles and closes on blank areas while preserving photo controls', () => {
  const { container } = render(<div className="admin-product-mobile-image"><ImagePreviewButton
    src="/one.jpg" alt="Article" images={[{ imageUrl: '/two.jpg' }]} /></div>);
  fireEvent.click(screen.getByRole('button', { name: 'Agrandir l’image de Article' }));
  const dialog = screen.getByRole('dialog');
  expect(container).not.toContainElement(dialog);
  fireEvent.click(dialog.querySelector('img'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
  expect(dialog.querySelector('img')).toHaveAttribute('src', '/two.jpg');
  fireEvent.click(screen.getByText('2 / 2'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
