import { determineIssueState, IssueState, Issue } from './issue-state';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const tests = [
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

for (const test of tests) {
  console.log(`Running test: ${test.name}`);
  const actual = determineIssueState(test.issue as Issue);
  assert(actual === test.expected, `Expected ${test.expected}, but got ${actual}`);
}

console.log('All tests passed!');
