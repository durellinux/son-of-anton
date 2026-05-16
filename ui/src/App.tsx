import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell, Title, Container } from '@mantine/core'
import { Dashboard } from './pages/Dashboard'
import { IssueDetail } from './pages/IssueDetail'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell
          header={{ height: 60 }}
          padding="md"
        >
          <AppShell.Header p="md">
            <Title order={3}>Son of Anton</Title>
          </AppShell.Header>

          <AppShell.Main>
            <Container size="xl">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/issues/:number" element={<IssueDetail />} />
              </Routes>
            </Container>
          </AppShell.Main>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
