import { render, screen, fireEvent } from '@testing-library/react';
import ProductWizard, { WizardStep, errorsForStep } from '../../src/components/ProductWizard.jsx';

function setup(props = {}) {
  const validate = jest.fn(() => ({}));
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(<ProductWizard title="Nouveau produit" validate={validate} onSave={onSave} onClose={onClose} {...props}>
    {(step) => <><WizardStep index={0} activeStep={step}><input aria-label="Nom test" /></WizardStep>
      <WizardStep index={1} activeStep={step}>Photos test</WizardStep></>}
  </ProductWizard>);
  return { validate, onSave, onClose };
}

it('keeps fields and focus while navigating, and saves only on the last step', () => {
  const { validate, onSave } = setup();
  fireEvent.change(screen.getByLabelText('Nom test'), { target: { value: 'Bonnet' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  expect(validate).toHaveBeenLastCalledWith(0);
  expect(screen.getByRole('heading', { name: 'Photos' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
  expect(screen.getByLabelText('Nom test')).toHaveValue('Bonnet');
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  expect(onSave).toHaveBeenCalledTimes(1);
});

it('blocks invalid steps and sends final validation failures to their step', () => {
  const validate = jest.fn((step) => step === 0 ? { name: 'Required' } : {});
  const { onSave } = setup({ validate });
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
  expect(screen.getByRole('heading', { name: 'Informations' })).toBeVisible();
  validate.mockReturnValue({});
  fireEvent.click(screen.getByRole('button', { name: '4. Publication' }));
  validate.mockReturnValue({ package: 'Missing measures' });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
  expect(screen.getByRole('heading', { name: 'Expédition' })).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
});

it('disables close and navigation during a save or upload', () => {
  const { onClose } = setup({ busy: true });
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
});

it('maps validation errors to the appropriate step', () => {
  expect(errorsForStep({ name: 'x', customs: 'y', images: 'z' }, 2)).toEqual({ customs: 'y' });
});
