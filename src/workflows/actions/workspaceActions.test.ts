import { RebaseConflictError } from './workspaceActions';

async function test() {
  console.log('Testing RebaseConflictError...');
  const conflictDetails = 'CONFLICT (content): Merge conflict in file.txt';
  const error = new RebaseConflictError(conflictDetails);

  if (error.name !== 'RebaseConflictError') {
    throw new Error('Error name should be RebaseConflictError');
  }

  if (error.conflictDetails !== conflictDetails) {
    throw new Error('Error should contain conflict details');
  }

  if (!error.message.includes(conflictDetails)) {
    throw new Error('Error message should include conflict details');
  }

  if (!(error instanceof Error)) {
    throw new Error('RebaseConflictError should be an instance of Error');
  }

  console.log('RebaseConflictError tests passed!');
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
