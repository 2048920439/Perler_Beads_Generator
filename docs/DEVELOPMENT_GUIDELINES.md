# React and TypeScript Development Guidelines

These guidelines apply to changes in `src/app/` and `src/`. They complement the
repository-specific requirements in [`../AGENTS.md`](../AGENTS.md). If a general
recommendation conflicts with an explicit project requirement, follow the
project requirement.

## Modular Design and Responsibilities

- Design abstractions around a coherent, independently understandable
  capability, not around one feature's convenience. A component, function,
  Hook, utility, or module should have a useful contract that remains
  meaningful outside the workflow that first needed it.
- Separate general building blocks from business composition. An abstraction
  should express its own responsibility, while feature-specific behavior is
  supplied and coordinated at the feature layer. Do not make a foundational
  abstraction depend on the business workflow that uses it.
- Keep business rules in the feature or domain layer that owns them. General
  UI building blocks should not import or encode product-specific state,
  labels, persistence, or operations. Feature-specific components are valid
  when they coordinate a real feature; name and place them as feature
  composition rather than presenting them as general-purpose primitives.
- Apply the same separation to non-UI abstractions: a general function should
  express a coherent operation through explicit inputs and outputs; a Hook
  should expose a cohesive stateful capability; a utility or module should
  not hide an entire feature workflow behind a generic name.
- Prefer composition and explicit contracts so general building blocks can
  support different callers without learning their business rules. Specialize
  an abstraction only when the specialization belongs to its own stable
  responsibility.
- A reusable abstraction is not a goal by itself. Do not build a generic
  framework for speculative callers, or extract a wrapper that only renames
  one call. First ensure the abstraction has a clear independent concept,
  stable responsibility, and simpler use than duplicating the operation.
- Organize code around cohesive product features and domain responsibilities.
  Keep a feature's UI, feature-specific types, and interaction logic near one
  another when that makes ownership easier to understand. Promote code to a
  shared module only when it is genuinely used across features.
- Give each module a clear reason to change. Keep UI composition, interaction
  coordination, domain transformations, browser/platform integration, and
  static data distinct when their responsibilities or change patterns differ.
- Prefer clear dependency direction: UI may call domain and platform adapters;
  domain logic should not import React components or depend on browser UI.
  Shared low-level modules should not import feature modules. Avoid circular
  dependencies and broad "utils" modules with unrelated responsibilities.
- Keep modules cohesive and APIs narrow. Export only what other modules need;
  keep implementation details private. Avoid both monolithic files and
  excessive fragmentation into one-line wrappers or pass-through modules.
- Choose module and component boundaries based on responsibility, independent
  behavior, state ownership, reuse, and expected change. Do not split solely
  to meet a line-count target, and do not keep unrelated responsibilities
  together merely to avoid adding files.
- Keep names and file placement predictable and consistent with the
  established project structure. Do not introduce a new architecture or
  directory taxonomy as part of a small feature change without a clear need.

## Component Responsibilities and Composition

- Build components around meaningful UI regions or independently understandable
  interactions. A component should have a clear purpose, a manageable set of
  responsibilities, and an interface that explains how it is used.
- Keep general-purpose primitives independent of feature workflows. Compose
  them with feature-owned data and behavior in feature components rather than
  adding business-specific props, branching, or side effects to the primitive.
- Separate page/workspace orchestration from substantial feature panels,
  dialogs, tool groups, and repeated UI regions when doing so clarifies
  ownership or makes each region easier to understand and change.
- Keep a component's render path declarative. Move complex calculations to
  named domain functions and external-system synchronization to focused Effects
  or custom Hooks; do not move a monolithic component wholesale into a giant
  custom Hook.
- Keep local presentation and transient interaction state near the component
  that owns that interaction. Lift state only as far as needed to coordinate
  multiple regions or preserve application-level behavior.
- Prefer composition and explicit data flow over components that reach into
  unrelated feature state or implicitly control distant UI.
- Avoid needless indirection: a component is not automatically useful just
  because a JSX fragment has a name. Extract when the boundary improves
  comprehension, ownership, independent behavior, or reuse.

## Component APIs and State Ownership

- Give each component a clear, explicit interface that exposes only the
  information and capabilities needed for its responsibility. Do not expose
  unrelated application state or internal implementation details.
- Represent interactions through a contract that communicates intent and
  exchanged information without exposing another component's internal
  state-management mechanism.
- Use controlled values when a parent must coordinate or persist them. Keep
  purely local view state inside the owning component. Document or encode
  controlled/uncontrolled behavior clearly when a component supports both.
- Group props into a smaller object only when the values form a cohesive,
  stable concept. Do not optimize for prop count at the expense of a clear API.
- Keep state in one authoritative owner. Avoid mirrored state across parent
  and child; communicate changes through callbacks and derive display values
  from the authoritative state.
- Keep related state together when it is always updated together, and avoid
  redundant, contradictory, or deeply nested state that makes updates fragile.
- Use refs for mutable interaction details that do not determine rendered UI,
  such as pointer tracking. Use state for values whose changes should update
  the rendered interface.

## Functional and Domain Logic

- Use functional programming techniques where they improve clarity and
  correctness: prefer small functions with explicit inputs and outputs for
  deterministic domain calculations, and avoid mutating shared project data.
- Keep a function's abstraction aligned with one meaningful operation, not a
  particular screen's incidental sequence of steps. Put workflow composition
  in the owning feature or orchestration layer and call smaller operations
  through explicit contracts.
- Keep pure transformations independent of React and browser APIs so they can
  be reasoned about and verified separately. Keep side effects at explicit
  boundaries such as event handlers, persistence adapters, import/export
  functions, or Effects that synchronize with external systems.
- Do not apply functional programming dogmatically. Use straightforward loops,
  local mutation of newly created values, or object-oriented browser APIs when
  they are clearer and safe; the requirement is controlled side effects and
  clear ownership, not a particular syntax style.
- Name intermediate domain steps when that makes a multi-stage algorithm
  easier to follow. Avoid deeply nested callbacks, clever compact expressions,
  and generic abstractions that hide the business rule.
- Preserve immutable update boundaries for values owned by React or shared
  domain state. A pure function may build a new result efficiently without
  requiring every local intermediate value to be immutable.
- Keep UI-specific formatting and localization separate from reusable domain
  calculations unless presentation is itself an explicit input to the
  function.

## React Components and Hooks

- Keep components and Hooks pure during rendering. Do not mutate props, state,
  or shared input data; produce updated values instead.
- Call Hooks at the top level of a function component or custom Hook, in the
  same order on every render. Name custom Hooks with the `use` prefix.
- Keep components focused on a clear UI responsibility. Extract a component or
  custom Hook when that gives behavior a meaningful boundary, not just to split
  a file mechanically.
- Store only the state needed to represent user intent or an interaction.
  Derive values from props and state during render rather than synchronizing
  duplicate state with an Effect.
- Use `useMemo` and `useCallback` when profiling or a known expensive
  calculation/render path justifies caching; they are not required by default.
- Use Effects to synchronize with external systems such as browser APIs, event
  listeners, observers, Canvas, or Three.js. Declare every reactive dependency
  and clean up subscriptions, listeners, timers, observers, renderers, and
  object URLs when dependencies change or the component unmounts.
- Put work caused by a specific user action in its event handler. Do not use an
  Effect as an indirect event dispatcher.

## Next.js and Browser Boundaries

- App Router files are Server Components by default. Add `"use client"` only
  where state, event handlers, Effects, or browser-only APIs are needed; keep
  the client boundary as close to the interactive feature as practical.
- Keep browser-only work out of server rendering. Access to `window`,
  `document`, `localStorage`, Canvas, and WebGL belongs in client-side code and
  must account for unavailable or invalid persisted data where applicable.
- Avoid moving image or project data to a server or third-party service. The
  editor's processing and project data are browser-side by design.

## TypeScript and Domain Logic

- Preserve the existing strict TypeScript configuration. Prefer explicit,
  useful types and discriminated unions over `any`, broad casts, or non-null
  assertions.
- Treat imported JSON, image files, and browser-persisted values as untrusted.
  Validate them at the boundary and normalize older compatible project data
  through existing project-domain APIs.
- Keep domain transformations in small, testable functions in the existing
  domain modules when they do not depend on React or browser UI.
- Preserve immutable update patterns for project, layer, and cell data so
  React can reliably observe changes and undo/history behavior remains sound.
- Keep names consistent with surrounding code. Prefer descriptive names for
  domain concepts and event handlers (`handle...`) over abbreviations.
- Avoid non-null assertions and broad casts when validation, narrowing, or a
  more precise type can express the invariant.

## Canvas, Three.js, and Responsiveness

- Avoid scanning or rebuilding the full bead grid during pointer movement.
  Keep transient interaction state in refs where updating React state on every
  pointer event would cause unnecessary renders.
- Cache or reuse expensive Canvas/Three.js resources where appropriate, and
  dispose resources created by an Effect in its cleanup.
- Keep rendering helpers focused and pass the data they need explicitly.
  Separate calculations from drawing where that makes behavior easier to
  reason about without adding unnecessary abstraction.

## UI, Accessibility, and Localization

- Use semantic HTML controls and preserve keyboard operation, visible focus,
  and accessible names for icon-only or custom controls.
- Keep Chinese and English UI text in the existing localization pattern.
  Avoid introducing new hard-coded interface strings in only one language.
- Preserve responsive layouts and check both narrow and desktop widths for
  controls or interaction changes.

## Verification

- Run `pnpm lint` and `pnpm typecheck` for code changes. Run `pnpm build` when
  changes affect application behavior, routing, or shared types.
- This repository has no automated unit or browser-test suite. For interaction
  changes, perform a focused manual check and report what was and was not
  verified.
- For modularization work, verify that moved responsibilities have not changed
  behavior, state ownership, localization, keyboard interaction, undo/history,
  persistence, or import/export compatibility. Review imports for dependency
  cycles and unnecessary cross-feature coupling.
- Do not weaken lint, type, or validation rules to make a check pass.

## References

- [React: Rules of React](https://react.dev/reference/rules)
- [React: Thinking in React](https://react.dev/learn/thinking-in-react)
- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [TypeScript: The Basics](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)
