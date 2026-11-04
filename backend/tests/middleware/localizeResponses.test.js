import { localizeMessage } from '../../src/middleware/localizeResponses.js';

describe('localizeMessage', () => {
  it('keeps messages unchanged when no language is provided', () => {
    expect(localizeMessage('Cart is empty', null)).toBe('Cart is empty');
  });

  it('translates known API messages to French', () => {
    expect(localizeMessage('Cart is empty', 'fr')).toBe('Le panier est vide');
    expect(localizeMessage('Invalid credentials', 'fr')).toBe('Identifiants invalides');
  });

  it('translates known API messages to English', () => {
    expect(localizeMessage('Token invalide ou déjà utilisé', 'en')).toBe('Invalid or already used token');
    expect(localizeMessage('Prix invalide', 'en')).toBe('Invalid price');
  });

  it('translates dynamic product and stock errors', () => {
    expect(localizeMessage('Produit introuvable (ID 42)', 'en')).toBe('Product not found (ID 42)');
    expect(localizeMessage('Stock insuffisant pour "Bonnet". Disponible : 0, demandé : 1', 'en'))
      .toBe('Insufficient stock for "Bonnet". Available: 0, requested: 1');
  });

  it('translates missing customs information without losing the product name', () => {
    const message = 'Les informations douanières sont incomplètes pour « Bandana dentelle ».';
    expect(localizeMessage(message, 'en'))
      .toBe('Customs information is incomplete for “Bandana dentelle”.');
    expect(localizeMessage(message, 'fr')).toBe(message);
  });
});
