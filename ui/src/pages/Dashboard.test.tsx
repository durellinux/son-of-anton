import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Dashboard } from './Dashboard';
import * as api from '../api/sdk.gen';

vi.mock('../api/sdk.gen', () => ({
  issuesList: vi.fn(),
  issuesSync: vi.fn(),
}));

describe('Dashboard Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('renders "Sync issues" button and triggers issuesSync on click', async () => {
    vi.mocked(api.issuesList).mockResolvedValue({
      data: {
        items: [
          {
            number: 1,
            title: 'Test Issue',
            status: 'PLANNING' as any,
          },
        ],
      },
    } as any);
    vi.mocked(api.issuesSync).mockResolvedValue({} as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </MantineProvider>
      </QueryClientProvider>
    );

    const syncButton = await screen.findByRole('button', { name: /sync issues/i });
    expect(syncButton).toBeInTheDocument();

    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.issuesSync).toHaveBeenCalledTimes(1);
    });
  });
});
