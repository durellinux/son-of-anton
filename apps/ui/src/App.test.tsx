import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import App from './App';
import { vi, describe, it, expect } from 'vitest';

vi.mock('./api/sdk.gen', () => ({
  issuesList: vi.fn().mockResolvedValue({
    data: {
      items: [
        {
          number: 1,
          title: 'Test Issue',
          status: 'PLANNING',
        },
      ],
    },
  }),
}));

describe('App', () => {
  it('renders title and navigation header', async () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>
    );

    expect(screen.getByText('Son of Anton')).toBeInTheDocument();
  });
});
