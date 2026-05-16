import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Title, Text, Badge, Button, Group, Stack, 
  Card, Timeline, ScrollArea, Loader, Center, 
  Breadcrumbs, Anchor, Code, Modal
} from '@mantine/core'
import { issuesGet, issuesListSessions, issuesGetSessionContent } from '../api/sdk.gen'
import { IssueStatus } from '../api/types.gen'

export function IssueDetail() {
  const { number } = useParams<{ number: string }>()
  const issueNumber = Number(number)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)

  const { data: issue, isLoading: isLoadingIssue } = useQuery({
    queryKey: ['issue', issueNumber],
    queryFn: () => issuesGet({ path: { number: issueNumber } }),
  })

  const { data: sessions, isLoading: isLoadingSessions } = useQuery({
    queryKey: ['sessions', issueNumber],
    queryFn: () => issuesListSessions({ path: { number: issueNumber } }),
  })

  const { data: sessionContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ['session-content', issueNumber, selectedSession],
    queryFn: () => issuesGetSessionContent({ path: { number: issueNumber, id: selectedSession! } }),
    enabled: !!selectedSession,
  })

  if (isLoadingIssue) return <Center h={400}><Loader /></Center>
  if (!issue?.data) return <Center h={400}><Title order={4}>Issue not found</Title></Center>

  return (
    <Stack gap="xl">
      <Breadcrumbs>
        <Anchor component={Link} to="/">Dashboard</Anchor>
        <Text>Issue #{issue.data.number}</Text>
      </Breadcrumbs>

      <Card withBorder padding="xl" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={1}>{issue.data.title}</Title>
            <Badge size="lg" color={getStatusColor(issue.data.status)}>
              {issue.data.status}
            </Badge>
          </Group>
          <Text size="lg" c="dimmed">Branch: {issue.data.branchName || 'N/A'}</Text>
        </Stack>
      </Card>

      <Title order={2}>Sessions</Title>
      
      {isLoadingSessions ? <Loader /> : (
        <Timeline active={sessions?.data?.items.length || 0} bulletSize={24} lineWidth={2}>
          {sessions?.data?.items.map((session) => (
            <Timeline.Item 
              key={session.id} 
              title={new Date(session.timestamp).toLocaleString()}
            >
              <Text size="sm" mt={4}>
                Type: {session.type} | Status: {session.status}
              </Text>
              <Button 
                variant="subtle" 
                size="xs" 
                mt="xs"
                onClick={() => setSelectedSession(session.id)}
              >
                View Logs
              </Button>
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <Modal 
        opened={!!selectedSession} 
        onClose={() => setSelectedSession(null)} 
        title="Session Logs"
        size="xl"
      >
        {isLoadingContent ? <Loader /> : (
          <ScrollArea h={500} offsetScrollbars>
            <Code block style={{ whiteSpace: 'pre-wrap' }}>
              {sessionContent?.data || 'No logs available'}
            </Code>
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  )
}

function getStatusColor(status: IssueStatus) {
  switch (status) {
    case IssueStatus.PLANNING: return 'blue'
    case IssueStatus.WAITING_PLAN_REVIEW: return 'yellow'
    case IssueStatus.IMPLEMENTING: return 'orange'
    case IssueStatus.WAITING_PR_REVIEW: return 'cyan'
    case IssueStatus.YOLO: return 'pink'
    default: return 'gray'
  }
}
