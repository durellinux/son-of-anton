import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildPlanningPrompt, savePlanningSession, deletePlanningSession } from './planActions';
import { IssueState } from '../../../issueState';
import { FileSystemIssueRepository } from '../../repositories/fileSystemIssueRepository';

const repository = new FileSystemIssueRepository();
const testIssueNumber = 99999;

describe('buildPlanningPrompt', () => {
  beforeEach(async () => {
    await deletePlanningSession(testIssueNumber);
  });

  afterEach(async () => {
    await deletePlanningSession(testIssueNumber);
  });

  it('should build initial planning prompt when no session exists', async () => {
    const prompt = await buildPlanningPrompt(testIssueNumber, 'durellinux/son-of-anton', IssueState.NEEDS_PLANNING);
    expect(prompt).toBe('follow the anton-plan skill flow for issue 99999 on the repo durellinux/son-of-anton');
  });

  it('should include user feedback in prompt when planning session has feedback', async () => {
    await savePlanningSession(testIssueNumber, 'Initial Plan Content');
    
    // Simulate user feedback on the initial plan
    const session = await repository.getPlanningSession(testIssueNumber);
    if (session && session.history.length > 0) {
      session.history[0].feedback = 'Please add more details about performance optimizations.';
      await repository.savePlanningSession(session);
    }

    const prompt = await buildPlanningPrompt(testIssueNumber, 'durellinux/son-of-anton', IssueState.NEEDS_PLANNING);
    expect(prompt).toContain('follow the anton-plan skill flow for issue 99999 on the repo durellinux/son-of-anton');
    expect(prompt).toContain('User feedback from previous iteration:');
    expect(prompt).toContain('Please add more details about performance optimizations.');
    expect(prompt).toContain('Please update the plan to incorporate this feedback.');
  });
});
