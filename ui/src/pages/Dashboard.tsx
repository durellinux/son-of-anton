import { useQuery } from '@tanstack/react-query';
import { Table, Badge, Title, Anchor, Loader, Center, Group } from '@mantine/core';
import { Link } from 'react-router-dom';
import { issuesList } from '../api/sdk.gen';
import { IssueStatus } from '../api/types.gen';

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['issues'],
    queryFn: () => issuesList(),
  });

  if (isLoading)
    return (
      <Center h={400}>
        <Loader />
      </Center>
    );
  if (error)
    return (
      <Center h={400}>
        <Title order={4} c="red">
          Error loading issues
        </Title>
      </Center>
    );

  return (
    <div>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Tracked Issues</Title>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data?.data?.items.map((issue) => (
            <Table.Tr key={issue.number}>
              <Table.Td>{issue.number}</Table.Td>
              <Table.Td>{issue.title}</Table.Td>
              <Table.Td>
                <Badge color={getStatusColor(issue.status)}>{issue.status}</Badge>
              </Table.Td>
              <Table.Td>
                <Anchor component={Link} to={`/issues/${issue.number}`}>
                  View Details
                </Anchor>
                {issue.workflowUrl && (
                  <Anchor href={issue.workflowUrl} target="_blank" ml="md">
                    Workflow
                  </Anchor>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

function getStatusColor(status: IssueStatus) {
  switch (status) {
    case IssueStatus.PLANNING:
      return 'blue';
    case IssueStatus.SPECIFYING:
      return 'violet';
    case IssueStatus.WAITING_PLAN_REVIEW:
      return 'yellow';
    case IssueStatus.IMPLEMENTING:
      return 'orange';
    case IssueStatus.WAITING_PR_REVIEW:
      return 'cyan';
    case IssueStatus.YOLO:
      return 'pink';
    case IssueStatus.CONFLICT_DETECTED:
      return 'red';
    case IssueStatus.DONE:
      return 'green';
    case IssueStatus.CLOSED:
      return 'gray';
    default:
      return 'gray';
  }
}
