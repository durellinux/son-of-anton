# ADR 4: Test Framework Selection

## Status
Accepted

## Context
Currently, the `son-of-anton` project uses manual `assert` functions and `tsx` scripts to run tests. This approach is limited as it lacks features like:
- Built-in test runner with watch mode.
- Rich assertion library.
- Mocking and spying capabilities.
- Coverage reports.
- Snapshot testing.
- UI testing integration.

The project consists of a Node.js backend using Restate and a React frontend using Vite. Unifying the testing stack around a modern, fast, and ESM-compatible framework is essential for the project's long-term maintainability and reliability.

## Decision
We will adopt **Vitest** as the primary testing framework for both the backend and frontend.

## Alternatives Considered 

### Jest
Jest is the most popular testing framework in the JavaScript ecosystem. However:
- **Pros**: Mature, extensive documentation, widely known.
- **Cons**: Requires significant configuration for ESM and TypeScript in Node.js (often necessitating `ts-jest` or `babel`). It doesn't natively understand Vite's transformation pipeline, leading to potential discrepancies between development/build and test environments.

### Node.js native test runner
Node.js recently introduced a built-in test runner (`node:test`).
- **Pros**: Zero dependencies, extremely fast, built into the runtime.
- **Cons**: Lacks a rich ecosystem of matchers, mocking utilities (though improving), and UI testing integration (like Testing Library). It also lacks a robust watch mode compared to Vitest.

### Mocha/Chai
A classic combination for Node.js testing.
- **Pros**: Highly flexible and modular.
- **Cons**: Requires manual assembly of various packages (runner, assertion library, mocking library) and doesn't provide the "all-in-one" optimized experience that Vitest offers.

## Rationale
- **Vite Ecosystem Integration**: Since the UI already uses Vite, Vitest can share the same configuration, plugins, and transformation pipeline.
- **ESM Support**: Vitest has first-class, native support for ESM, aligning with the project's use of ESM (e.g., `eslint.config.mjs`).
- **TypeScript Support**: Works out-of-the-box via Vite's fast transformation, avoiding complex `ts-jest` setups.
- **Performance**: Extremely fast due to worker-based parallelization and Vite's on-demand transformation.
- **Jest Compatibility**: Offers a Jest-compatible API (`describe`, `it`, `expect`, `vi`), making it easy for developers familiar with Jest to transition.
- **Unified Tooling**: Provides a single, consistent testing experience across the entire monorepo (backend and frontend).
- **Modern Features**: Includes built-in support for coverage (via `v8` or `istanbul`), mocking, and advanced features like UI testing via `@testing-library/react`.

## Constraints and Risks

### Constraints
- **Restate Integration**: We must ensure Vitest's execution environment (which uses worker threads by default) is compatible with the Restate SDK. Some Restate features might require specific environment configurations (e.g., `threads: false` in Vitest if global state interference occurs).
- **CI/CD Update**: The GitHub Actions workflow (`ci.yml`) must be updated to use `yarn vitest run` instead of the manual test script.

### Risks
- **Migration Effort**: Current tests use a manual `assert` function. While the logic is simple, every test file needs to be updated to use Vitest's globals or imports.
- **Environment Discrepancies**: Vitest runs tests in `node` or `jsdom` environments. We need to ensure that backend tests correctly simulate the production Node.js environment, especially regarding filesystem and network operations.
- **Learning Curve**: While the API is Jest-like, developers need to familiarize themselves with Vitest-specific utilities (e.g., `vi` instead of `jest`).

## Consequences
- We will add `vitest` and `@vitest/coverage-v8` as dev dependencies to the root and `ui` packages.
- The root `package.json` test script will be changed to `vitest run`.
- Existing test files (e.g., `issueState.test.ts`) will be refactored to use Vitest matchers.
- A `vitest.config.ts` will be created at the root to configure the backend testing environment.
- We will be able to add comprehensive unit and integration tests for React components in the `ui/` directory.
