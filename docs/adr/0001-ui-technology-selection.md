# ADR 1: UI Technology Selection

## Status

Accepted

## Context

Son of Anton needs a UI to allow users to visualize the status of issues being addressed, connected sessions, and to perform actions such as cleaning local state or resetting an issue implementation.

## Decision

We will use the following technologies for the Son of Anton UI:

- **Frontend Framework**: React with Vite (TypeScript).
- **Styling**: Vanilla CSS / CSS Modules with Sass/SCSS support.
- **Component Library**: Mantine UI.
- **Integration**: Serve the UI via the existing Fastify daemon using `@fastify/static`.
- **Data Fetching**: Use TanStack Query (React Query) for efficient server state management.

All UI components and layouts must prioritize:

- **Accessibility**: Full compliance with WCAG 2.1 AA standards.
- **Mobile-First Design**: Responsive interfaces that work seamlessly across mobile, tablet, and desktop devices.

## Alternatives Considered

### Frontend Frameworks

- **Vue.js / Svelte**: Modern and efficient alternatives to React. However, React (TypeScript) is the preferred stack for this project, offering a mature ecosystem and consistent patterns with other Gemini-driven projects.
- **Next.js / Remix**: Full-stack frameworks that provide excellent performance. These were considered overkill since the UI will be a simple dashboard served by the existing Fastify daemon.

### Styling

- **Vanilla CSS / CSS Modules**: The baseline for styling. Sass/SCSS is added to provide better organization, variables, and nesting while maintaining the flexibility of native CSS.
- **Tailwind CSS**: A utility-first CSS framework. While fast for development, it was not chosen to align with the project's styling mandate to avoid heavy utility-first frameworks unless explicitly requested, and to favor the requested Sass/SCSS workflow.
- **Styled Components**: CSS-in-JS provides good developer experience but adds runtime overhead and complexity.

### Component Libraries

- **Mantine**: Selected for its comprehensive suite of components, excellent hooks, and ease of use with modern React. It allows for fast-tracking UI development without sacrificing flexibility. It also provides a strong foundation for accessibility and responsive design.
- **MUI (Material UI)**: A very mature and industry-standard library. However, it can be quite opinionated and heavy if the full Material Design aesthetic is not desired.
- **Radix UI**: A great choice for headless components with high accessibility, but requires significant effort to style compared to "out of the shelf" solutions like Mantine.

## Rationale

- **React with Vite**: Provides a modern, fast, and type-safe development experience. Vite is the current industry standard for fast development cycles.
- **Sass/SCSS**: Provides advanced styling capabilities like nesting and variables, which improves CSS maintainability and organization.
- **Mantine UI**: Enables rapid development of the UI by providing high-quality, pre-built components and patterns. Mantine components are built with accessibility in mind (ARIA attributes, keyboard navigation) and include responsive system props and hooks (like `use-media-query`) to support mobile-first development.
- **@fastify/static**: Since we already have a Fastify daemon, serving the UI from the same process simplifies deployment and avoids CORS issues during development.
- **TanStack Query**: Handles caching, synchronization, and updating server state. Choosing it also provides a valuable learning opportunity for developers transitioning from other frameworks like Vue.

## Consequences

- Developers will need to be familiar with React and TypeScript.
- The daemon will need to be updated to serve static files from a specific directory (e.g., `dist/ui`).
- UI development must include explicit steps for accessibility testing (e.g., using axe-core) and responsive design validation across multiple viewport sizes.
