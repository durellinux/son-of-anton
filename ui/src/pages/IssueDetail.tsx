import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Title, Text, Badge, Button, Group, Stack, 
  Card, Timeline, ScrollArea, Loader, Center, 
  Breadcrumbs, Anchor, Code, Modal, Textarea, Divider
} from '@mantine/core'
import ReactMarkdown from 'react-markdown'
import { 
  issuesGet, 
  issuesListSessions, 
  issuesGetSessionContent,
  issuesGetPlanningSession,
  issuesApprovePlan,
  issuesProvideFeedback
} from '../api/sdk.gen'
import { IssueStatus } from '../api/types.gen'

export function IssueDetail() {
  const { number } = useParams<{ number: string }>()
  const issueNumber = Number(number)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const queryClient = useQueryClient()

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

  const { data: planning, isLoading: isLoadingPlanning } = useQuery({
    queryKey: ['planning', issueNumber],
    queryFn: () => issuesGetPlanningSession({ path: { number: issueNumber } }),
  })

  const approveMutation = useMutation({
    mutationFn: () => issuesApprovePlan({ path: { number: issueNumber } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning', issueNumber] })
      queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] })
    }
  })

  const feedbackMutation = useMutation({
    mutationFn: (fb: string) => issuesProvideFeedback({ path: { number: issueNumber }, body: { feedback: fb } }),
    onSuccess: () => {
      setFeedback('')
      queryClient.invalidateQueries({ queryKey: ['planning', issueNumber] })
      queryClient.invalidateQueries({ queryKey: ['issue', issueNumber] })
    }
  })

  if (isLoadingIssue) return <Center h={400}><Loader /></Center>
  if (!issue?.data) return <Center h={400}><Title order={4}>Issue not found</Title></Center>

  const latestPlan = planning?.data?.history[planning.data.history.length - 1]

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
          {issue.data.url && (
            <Anchor href={issue.data.url} target="_blank">View on GitHub</Anchor>
          )}
        </Stack>
      </Card>

      {planning?.data && (
        <>
          <Title order={2}>Planning Session</Title>
          <Card withBorder padding="xl" radius="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Latest Proposal</Title>
                <Badge size="lg" color={getPlanningStatusColor(planning.data.status)}>
                  {planning.data.status.replace('_', ' ')}
                </Badge>
              </Group>
              
              <ScrollArea h={400} offsetScrollbars type="always" withBorder style={{ borderRadius: '4px', padding: '10px' }}>
                <div className="markdown-content">
                  <ReactMarkdown>{latestPlan?.plan || 'No plan proposed yet.'}</ReactMarkdown>
                </div>
              </ScrollArea>

              {planning.data.status === 'waiting_approval' && (
                <Stack mt="md">
                  <Textarea 
                    label="Feedback (required for rejection)"
                    placeholder="Provide feedback if you want changes..." 
                    value={feedback} 
                    onChange={(e) => setFeedback(e.currentTarget.value)}
                    minRows={3}
                  />
                  <Group>
                    <Button 
                      color="green" 
                      onClick={() => approveMutation.mutate()}
                      loading={approveMutation.isPending}
                    >
                      Approve Plan
                    </Button>
                    <Button 
                      color="red" 
                      variant="outline"
                      onClick={() => feedbackMutation.mutate(feedback)}
                      loading={feedbackMutation.isPending}
                      disabled={!feedback.trim()}
                    >
                      Request Changes
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Card>

          {planning.data.history.length > 1 && (
            <Stack gap="xs">
              <Title order={3}>Planning History</Title>
              <Timeline active={planning.data.history.length - 1} bulletSize={24} lineWidth={2}>
                {planning.data.history.map((step, index) => (
                  <Timeline.Item 
                    key={index} 
                    title={`Proposal ${index + 1} - ${new Date(step.timestamp).toLocaleString()}`}
                  >
                    <Text size="sm" mt={4}>
                      {step.feedback ? (
                        <>
                          <Text fw={700}>User Feedback:</Text>
                          <Text italic>{step.feedback}</Text>
                        </>
                      ) : (
                        index === planning.data.history.length - 1 ? 'Current plan' : 'Superseded'
                      )}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Stack>
          )}
          <Divider my="xl" />
        </>
      )}

      <Title order={2}>Daemon Sessions</Title>
      
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

function getPlanningStatusColor(status: string) {
  switch (status) {
    case 'waiting_approval': return 'yellow'
    case 'approved': return 'green'
    case 'needs_revision': return 'red'
    default: return 'gray'
  }
}
