import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminYarn from '../../src/pages/admin/Yarn.jsx';
import { adminGetYarnProducts, adminGetYarnCategories } from '../../src/services/api.js';

jest.mock('../../src/pages/admin/Dashboard.jsx', () => ({ AdminSidebar: () => null }));
jest.mock('../../src/services/api.js', () => ({
  adminGetYarnProducts: jest.fn(), adminGetYarnCategories: jest.fn(),
}));
const categories = [{id:1,name:'Mérino'},{id:2,name:'Coton'},{id:3,name:'Catégorie vide',isActive:false}];
const yarn = [
  {id:1,name:'Pelote disponible',categoryId:1,category:categories[0],price:'25.00',stockQuantity:3},
  {id:2,name:'Pelote vendue',categoryId:1,category:categories[0],price:'15.00',stockQuantity:0,soldOut:false},
  {id:3,name:'Pelote coton',categoryId:2,category:categories[1],price:'100.50',stockQuantity:1},
  {id:4,name:'Deuxième pelote',categoryId:1,category:categories[0],price:'35.00',stockQuantity:2},
];
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), {target:{value}});
const names = () => [...document.querySelectorAll('tbody td[data-label="Nom"]')].map(n=>n.textContent);
async function setup(items=yarn) {
  adminGetYarnProducts.mockResolvedValue(items);
  adminGetYarnCategories.mockResolvedValue(categories);
  render(<AdminYarn />);
  await waitFor(()=>expect(screen.getByLabelText('Statut')).toBeInTheDocument());
}
beforeEach(()=>jest.clearAllMocks());

it('keeps every admin category and the filters usable with no yarn', async()=>{
  await setup([]);
  expect(adminGetYarnCategories).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('option',{name:'Catégorie vide'})).toBeInTheDocument();
  change('Catégorie','3'); change('Statut','sold'); change('Prix maximum ($)','0');
  expect(names()).toEqual([]);
  expect(screen.getByRole('status')).toHaveTextContent('0 laine');
  fireEvent.click(screen.getByRole('button',{name:'Réinitialiser'}));
  expect(screen.getByLabelText('Catégorie')).toHaveValue('all');
});

it('uses actual stock and combines category, status and inclusive price bounds', async()=>{
  await setup();
  change('Statut','sold'); expect(names()).toEqual(['Pelote vendue']);
  change('Statut','in-stock'); change('Catégorie','1');
  change('Prix minimum ($)','25'); change('Prix maximum ($)','35');
  expect(names()).toEqual(['Pelote disponible','Deuxième pelote']);
  expect([...document.querySelectorAll('.admin-product-mobile-card h2')].map(n=>n.textContent)).toEqual(names());
  change('Prix maximum ($)','0'); expect(names()).toEqual([]);
});

it('sorts prices numerically and reset restores the fetched order', async()=>{
  await setup();
  change('Trier par prix','asc');
  expect(names()).toEqual(['Pelote vendue','Pelote disponible','Deuxième pelote','Pelote coton']);
  change('Trier par prix','desc');
  expect(names()).toEqual(['Pelote coton','Deuxième pelote','Pelote disponible','Pelote vendue']);
  fireEvent.click(screen.getByRole('button',{name:'Réinitialiser'}));
  expect(names()).toEqual(yarn.map(p=>p.name));
});

it('preserves decimal boundaries and shows an empty category correctly', async()=>{
  await setup();
  change('Catégorie','2'); change('Prix minimum ($)','100.50'); change('Prix maximum ($)','100.50');
  expect(names()).toEqual(['Pelote coton']);
  change('Prix minimum ($)','100.51'); expect(names()).toEqual([]);
  change('Prix minimum ($)',''); change('Prix maximum ($)',''); change('Catégorie','3');
  expect(names()).toEqual([]);
});


it('opens the exact thumbnail on desktop and mobile without editing the item', async () => {
  const items = yarn.map((item, index) => index === 0 ? { ...item, mainImageUrl: '/preview.jpg', images: [{ imageUrl: '/preview.jpg' }, { imageUrl: '/detail.jpg' }], variants: [{ images: [{ imageUrl: '/preview.jpg' }, { imageUrl: '/variant.jpg' }] }] } : item);
  adminGetYarnProducts.mockResolvedValue(items);
  adminGetYarnCategories.mockResolvedValue(categories);
  render(<AdminYarn />);
  const buttons = await screen.findAllByRole('button', { name: 'Agrandir l’image de Pelote disponible' });
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Aperçu des images' });
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/preview.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo suivante' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/detail.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Photo précédente' }));
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/preview.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  }
});
