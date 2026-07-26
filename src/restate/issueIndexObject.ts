import * as restate from '@restatedev/restate-sdk';

function findStartIndex(sorted: number[], cursorNum: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sorted[mid] < cursorNum) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export const issueIndexObject = restate.object({
  name: 'IssueIndexObject',
  handlers: {
    addIssueNumber: async (ctx: restate.ObjectContext, number: number) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      if (!numbers.includes(number)) {
        numbers.push(number);
        ctx.set('issueNumbers', numbers);
      }
    },
    removeIssueNumber: async (ctx: restate.ObjectContext, number: number) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      const index = numbers.indexOf(number);
      if (index !== -1) {
        numbers.splice(index, 1);
        ctx.set('issueNumbers', numbers);
      }
    },
    listIssues: async (
      ctx: restate.ObjectSharedContext,
      req?: { cursor?: string; limit?: number },
    ) => {
      const numbers = (await ctx.get<number[]>('issueNumbers')) ?? [];
      const sorted = [...numbers].sort((a, b) => b - a);
      const cursor = req?.cursor;
      const limit = req?.limit ?? 100;
      if (!cursor) {
        return sorted.slice(0, limit);
      }
      const cursorNum = parseInt(cursor, 10);
      if (isNaN(cursorNum)) {
        return [];
      }
      const startIndex = findStartIndex(sorted, cursorNum);
      return sorted.slice(startIndex, startIndex + limit);
    },
  },
});
