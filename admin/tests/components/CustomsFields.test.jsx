import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomsFields, { customsInitial, customsPayload, validateCustomsForm } from '../../src/components/CustomsFields.jsx';
import { adminGetCustomsProfiles } from '../../src/services/api.js';

jest.mock('../../src/services/api.js', () => ({ adminGetCustomsProfiles: jest.fn() }));
const profile = { key: 'hat', kind: 'product', name: 'Bonnet acrylique', scope: '100 % acrylique', description: 'Crocheted acrylic hat', hsCode: '650500', usHtsCode: '6505006090', source: 'https://rulings.cbp.gov/' };
beforeEach(() => adminGetCustomsProfiles.mockReset().mockResolvedValue([profile]));

describe('Customs fields', () => {
  it('keeps unknown cardigan composition as a permanent unknown rather than asking for percentages or assigning merino', async () => {
    function Harness() {
      const [form, setForm] = useState(customsInitial());
      return <><CustomsFields form={form} category={{ id: 7, nameFr: 'Cardigan' }}
        onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} />
        <output data-testid="payload">{JSON.stringify(customsPayload(form))}</output>
        <output data-testid="validation">{validateCustomsForm(form)}</output></>;
    }
    render(<Harness />);
    await waitFor(() => expect(adminGetCustomsProfiles).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Oui, c’est ça' }));
    expect(screen.getByText(/Composition inconnue/)).toBeVisible();
    expect(screen.queryByLabelText('Composition du produit fini')).not.toBeInTheDocument();
    expect(screen.queryByText(/à vérifier plus tard/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pays où l’article a été fabriqué'), { target: { value: 'CA' } });
    fireEvent.change(screen.getByLabelText('Poids net sans emballage (g)'), { target: { value: '80' } });
    expect(JSON.parse(screen.getByTestId('payload').textContent)).toMatchObject({ customsProfileKey: null, customsHsCode: null, customsDescription: null, customsOriginCountry: 'CA', customsWeightGrams: 80 });
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
  });

  it('proposes a question from the category without assigning a code or origin before confirmation', async () => {
    adminGetCustomsProfiles.mockResolvedValue([{ ...profile, key: 'international-crocheted-scarf', internationalOnly: true, articleType: 'flat-scarf' }]);
    const onChange = jest.fn();
    render(<CustomsFields form={customsInitial()} category={{ id: 1, nameFr: 'Bandanas' }} onChange={onChange} />);
    await screen.findByRole('button', { name: 'Oui, c’est ça' });
    expect(onChange).not.toHaveBeenCalledWith('customsProfileKey', 'international-crocheted-scarf');
    expect(onChange).not.toHaveBeenCalledWith('customsOriginCountry', 'CA');
    fireEvent.click(screen.getByRole('button', { name: 'C’est autre chose' }));
    expect(screen.getByLabelText('Type d’article')).toHaveValue('');
  });

  it('classifies textile footwear from its sole without requiring yarn composition and rechecks changed characteristics', async () => {
    const rubber = { key: 'international-crocheted-footwear-rubber-plastic', kind: 'product', internationalOnly: true, requiresConfirmation: true,
      name: 'Pantoufles en textile', articleType: 'crocheted-footwear', material: 'rubber-plastic', materialLabel: 'Caoutchouc ou plastique',
      materialQuestion: 'Matière de la semelle extérieure', description: 'Crocheted textile footwear with rubber soles', hsCode: '640419' };
    adminGetCustomsProfiles.mockResolvedValue([rubber, { ...rubber, key: 'international-crocheted-footwear-leather', material: 'leather', materialLabel: 'Cuir', hsCode: '640420' }]);
    function Harness() {
      const [form, setForm] = useState(customsInitial({ customsWeightGrams: 80, customsOriginCountry: 'CA' }));
      return <><CustomsFields form={form} category={{ id: 42, name: 'Bottes' }}
        onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} />
        <output data-testid="payload">{JSON.stringify(customsPayload(form))}</output>
        <output data-testid="validation">{validateCustomsForm(form)}</output></>;
    }
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Oui, c’est ça' }));
    fireEvent.change(screen.getByLabelText('Matière de la semelle extérieure'), { target: { value: 'rubber-plastic' } });
    expect(screen.queryByLabelText('Composition du produit fini')).not.toBeInTheDocument();
    expect(screen.getByTestId('payload')).toHaveTextContent('640419');
    expect(screen.getByTestId('validation')).toHaveTextContent('Confirme');
    fireEvent.click(screen.getByLabelText('Ces caractéristiques correspondent à mon article'));
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
    fireEvent.change(screen.getByLabelText('Matière de la semelle extérieure'), { target: { value: 'leather' } });
    expect(screen.getByTestId('payload')).toHaveTextContent('640420');
    expect(screen.getByLabelText('Ces caractéristiques correspondent à mon article')).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Matière de la semelle extérieure'), { target: { value: 'unknown' } });
    expect(JSON.parse(screen.getByTestId('payload').textContent)).toMatchObject({ customsProfileKey: null, customsHsCode: null, customsWeightGrams: 80, customsOriginCountry: 'CA' });
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
  });

  it('prepares a bandana without fibre questions and only needs its measured weight and manufacture country', async () => {
    const scarf = { key: 'international-crocheted-scarf', kind: 'product', internationalOnly: true,
      name: 'Bandana ou foulard au crochet', articleType: 'flat-scarf', articleLabel: 'Bandana ou foulard au crochet',
      description: 'Hand crocheted textile bandana, fibre composition unspecified', hsCode: '611710' };
    adminGetCustomsProfiles.mockResolvedValue([scarf, { ...scarf, key: 'cotton-scarf', internationalOnly: false, material: 'cotton', materialLabel: '100 % coton' }]);
    function Harness() {
      const [form, setForm] = useState({ ...customsInitial(), packageWeightGrams: 35 });
      return <><CustomsFields form={form} category={{ id: 1, name: 'Bandana', customsOriginCountry: 'CA' }} onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} />
        <output data-testid="payload">{JSON.stringify(customsPayload(form))}</output><output data-testid="validation">{validateCustomsForm(form)}</output></>;
    }
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Oui, c’est ça' }));
    expect(screen.queryByLabelText('Composition du produit fini')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('CA');
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
    expect(screen.getByText(/À compléter avant une livraison internationale/)).toHaveTextContent('poids de l’article');
    fireEvent.change(screen.getByLabelText('Poids net sans emballage (g)'), { target: { value: '30' } });
    expect(screen.queryByText(/À compléter avant une livraison internationale/)).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('payload').textContent)).toMatchObject({ customsProfileKey: scarf.key, customsHsCode: '611710', customsWeightGrams: 30, customsOriginCountry: 'CA' });
    expect(screen.getByLabelText('Code douanier HS')).not.toBeVisible();
    fireEvent.change(screen.getByLabelText('Poids net sans emballage (g)'), { target: { value: '40' } });
    expect(screen.getByTestId('validation')).toHaveTextContent('poids emballé');
  });

  it('inherits a simple category profile without a fibre question or a second confirmation', async () => {
    adminGetCustomsProfiles.mockResolvedValue([{ ...profile, key: 'international-crocheted-scarf', internationalOnly: true, articleType: 'flat-scarf' }]);
    function Harness() {
      const [form, setForm] = useState(customsInitial());
      return <><CustomsFields form={form} category={{ id: 1, customsProfileKey: 'international-crocheted-scarf', customsOriginCountry: 'CA' }}
        onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} /><output>{JSON.stringify(customsPayload(form))}</output></>;
    }
    render(<Harness />);
    await screen.findByText('Canada', { exact: true });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Type d’article')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personnaliser cet article' })).toBeVisible();
  });

  it('reopens a saved product matching its category with only the net weight to enter', async () => {
    const category = { id: 1, name: 'Bandana', customsProfileKey: 'international-crocheted-scarf', customsOriginCountry: 'CA' };
    const scarf = { ...profile, key: category.customsProfileKey, internationalOnly: true, articleType: 'flat-scarf' };
    adminGetCustomsProfiles.mockResolvedValue([scarf]);
    const form = customsInitial({ customsProfileKey: scarf.key, customsOriginCountry: 'CA', customsHsCode: '611710', customsDescription: 'Crocheted scarf', customsWeightGrams: 30 }, category);
    expect(form.customsFollowCategory).toBe(true);
    render(<CustomsFields form={form} category={category} onChange={jest.fn()} />);
    await screen.findByText('Canada', { exact: true });
    expect(screen.getByLabelText('Poids net sans emballage (g)')).toBeVisible();
    expect(screen.queryByLabelText('Pays où l’article a été fabriqué')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Type d’article')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Code douanier HS')).not.toBeVisible();
  });

  it('does not substitute a pure-fibre profile when the available profiles require an unknown composition', async () => {
    const cotton = { ...profile, key: 'cotton-crocheted-scarf', articleType: 'flat-scarf', articleLabel: 'Bandana au crochet', material: 'cotton', materialLabel: '100 % coton', hsCode: '611710', usHtsCode: '6117106010' };
    const acrylic = { ...cotton, key: 'acrylic-crocheted-scarf', material: 'acrylic', materialLabel: '100 % acrylique', usHtsCode: '6117102030' };
    adminGetCustomsProfiles.mockResolvedValue([cotton, acrylic]);
    function Harness() {
      const [form, setForm] = useState(customsInitial({ customsWeightGrams: 30, packageWeightGrams: 35 }));
      return <><CustomsFields form={form} category={{ id: 1, name: 'Bandana', customsOriginCountry: 'CA' }} onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} /><output data-testid="payload">{JSON.stringify(customsPayload(form))}</output></>;
    }
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Oui, c’est ça' }));
    expect(screen.queryByLabelText('Composition du produit fini')).not.toBeInTheDocument();
    expect(screen.getByText(/Composition inconnue/)).toBeVisible();
    expect(screen.getByLabelText('Poids net sans emballage (g)')).toHaveValue(30);
    expect(screen.getByLabelText('Code douanier HS')).not.toBeVisible();
    expect(screen.getByTestId('payload')).toHaveTextContent('"customsProfileKey":null');
    expect(screen.getByTestId('payload')).toHaveTextContent('"customsHsCode":null');
  });

  it('inherits the category origin while preserving an explicit product origin', async () => {
    function Harness({ category }) {
      const [form, setForm] = useState(customsInitial());
      return <CustomsFields form={form} category={category} onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} />;
    }
    const { rerender } = render(<Harness category={{ id: 1, customsProfileKey: 'hat', customsOriginCountry: 'CA' }} />);
    await waitFor(() => expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('CA'));
    rerender(<Harness category={{ id: 2, customsProfileKey: 'hat', customsOriginCountry: 'US' }} />);
    await waitFor(() => expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('US'));
    fireEvent.change(screen.getByLabelText('Pays où l’article a été fabriqué'), { target: { value: 'FR' } });
    rerender(<Harness category={{ id: 3, customsProfileKey: 'hat', customsOriginCountry: 'CA' }} />);
    await waitFor(() => expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('FR'));
  });
  it('leaves existing articles without guessed customs data', () => {
    expect(customsInitial()).toMatchObject({ customsProfileKey: '', customsMode: '', customsProfileConfirmed: false });
    expect(customsPayload(customsInitial())).toEqual({ customsProfileKey: null, customsDescription: null, customsWeightGrams: null, customsOriginCountry: null, customsHsCode: null });
  });

  it('preserves fractional weight and leading zeroes in tariff codes', () => {
    expect(customsPayload({ customsDescription: ' Cotton yarn ', customsWeightGrams: '99.5', customsOriginCountry: 'us', customsHsCode: '012345' })).toEqual({ customsProfileKey: null, customsDescription: 'Cotton yarn', customsWeightGrams: 99.5, customsOriginCountry: 'US', customsHsCode: '012345' });
  });

  it('preserves legacy manual fields and allows other origin countries', async () => {
    const onChange = jest.fn();
    render(<CustomsFields form={customsInitial({ customsDescription: 'Hat', customsHsCode: '650500' })} onChange={onChange} />);
    await waitFor(() => expect(adminGetCustomsProfiles).toHaveBeenCalled());
    expect(screen.getByText('Réglages avancés').closest('details')).toHaveAttribute('open');
    fireEvent.change(screen.getByLabelText('Autre pays de fabrication (code ISO)'), { target: { value: 'jp' } });
    expect(onChange).toHaveBeenCalledWith('customsOriginCountry', 'JP');
    expect(screen.getByLabelText('Code douanier HS')).toHaveValue('650500');
  });

  it('fills a profile, retains origin and weight, and requires confirmation', async () => {
    function Harness() {
      const [form, setForm] = useState({ ...customsInitial(), customsWeightGrams: 100, customsOriginCountry: 'CA' });
      return <><CustomsFields form={form} onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} /><output data-testid="validation">{validateCustomsForm(form)}</output></>;
    }
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Type d’article'), { target: { value: 'hat' } });
    expect(screen.getByTestId('validation')).toHaveTextContent('Confirme');
    expect(screen.getByLabelText('Poids net sans emballage (g)')).toHaveValue(100);
    expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('CA');
    expect(screen.getByLabelText('Code douanier HS')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByLabelText('Ces caractéristiques correspondent à mon article'));
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
    fireEvent.change(screen.getByLabelText('Type d’article'), { target: { value: '' } });
    expect(screen.queryByLabelText('Pays où l’article a été fabriqué')).not.toBeInTheDocument();
    expect(screen.getByTestId('validation')).toBeEmptyDOMElement();
  });

  it('filters profiles by item type', async () => {
    render(<CustomsFields kind="yarn" form={customsInitial()} onChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
    expect(screen.queryByRole('option', { name: profile.name })).not.toBeInTheDocument();
  });

  it('allows retry when the profile API is unavailable', async () => {
    adminGetCustomsProfiles.mockRejectedValueOnce(new Error('offline'));
    render(<CustomsFields form={customsInitial()} onChange={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('option', { name: profile.name });
    expect(adminGetCustomsProfiles).toHaveBeenCalledTimes(2);
  });

  it('rejects partial data and net weight above packaged weight', () => {
    expect(validateCustomsForm(customsInitial())).toBeNull();
    expect(validateCustomsForm(customsInitial({ customsHsCode: '650500' }))).toBeTruthy();
    expect(validateCustomsForm({ ...customsInitial({ customsHsCode: '650500', customsOriginCountry: 'CA', customsDescription: 'Hat', customsWeightGrams: 300 }), packageWeightGrams: 200 })).toContain('poids net');
  });

  it('uses the real category profile and resets confirmation when that category changes', async () => {
    const painting = { ...profile, key: 'painting', name: 'Peinture originale', description: 'Original hand painted artwork', hsCode: '970191' };
    adminGetCustomsProfiles.mockResolvedValue([profile, painting]);
    function Harness({ category }) {
      const [form, setForm] = useState({ ...customsInitial(), customsWeightGrams: 100, customsOriginCountry: 'CA' });
      return <><CustomsFields form={form} category={category} onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} /><output data-testid="code">{form.customsHsCode}</output></>;
    }
    const { rerender } = render(<Harness category={{ id: 20, nameFr: 'Bonnets', customsProfileKey: 'hat' }} />);
    await waitFor(() => expect(screen.getByTestId('code')).toHaveTextContent('650500'));
    expect(screen.getByText('Bonnets')).toBeVisible();
    expect(screen.queryByLabelText('Type d’article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Ces caractéristiques correspondent à mon article'));
    rerender(<Harness category={{ id: 21, nameFr: 'Art', customsProfileKey: 'painting' }} />);
    await waitFor(() => expect(screen.getByTestId('code')).toHaveTextContent('970191'));
    expect(screen.getByText('Art')).toBeVisible();
    expect(screen.getByLabelText('Ces caractéristiques correspondent à mon article')).not.toBeChecked();
    expect(screen.getByLabelText('Poids net sans emballage (g)')).toHaveValue(100);
    expect(screen.getByLabelText('Pays où l’article a été fabriqué')).toHaveValue('CA');
    rerender(<Harness category={{ id: 22, nameFr: 'Bandanas' }} />);
    await waitFor(() => expect(screen.getByTestId('code')).toBeEmptyDOMElement());
    expect(screen.getByLabelText('Type d’article')).toHaveValue('');
  });

  it('does not overwrite saved item classification with a category default', async () => {
    render(<CustomsFields category={{ id: 1, name: 'Bonnets', customsProfileKey: 'hat' }}
      form={customsInitial({ customsDescription: 'Cotton hat', customsHsCode: '650500' })} onChange={jest.fn()} />);
    await screen.findByRole('button', { name: 'Utiliser le profil de la catégorie' });
    expect(screen.getByLabelText('Description douanière en anglais')).toHaveValue('Cotton hat');
    expect(screen.getByRole('button', { name: 'Utiliser le profil de la catégorie' })).toBeVisible();
  });

  it('allows item-specific overrides and returning to the category default', async () => {
    function Harness() {
      const [form, setForm] = useState(customsInitial());
      return <CustomsFields category={{ id: 1, name: 'Bonnets', customsProfileKey: 'hat' }} form={form}
        onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))} />;
    }
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personnaliser cet article' }));
    fireEvent.click(screen.getByText('Réglages avancés'));
    fireEvent.click(screen.getByRole('button', { name: 'Renseigner un code personnalisé' }));
    fireEvent.change(screen.getByLabelText('Code douanier HS'), { target: { value: '123456' } });
    expect(screen.getByLabelText('Code douanier HS')).toHaveValue('123456');
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser le profil de la catégorie' }));
    await waitFor(() => expect(screen.getByLabelText('Code douanier HS')).toHaveValue('650500'));
    expect(screen.getByLabelText('Ces caractéristiques correspondent à mon article')).not.toBeChecked();
  });

  it('never infers a code from a marketing category name alone', async () => {
    render(<CustomsFields category={{ id: 1, name: 'Bonnet acrylique' }} form={customsInitial()} onChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
    expect(screen.getByLabelText('Type d’article')).toHaveValue('');
  });
});

 it('allows a mixed or unknown composition to be saved without inventing a customs classification', () => {
   expect(validateCustomsForm({ customsMode: 'guided', customsProfileKey: '', customsMaterial: 'other' })).toBeNull();
   expect(customsPayload({ customsMode: 'guided', customsMaterial: 'other' })).toMatchObject({ customsProfileKey: null, customsHsCode: null, customsDescription: null });
 });

 it('keeps incomplete article customs separate from pure-fibre category defaults when reopened', async () => {
   const saved = customsInitial({ customsWeightGrams: 30, customsOriginCountry: 'CA' });
   expect(saved).toMatchObject({ customsMode: 'guided', customsFollowCategory: false, customsProfileKey: '' });
   expect(validateCustomsForm(saved)).toBeNull();
   const onChange = jest.fn();
   render(<CustomsFields form={saved} category={{ id: 1, customsProfileKey: 'hat', customsOriginCountry: 'CA' }} onChange={onChange} />);
   await waitFor(() => expect(screen.getByLabelText('Type d’article')).not.toBeDisabled());
   expect(onChange).not.toHaveBeenCalledWith('customsProfileKey', 'hat');
   expect(screen.getByText(/Classification douanière non déterminée/)).toBeVisible();
   expect(validateCustomsForm({ ...saved, customsWeightGrams: 40, packageWeightGrams: 35 })).toMatch(/poids emballé/);
 });
