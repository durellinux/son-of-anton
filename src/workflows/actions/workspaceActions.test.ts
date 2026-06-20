import { describe, it, expect } from 'vitest';
import { RebaseConflictError } from './workspaceActions';

describe('RebaseConflictError', () => {
  it('instantiates correctly with details', () => {
    const conflictDetails = 'CONFLICT (content): Merge conflict in file.txt';
    const error = new RebaseConflictError(conflictDetails);

    expect(error.name).toBe('RebaseConflictError');
    expect(error.conflictDetails).toBe(conflictDetails);
    expect(error.message).toContain(conflictDetails);
    expect(error).toBeInstanceOf(Error);
  });
});
