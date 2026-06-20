import { describe, it, expect } from 'vitest';
import {
  determineIssueState,
  determinePRState,
  IssueState,
  Issue,
  getUnaddressedPRComments,
  PRComment,
  PlanningSessionStatus,
} from './issueState';

describe('determineIssueState', () => {
  it('identifies YOLO mode', () => {
    const issue = {
      body: 'Fix this bug #yolo',
      state: 'OPEN',
    };
    expect(determineIssueState(issue as Issue)).toBe(IssueState.YOLO);
  });

  it('identifies needs planning (no session)', () => {
    const issue = {
      body: 'Fix this bug',
      state: 'OPEN',
    };
    expect(determineIssueState(issue as Issue)).toBe(IssueState.NEEDS_PLANNING);
  });

  it('identifies closed issue', () => {
    const issue = {
      body: 'Fix this bug',
      state: 'CLOSED',
    };
    expect(determineIssueState(issue as Issue)).toBe(IssueState.CLOSED);
  });

  it('identifies waiting for PR review (branch exists)', () => {
    const issue = {
      body: 'Fix this bug',
      state: 'OPEN',
      branch: 'anton/60',
    };
    expect(determineIssueState(issue as Issue)).toBe(IssueState.WAITING_PR_REVIEW);
  });

  it('identifies specifying state check', () => {
    const issue = {
      body: 'Epic issue',
      state: 'OPEN',
      labels: ['status:specifying'],
    };
    expect(determineIssueState(issue as Issue)).toBe(IssueState.SPECIFYING);
  });

  it('identifies local planning: Waiting approval', () => {
    const issue = { body: 'Fix bug', state: 'OPEN' };
    const localPlanning = { status: PlanningSessionStatus.WAITING_APPROVAL };
    expect(determineIssueState(issue as unknown as Issue, localPlanning as any)).toBe(
      IssueState.WAITING,
    );
  });

  it('identifies local planning: Approved', () => {
    const issue = { body: 'Fix bug', state: 'OPEN' };
    const localPlanning = { status: PlanningSessionStatus.APPROVED };
    expect(determineIssueState(issue as unknown as Issue, localPlanning as any)).toBe(
      IssueState.NEEDS_IMPLEMENTATION,
    );
  });

  it('identifies local planning: Needs revision', () => {
    const issue = { body: 'Fix bug', state: 'OPEN' };
    const localPlanning = { status: PlanningSessionStatus.NEEDS_REVISION };
    expect(determineIssueState(issue as unknown as Issue, localPlanning as any)).toBe(
      IssueState.NEEDS_PLANNING,
    );
  });
});

describe('determinePRState', () => {
  it('identifies PR Needs implementation (changes requested)', () => {
    const pr = {
      number: 1,
      reviewDecision: 'CHANGES_REQUESTED',
      headRefName: 'feature',
      state: 'OPEN',
    };
    expect(determinePRState(pr as any)).toBe(IssueState.NEEDS_IMPLEMENTATION);
  });

  it('identifies PR Waiting (approved)', () => {
    const pr = {
      number: 2,
      reviewDecision: 'APPROVED',
      headRefName: 'feature',
      state: 'OPEN',
    };
    expect(determinePRState(pr as any)).toBe(IssueState.WAITING);
  });

  it('identifies PR Needs implementation (review required)', () => {
    const pr = {
      number: 3,
      reviewDecision: 'REVIEW_REQUIRED',
      headRefName: 'feature',
      state: 'OPEN',
    };
    expect(determinePRState(pr as any)).toBe(IssueState.NEEDS_IMPLEMENTATION);
  });

  it('identifies PR Merged', () => {
    const pr = {
      number: 5,
      reviewDecision: 'APPROVED',
      headRefName: 'feature',
      state: 'MERGED',
    };
    expect(determinePRState(pr as any)).toBe(IssueState.MERGED);
  });

  it('identifies PR Closed', () => {
    const pr = {
      number: 6,
      reviewDecision: 'CHANGES_REQUESTED',
      headRefName: 'feature',
      state: 'CLOSED',
    };
    expect(determinePRState(pr as any)).toBe(IssueState.CLOSED);
  });
});

describe('getUnaddressedPRComments', () => {
  it('returns empty array when no comments', () => {
    expect(getUnaddressedPRComments([])).toEqual([]);
  });

  it('returns all comments when all are unaddressed', () => {
    const comments = [
      { id: 1, body: 'test1', reactions: { '+1': 0 } },
      { id: 2, body: 'test2', reactions: { '+1': 0 } },
    ] as PRComment[];
    expect(getUnaddressedPRComments(comments)).toEqual([1, 2]);
  });

  it('returns only unaddressed comments when some are addressed', () => {
    const comments = [
      { id: 1, body: 'test1', reactions: { '+1': 1 } },
      { id: 2, body: 'test2', reactions: { '+1': 0 } },
    ] as PRComment[];
    expect(getUnaddressedPRComments(comments)).toEqual([2]);
  });

  it('returns empty array when all comments are addressed', () => {
    const comments = [
      { id: 1, body: 'test1', reactions: { '+1': 1 } },
      { id: 2, body: 'test2', reactions: { '+1': 2 } },
    ] as PRComment[];
    expect(getUnaddressedPRComments(comments)).toEqual([]);
  });
});
