# ADR 1: UI Technology Selection

## Status
Accepted

## Context
Son of Anton needs a UI to allow users to visualize the status of issues being addressed, connected sessions, and to perform actions such as cleaning local state or resetting an issue implementation.

## Decision
We will use the following technologies for the Son of Anton UI:

- **Frontend Framework**: React with Vite (TypeScript).
- **Styling**: Vanilla CSS / CSS Modules.
- **Integration**: Serve the UI via the existing Fastify daemon using `@fastify/static`.
- **Data Fetching**: Use TanStack Query (React Query) for efficient server state management.

## Alternatives Considered 

### Frontend Frameworks 
- **Vue.js / Svelte**: Modern and efficient alternatives to React. However, React (TypeScript) is the preferred stack for this project, offering a mature ecosystem and consistent patterns with other Gemini-driven projects. 
- **Next.js / Remix**: Full-stack frameworks that provide excellent performance. These were considered overkill since the UI will be a simple dashboard served by the existing Fastify daemon. 

### Styling 
- **Tailwind CSS**: A utility-first CSS framework. While fast for development, Vanilla CSS / CSS Modules are preferred here to maintain maximum flexibility and align with the project's styling mandate to avoid heavy CSS frameworks unless explicitly requested. 
- **Styled Components**: CSS-in-JS provides good developer experience but adds runtime overhead and complexity that Vanilla CSS avoids. 


## Rationale
- **React with Vite**: Provides a modern, fast, and type-safe development experience. Vite is the current industry standard for fast development cycles.
- **Vanilla CSS / CSS Modules**: Aligns with Gemini's styling preferences and ensures maximum flexibility without the overhead of heavy CSS frameworks.
- **@fastify/static**: Since we already have a Fastify daemon, serving the UI from the same process simplifies deployment and avoids CORS issues during development.
- **TanStack Query**: Handles caching, synchronization, and updating server state in React applications, making the UI more reliable and easier to develop.

## Consequences
- Developers will need to be familiar with React and TypeScript.
- The daemon will need to be updated to serve static files from a specific directory (e.g., `dist/ui`).
