# ADR 5: Metaworkflows (GenericWorkflow)

## Status

Approved

## Context

Currently, the workflows in Son of Anton (e.g., `epicSpecificationWorkflow`, `epicPlannerWorkflow`, `implementationAgentWorkflow`, and `prLifecycleWorkflow`) are hardcoded in TypeScript. This makes updating, adding, or modifying workflows complex, requiring code changes, rebuilding, and redeploying the entire daemon. 

To enable rapid iteration and easy extensibility, we need a mechanism to define workflows dynamically in a common configuration format (JSON or YAML) and execute them durably. These workflows must support input/output passing between blocks, easy addition of new actions, schema and dependency validation, and strict immutability/versioning to comply with Restate's execution model.

## Decision

We will implement a dynamic orchestration system called **Metaworkflows** using a single Restate workflow `GenericWorkflow`. This workflow will interpret and run workflow definitions defined in JSON or YAML conforming to a **Temporal DSL** specification. 

By adopting a Temporal-aligned DSL, we ensure support for advanced control flow constructs (such as loops, conditionals, and parallel execution) and make it easier to migrate to a standard Temporal deployment in the future.

### 1. Workflow Schema and Syntax

Workflows will be represented by a schema containing metadata, input/variable definitions, and a tree of execution blocks (activities and control flow constructs).

Example workflow definition in JSON format conforming to the Temporal-aligned DSL:
```json
{
  "id": "epic-specification",
  "name": "Epic Specification Workflow",
  "version": 1,
  "variables": {
    "number": "number",
    "title": "string",
    "url": "string",
    "repository": "string",
    "issueDetails": "object"
  },
  "root": {
    "sequence": [
      {
        "activity": "bootstrapLabels",
        "inputs": {
          "repository": "${variables.repository}"
        }
      },
      {
        "activity": "addLabel",
        "inputs": {
          "issueNumber": "${variables.number}",
          "repository": "${variables.repository}",
          "label": "status:specifying"
        }
      },
      {
        "activity": "fetchIssueDetails",
        "inputs": {
          "issueNumber": "${variables.number}",
          "repository": "${variables.repository}"
        },
        "result": "variables.issueDetails"
      },
      {
        "activity": "setupWorkspace",
        "inputs": {
          "issueNumber": "${variables.number}",
          "repository": "${variables.repository}",
          "branch": "${variables.issueDetails.branch}"
        }
      }
    ]
  }
}
```

### 2. Variables and Data Flow

The runtime will maintain a workflow state/variable context:
- `${variables.key}`: References workflow-level variables/inputs.
- Outputs of activities can be stored back into variables using the `"result"` field.
- Expressions inside input fields are dynamically interpolated prior to executing the activity.

### 3. Control Flow Constructs

Unlike simple sequential lists, the Temporal DSL supports nested control blocks:
- **`sequence`**: Runs a list of blocks sequentially.
- **`parallel`**: Runs a list of blocks concurrently.
- **`if`**: Conditional block with `condition`, `then`, and `else` branches.
- **`while` / `forEach`**: Loops to support repetitive operations natively.

### 4. Activity Registry

To make the system easily extensible, we will define a centralized `ActivityRegistry`. Each leaf activity in the workflow definition maps to a registered handler.

- New activities can be added by registering a TypeScript function conforming to a standard signature:
  ```typescript
  type ActivityContext = {
    restateContext: restate.WorkflowContext;
    // other shared services
  };

  type ActivityExecutor = (ctx: ActivityContext, inputs: Record<string, any>) => Promise<any>;
  ```
- The `GenericWorkflow` interpreter will walk the definition tree and run activities inside Restate durable steps:
  ```typescript
  const output = await ctx.run(activityId, () => activityExecutor(activityCtx, resolvedInputs));
  ```

### 5. API and Validation

We will expose Restate/Fastify endpoints for creating and updating workflow definitions. Upon creation or modification:
- **Schema Validation**: Verify the definition structure conforms to the Temporal DSL schema using `Zod`.
- **Control Flow Validation**: Ensure control constructs are valid (e.g., condition expressions are safe, loop limits are set to prevent infinite execution).
- **Variable Verification**: Ensure all interpolated variables refer to defined variables in the schema.
- **Activity Verification**: Check that all activities used in the workflow are registered in the `ActivityRegistry`.

### 6. Immutability & Versioning

Because Restate workflows must be deterministic and are registered statically:
- Workflow definitions stored in the repository/database are strictly **immutable**.
- Any update request creates a new version of the workflow (e.g., incrementing the `version` field).
- Existing running workflow instances will continue executing the version of the workflow definition they started with.

## Alternatives Considered

### Custom Interpretation Engine
Designing a bespoke JSON/YAML-based step format.
- **Pros**: Slightly simpler parsing logic initially.
- **Cons**: Difficult to scale when adding loops, conditionals, and error retry handlers. Migrating to standard workflow solutions in the future would require a complete rewrite of all workflow definitions.

### Code Generation
Instead of interpreting a JSON/YAML schema at runtime, we could generate TypeScript code and register it.
- **Pros**: Pure TypeScript compile-time type safety.
- **Cons**: High deployment complexity, requires recompiling and redeploying or dynamically loading JS bundles which introduces security risks and violates Restate's stable execution model.

## Rationale

- **Temporal DSL Alignment**: Future-proofs our workflow definitions by conforming to a standard design. Native support for complex structures like loops, parallel blocks, and conditionals.
- **Durable Restate Execution**: We get the benefits of Restate's high-performance durable execution while keeping the definitions configurable as data.
- **Zod + DAG Analyzer**: Provides bulletproof validation at the API boundary, rejecting invalid workflows before they are run.
- **Versioned Instances**: Satisfies Restate's requirement that workflows are unmodifiable/deterministic, avoiding runtime replay errors.

## Constraints and Risks

- **Determinism**: The interpreter must resolve expressions and execute steps deterministically. Expression parsing must be pure and free of side effects.
- **Debugging and Observability**: Dynamic workflows can be harder to debug. We will need to report execution state and map step IDs to Restate console logs.
- **Type Safety**: Since inputs and outputs are resolved dynamically at runtime, compile-time type checking between step boundaries is lost. Comprehensive schema validation and dry-run execution testing will be necessary.
