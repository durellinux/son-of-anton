# ADR 5: Metaworkflows (GenericWorkflow)

## Status

Proposed

## Context

Currently, the workflows in Son of Anton (e.g., `epicSpecificationWorkflow`, `epicPlannerWorkflow`, `implementationAgentWorkflow`, and `prLifecycleWorkflow`) are hardcoded in TypeScript. This makes updating, adding, or modifying workflows complex, requiring code changes, rebuilding, and redeploying the entire daemon. 

To enable rapid iteration and easy extensibility, we need a mechanism to define workflows dynamically in a common configuration format (JSON or YAML) and execute them durably. These workflows must support input/output passing between blocks, easy addition of new actions, schema and dependency validation, and strict immutability/versioning to comply with Restate's execution model.

## Decision

We will implement a dynamic orchestration system called **Metaworkflows** using a single Restate workflow `GenericWorkflow`. This workflow will interpret and run workflow definitions defined in JSON or YAML.

### 1. Workflow Schema and Syntax

Workflows will be represented by a minimal schema containing metadata, trigger rules, inputs, and a list of steps.

Example workflow definition in JSON format:
```json
{
  "id": "epic-specification",
  "name": "Epic Specification Workflow",
  "version": 1,
  "inputs": {
    "number": "number",
    "title": "string",
    "url": "string",
    "repository": "string"
  },
  "steps": [
    {
      "id": "bootstrap-labels",
      "action": "bootstrapLabels",
      "inputs": {
        "repository": "${workflow.input.repository}"
      }
    },
    {
      "id": "transition-labels",
      "action": "addLabel",
      "inputs": {
        "issueNumber": "${workflow.input.number}",
        "repository": "${workflow.input.repository}",
        "label": "status:specifying"
      }
    },
    {
      "id": "fetch-github-details",
      "action": "fetchIssueDetails",
      "inputs": {
        "issueNumber": "${workflow.input.number}",
        "repository": "${workflow.input.repository}"
      }
    },
    {
      "id": "setup-workspace",
      "action": "setupWorkspace",
      "inputs": {
        "issueNumber": "${workflow.input.number}",
        "repository": "${workflow.input.repository}",
        "branch": "${steps.fetch-github-details.output.branch}"
      }
    }
  ]
}
```

### 2. Variables and Data Flow

To allow passing inputs and outputs across blocks, we will support expression interpolation. The runtime will resolve variables using a context object:
- `${workflow.input.key}`: References workflow-level inputs.
- `${steps.stepId.output.key}`: References the output of a previously executed step. If the output is a primitive, `${steps.stepId.output}` can be used.

### 3. Action Registry

To make the system easily extensible, we will define a centralized `ActionRegistry`. Each step in the workflow maps to an action in the registry. 

- New actions can be added by registering a TypeScript function conforming to a standard signature:
  ```typescript
  type ActionContext = {
    restateContext: restate.WorkflowContext;
    // other shared services
  };

  type ActionExecutor = (ctx: ActionContext, inputs: Record<string, any>) => Promise<any>;
  ```
- The `GenericWorkflow` loop will execute each step by looking up the action executor in the registry, resolving its inputs, and running it inside a Restate durable step:
  ```typescript
  const output = await ctx.run(step.id, () => actionExecutor(actionCtx, resolvedInputs));
  ```

### 4. API and Validation

We will expose Restate/Fastify endpoints for creating and updating workflow definitions. Upon creation or modification:
- **Schema Validation**: Verify the definition structure using a validation library like `Zod`.
- **DAG / Dependency Validation**: Verify that the step graph is a directed acyclic graph (no cycles).
- **Variable Verification**: Ensure all interpolated variables (`${steps.stepId.output.key}`) refer to steps that are guaranteed to execute before the current step and exist in the schema.
- **Action Verification**: Check that all actions used in steps are registered in the `ActionRegistry`.

### 5. Immutability & Versioning

Because Restate workflows must be deterministic and are registered statically:
- Workflow definitions stored in the repository/database are strictly **immutable**.
- Any update request creates a new version of the workflow (e.g., incrementing the `version` field).
- Existing running workflow instances will continue executing the version of the workflow definition they started with.

## Alternatives Considered

### Code Generation
Instead of interpreting a JSON/YAML schema at runtime, we could generate TypeScript code and register it.
- **Pros**: Pure TypeScript compile-time type safety.
- **Cons**: High deployment complexity, requires recompiling and redeploying or dynamically loading JS bundles which introduces security risks and violates Restate's stable execution model.

### Temporal DSL / State Chart XML (SCXML)
Using an existing standard format like SCXML or Temporal's DSL patterns.
- **Pros**: Reuses existing specifications.
- **Cons**: Extremely verbose and complex to write manually, violating our goal of having a syntax that is "as minimal as possible to be able to quickly iterate."

## Rationale

- **JSON/YAML Interpretation**: Highly flexible and allows defining workflows purely as data, which can be stored in git or a database.
- **Dynamic Context Interpolation**: Allows steps to be chained together sequentially or as a DAG without writing any TypeScript orchestrations.
- **Zod + DAG Analyzer**: Provides bulletproof validation at the API boundary, rejecting invalid workflows before they are run.
- **Versioned Instances**: Satisfies Restate's requirement that workflows are unmodifiable/deterministic, avoiding runtime replay errors.

## Constraints and Risks

- **Determinism**: The interpreter must resolve expressions and execute steps deterministically. Expression parsing must be pure and free of side effects.
- **Debugging and Observability**: Dynamic workflows can be harder to debug. We will need to report execution state and map step IDs to Restate console logs.
- **Type Safety**: Since inputs and outputs are resolved dynamically at runtime, compile-time type checking between step boundaries is lost. Comprehensive schema validation and dry-run execution testing will be necessary.
