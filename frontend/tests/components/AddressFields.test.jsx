process.env.VITE_MAPBOX_TOKEN = 'pk.test';

const React = require('react');
const { act, fireEvent, render, screen, waitFor } = require('@testing-library/react');
const AddressFields = require('../../src/components/AddressFields.jsx').default;

function t(key) {
  const labels = {
    'form.address': 'Adresse',
    'form.city': 'Ville',
    'form.country': 'Pays',
    'form.countryCode': 'Code pays ISO (2 lettres)',
    'form.postalCode': 'Code postal',
    'form.province': 'Province',
    'form.select': '-- Selectionner --',
    'checkout.searchAddress': 'Rechercher votre adresse...',
    'countries.CA': 'Canada',
    'countries.US': 'Etats-Unis',
    'countries.FR': 'France',
    'countries.GB': 'Royaume-Uni',
    'countries.OTHER': 'Autre',
  };
  return labels[key] || key;
}

function AddressFieldsHarness() {
  const [form, setForm] = React.useState({
    address: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
  });
  const [errors, setErrors] = React.useState({});

  return (
    <>
      <AddressFields form={form} setForm={setForm} errors={errors} setErrors={setErrors} t={t} />
      <output data-testid="form-state">{JSON.stringify(form)}</output>
    </>
  );
}

describe('AddressFields', () => {
  it('disables the US option while retaining Canada and other international destinations', () => {
    render(<AddressFieldsHarness />);
    expect(screen.getByRole('option', { name: 'Etats-Unis' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Canada' })).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'France' })).not.toBeDisabled();
  });
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        features: [{
          id: 'address.us.1',
          address: '429',
          text: 'State Rd',
          place_name: '429 State Rd, Dartmouth, Massachusetts 02747, United States',
          context: [
            { id: 'place.1', text: 'Dartmouth' },
            { id: 'postcode.1', text: '02747' },
            { id: 'region.1', short_code: 'US-MA' },
            { id: 'country.1', short_code: 'us' },
          ],
        }],
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('updates country and province from the selected address result', async () => {
    render(<AddressFieldsHarness />);

    fireEvent.change(screen.getByPlaceholderText('Rechercher votre adresse...'), {
      target: { value: '429 state rd, dartmouth, Ma' },
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.getByText('429 State Rd, Dartmouth, Massachusetts 02747, United States')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('429 State Rd, Dartmouth, Massachusetts 02747, United States'));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('form-state').textContent)).toMatchObject({
        address: '429 State Rd',
        city: 'Dartmouth',
        province: 'MA',
        postalCode: '02747',
        country: 'US',
      });
    });
  });

  it('accepts a custom two-letter international country code', () => {
    render(<AddressFieldsHarness />);

    fireEvent.change(screen.getByLabelText(/^Pays/), { target: { value: 'OTHER' } });
    const countryCode = screen.getByLabelText('Code pays ISO (2 lettres)');
    fireEvent.change(countryCode, { target: { value: 'D' } });
    expect(countryCode).toHaveValue('D');
    fireEvent.change(countryCode, { target: { value: 'DE' } });

    expect(JSON.parse(screen.getByTestId('form-state').textContent)).toMatchObject({ country: 'DE' });
  });
});
