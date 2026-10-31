# AI-Assisted Development Prompts

Use these prompts as starting points. Replace bracketed text with the task details. Repository-specific instructions in `AGENTS.md` take precedence.
For React and TypeScript implementation details, follow [`DEVELOPMENT_GUIDELINES.md`](DEVELOPMENT_GUIDELINES.md) as well.
Design components, functions, Hooks, utilities, and modules as independently meaningful abstractions; compose them to implement feature workflows instead of embedding one workflow in a supposedly reusable building block.

## Feature or Bug Fix

```text
Please work in this repository to [feature or bug].

First inspect the relevant implementation, types, callers, and existing workflows.
Then make the smallest coherent change that solves the problem and follows `AGENTS.md` and `docs/DEVELOPMENT_GUIDELINES.md`. Keep reusable abstractions independent of feature-specific behavior, and compose them in the feature layer.
Preserve existing saved-project and import/export compatibility unless the request explicitly changes it.
Run the relevant lint, typecheck, and build checks. For browser behavior, perform or describe a focused manual check.
Finish with a concise summary of the changes, checks actually run, and remaining risks.
```

## Code Review

```text
Review the current changes for correctness and regressions.
Check React and TypeScript changes against `docs/DEVELOPMENT_GUIDELINES.md`.
Prioritize concrete bugs, compatibility problems, data loss, performance issues on large bead grids,
resource leaks, accessibility regressions, and missing verification.
Do not edit files. Report findings first, ordered by severity, with file and line references.
If there are no actionable findings, say so and note any remaining test gaps.
```

## Refactor

```text
Refactor [module or behavior] without changing user-visible behavior or persisted project formats.
Follow `docs/DEVELOPMENT_GUIDELINES.md`, especially its abstraction/composition, modular design, component responsibility, state ownership, and functional/domain logic guidance.
Before editing, map the current responsibilities, state owners, side effects, and dependency relationships relevant to the change. Propose or establish clear boundaries, then make the smallest coherent incremental refactor; do not split by line count or introduce a new architecture without need.
For each proposed abstraction, identify its independent concept and contract; keep business-specific data and behavior in composed feature modules. Avoid speculative generalization and pass-through wrappers.
Inspect call sites and existing checks first. Keep the refactor scoped and avoid unrelated formatting.
Run lint, typecheck, build, and focused manual checks as applicable. Report any behavior you could not verify.
```

## UI Change

```text
Implement [UI change] in the existing interface conventions.
Follow the React, accessibility, and localization requirements in `docs/DEVELOPMENT_GUIDELINES.md`.
Preserve keyboard access, focus visibility, responsive layout, and Chinese/English text.
Check narrow and desktop layouts, plus the affected interaction states.
Avoid adding explanatory in-app copy unless it is needed to operate the feature.
```

## Prompting Checklist

- Name the user problem and expected result, not only the implementation idea.
- Identify important constraints, affected workflows, and compatibility requirements.
- Ask for inspection before edits when the affected area is unclear.
- Request checks and an honest report of anything not verified.
- Do not provide secrets or private user images/project files to external AI services.
