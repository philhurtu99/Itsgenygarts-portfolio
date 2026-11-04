process.env.VITE_MAPBOX_TOKEN = 'pk.test';

const React = require('react');
const { act, fireEvent, render, screen, waitFor } = require('@testing-library/react');
const AddressAutocomplete = require('../../src/components/AddressAutocomplete.jsx').default;

describe('AddressAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        features: [{
          id: 'address.1',
          address: '524',
          text: 'Rue de Test',
          place_name: '524 Rue de Test, Montreal, Quebec H2X 1Y4, Canada',
          context: [
            { id: 'place.1', text: 'Montreal' },
            { id: 'postcode.1', text: 'H2X 1Y4' },
            { id: 'region.1', short_code: 'CA-QC' },
            { id: 'country.1', short_code: 'ca' },
          ],
        }],
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('shows Mapbox suggestions from a controlled address input', async () => {
    const onChange = jest.fn();
    const onSelect = jest.fn();
    render(
      <AddressAutocomplete
        value=""
        onChange={onChange}
        onSelect={onSelect}
        country="CA"
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '524 rue' } });
    await act(async () => { jest.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(screen.getByText('524 Rue de Test, Montreal, Quebec H2X 1Y4, Canada')).toBeInTheDocument();
    });
    const requestUrl = global.fetch.mock.calls[0][0];
    expect(requestUrl).toContain('524%20rue');
    expect(requestUrl).not.toContain('&country=');

    fireEvent.click(screen.getByText('524 Rue de Test, Montreal, Quebec H2X 1Y4, Canada'));
    expect(onSelect).toHaveBeenCalledWith({
      address: '524 Rue de Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
  });

  it('uses the typed country hint instead of the selected form country', async () => {
    render(
      <AddressAutocomplete
        value=""
        onChange={jest.fn()}
        onSelect={jest.fn()}
        country="CA"
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '429 state rd, dartmouth, Ma' } });
    await act(async () => { jest.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const requestUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(requestUrl.searchParams.get('country')).toBe('us');
  });
});
