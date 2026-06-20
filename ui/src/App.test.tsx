import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Vitest and Testing Library Integration', () => {
  it('renders a simple element and asserts using jest-dom', () => {
    render(<div data-testid="test-div">Hello Vitest</div>);
    const element = screen.getByTestId('test-div');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello Vitest');
  });
});
