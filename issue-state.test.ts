import { determineIssueState, determinePRState, IssueState, Issue, PullRequest, getUnaddressedPRComments, PRComment, PlanningSessionStatus } from './issue-state';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const issueTests = [
  {
    name: 'YOLO mode',
    issue: {
      body: 'Fix this bug #yolo',
      comments: []
    },
    expected: IssueState.YOLO
  },
  {
    name: 'Needs planning (no plan)',
    issue: {
      body: 'Fix this bug',
      comments: []
    },
    expected: IssueState.NEEDS_PLANNING
  },
  {
    name: 'Needs planning (plan rejected)',
    issue: {
      body: 'Fix this bug',
      comments: [
        {
          body: 'My plan #son-of-anton-plan',
          reactionGroups: [{ content: 'THUMBS_DOWN', users: { totalCount: 1 } }]
        }
      ]
    },
    expected: IssueState.NEEDS_PLANNING
  },
  {
    name: 'Needs implementation (plan approved)',
    issue: {
      body: 'Fix this bug',
      comments: [
        {
          body: 'My plan #son-of-anton-plan',
          reactionGroups: [{ content: 'THUMBS_UP', users: { totalCount: 1 } }]
        }
      ]
    },
    expected: IssueState.NEEDS_IMPLEMENTATION
  },
    {
        name: 'Needs planning (plan rejected with comments)',
        issue: {
            body: 'Fix this bug',
            comments: [
                {
                    body: 'My plan #son-of-anton-plan',
                    reactionGroups: [{ content: 'THUMBS_DOWN', users: { totalCount: 1 } }]
                },
                {
                    body: '> My plan #son-of-anton-plan\nThis is not good!',
                    reactionGroups: []
                }
            ]
        },
        expected: IssueState.NEEDS_PLANNING
    },
  {
    name: 'Waiting (plan posted, no reaction)',
    issue: {
      body: 'Fix this bug',
      comments: [
        {
          body: 'My plan #son-of-anton-plan',
          reactionGroups: []
        }
      ]
    },
    expected: IssueState.WAITING
  },
  {
    name: 'Correctly identifies last plan',
    issue: {
      body: 'Fix this bug',
      comments: [
        {
          body: 'Old plan #son-of-anton-plan',
          reactionGroups: [{ content: 'THUMBS_UP', users: { totalCount: 1 } }]
        },
        {
          body: 'New plan #son-of-anton-plan',
          reactionGroups: []
        }
      ]
    },
    expected: IssueState.WAITING
  },
  {
    name: 'Closed issue',
    issue: {
      body: 'Fix this bug',
      comments: [],
      state: 'CLOSED'
    },
    expected: IssueState.CLOSED
  },
  {
    name: 'Waiting for PR review',
    issue: {
      body: 'Fix this bug',
      comments: [],
      pullRequests: [{ state: 'OPEN' }]
    },
    expected: IssueState.WAITING_PR_REVIEW
  }
];

const localPlanningTests = [
  {
    name: 'Local planning: Waiting approval',
    issue: { body: 'Fix bug', comments: [] },
    localPlanning: { status: PlanningSessionStatus.WAITING_APPROVAL },
    expected: IssueState.WAITING
  },
  {
    name: 'Local planning: Approved',
    issue: { body: 'Fix bug', comments: [] },
    localPlanning: { status: PlanningSessionStatus.APPROVED },
    expected: IssueState.NEEDS_IMPLEMENTATION
  },
  {
    name: 'Local planning: Needs revision',
    issue: { body: 'Fix bug', comments: [] },
    localPlanning: { status: PlanningSessionStatus.NEEDS_REVISION },
    expected: IssueState.NEEDS_PLANNING
  },
  {
    name: 'Local planning takes precedence over GitHub',
    issue: {
      body: 'Fix bug',
      comments: [
        {
          body: 'Plan #son-of-anton-plan',
          reactionGroups: [{ content: 'THUMBS_DOWN', users: { totalCount: 1 } }]
        }
      ]
    },
    localPlanning: { status: PlanningSessionStatus.APPROVED },
    expected: IssueState.NEEDS_IMPLEMENTATION
  }
];

const prTests = [
  {
    name: 'PR Needs implementation (changes requested)',
    pr: {
      number: 1,
      reviewDecision: 'CHANGES_REQUESTED',
      headRefName: 'feature'
    },
    expected: IssueState.NEEDS_IMPLEMENTATION
  },
  {
    name: 'PR Waiting (approved)',
    pr: {
      number: 2,
      reviewDecision: 'APPROVED',
      headRefName: 'feature'
    },
    expected: IssueState.WAITING
  },
  {
    name: 'PR Needs implementation (review required)',
    pr: {
      number: 3,
      reviewDecision: 'REVIEW_REQUIRED',
      headRefName: 'feature'
    },
    expected: IssueState.NEEDS_IMPLEMENTATION
  },
  {
    name: 'PR Needs implementation (no review decision)',
    pr: {
      number: 4,
      reviewDecision: null as any,
      headRefName: 'feature'
    },
    expected: IssueState.NEEDS_IMPLEMENTATION
  },
  {
    name: 'PR Merged',
    pr: {
      number: 5,
      reviewDecision: 'APPROVED',
      headRefName: 'feature',
      state: 'MERGED'
    },
    expected: IssueState.MERGED
  },
  {
    name: 'PR Closed',
    pr: {
      number: 6,
      reviewDecision: 'CHANGES_REQUESTED',
      headRefName: 'feature',
      state: 'CLOSED'
    },
    expected: IssueState.CLOSED
  }
];

const commentTests = [
    {
        name: 'No comments',
        comments: [] as PRComment[],
        expected: [] as number[]
    },
    {
        name: 'All unaddressed',
        comments: [
            { id: 1, body: 'test1', reactions: { '+1': 0 } },
            { id: 2, body: 'test2', reactions: { '+1': 0 } }
        ] as PRComment[],
        expected: [1, 2]
    },
    {
        name: 'Some addressed',
        comments: [
            { id: 1, body: 'test1', reactions: { '+1': 1 } },
            { id: 2, body: 'test2', reactions: { '+1': 0 } }
        ] as PRComment[],
        expected: [2]
    },
    {
        name: 'All addressed',
        comments: [
            { id: 1, body: 'test1', reactions: { '+1': 1 } },
            { id: 2, body: 'test2', reactions: { '+1': 2 } }
        ] as PRComment[],
        expected: []
    }
];

for (const test of issueTests) {
  console.log(`Running issue test: ${test.name}`);
  const actual = determineIssueState(test.issue as Issue);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

for (const test of localPlanningTests) {
  console.log(`Running local planning test: ${test.name}`);
  const actual = determineIssueState(test.issue as Issue, test.localPlanning as any);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

for (const test of prTests) {
  console.log(`Running PR test: ${test.name}`);
  const actual = determinePRState(test.pr as PullRequest);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

for (const test of commentTests) {
    console.log(`Running comment test: ${test.name}`);
    const actual = getUnaddressedPRComments(test.comments);
    assert(JSON.stringify(actual) === JSON.stringify(test.expected), `Expected ${JSON.stringify(test.expected)}, but got ${JSON.stringify(actual)}`);
}

console.log('All tests passed!');
