import { determineIssueState, determinePRState, IssueState, Issue, PullRequest } from './issue-state';

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
  }
];

for (const test of issueTests) {
  console.log(`Running issue test: ${test.name}`);
  const actual = determineIssueState(test.issue as Issue);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

for (const test of prTests) {
  console.log(`Running PR test: ${test.name}`);
  const actual = determinePRState(test.pr as PullRequest);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

console.log('All tests passed!');
