import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomerPrefillInput from '../../src/components/CustomerPrefillInput.jsx';

function Harness({ onSelect = () => {} }) {
  const [value, setValue] = useState('');
  return (
    <CustomerPrefillInput
      type="text"
      className="form-input"
      value={value}
      suggestion="Alice Client"
      onChange={setValue}
      onSelectSuggestion={onSelect}
    />
  );
}

describe('CustomerPrefillInput', () => {
  it('shows a saved customer suggestion while typing a matching prefix', () => {
    render(<Harness />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Ali' } });

    expect(screen.getByRole('button', { name: 'Alice Client' })).toBeInTheDocument();
  });

  it('selects the suggestion when clicked', () => {
    const onSelect = jest.fn();
    render(<Harness onSelect={onSelect} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Ali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Alice Client' }));

    expect(onSelect).toHaveBeenCalledWith('Alice Client');
  });
});
