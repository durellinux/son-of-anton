# ADR 2: Durable Execution Framework Selection

## Status

Proposed

## Context

Son of Anton daemon currently uses a manual polling loop (`anton-daemon.ts`) and filesystem-based state management (`FileSystemIssueRepository.ts`). This approach has several limitations regarding resilience, complexity, and observability.

## Decision

We will use Restate as the durable execution framework for Son of Anton.

## Alternatives Considered

- **Temporal**: Industry standard but too heavyweight (requires multi-service cluster and external DB).
- **DBOS**: Library-based but requires Postgres.
- **Effect**: Great for concurrency but lacks built-in durability across restarts.

## Rationale

Restate aligns perfectly with our NFRs: minimal overhead, simple TS SDK, easy local deployment (single binary/container), and low resource consumption.

## High-level Flow with Restate

1. **Trigger**: Workflows are initiated by a cron service or GitHub webhooks.
2. **Durable Steps**: Each task (fetching issue, calling Gemini, posting comments) is wrapped in a Restate durable step (`ctx.run`).
3. **Suspension**: Workflows can wait for external events (like human approval) using `ctx.promise`, without consuming resources while idle.
4. **Resilience**: If the daemon crashes, Restate ensures the workflow resumes from the last successful step.
