# Contributing

Thanks for helping improve Perler Beads Generator. This guide covers local changes and pull requests.

## Prerequisites

- Node.js 22 (the version used by GitHub Actions)
- pnpm 11.5.2 (pinned in `package.json`)

Use pnpm for local development and CI so installs follow the committed `pnpm-lock.yaml`.

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Next.js prints the local URL when the development server starts (normally `http://localhost:3000`).

Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

To preview the static export locally after building:

```bash
pnpm preview
```

There is no automated test suite yet. For user-visible changes, manually verify the affected workflow in the browser and include the scenario checked in the pull request.

## Code Practices

- Keep changes focused and follow the nearest existing patterns.
- Keep TypeScript strict; model domain data with the shared types in `src/types.ts`.
- Keep image conversion, palette matching, project normalization, usage calculations, and export logic in their existing domain modules when practical.
- Treat imported JSON, browser storage, and user-selected files as untrusted. Validate at boundaries and preserve compatibility with older saved projects.
- Keep expensive work off high-frequency pointer and rendering paths. Clean up event listeners, object URLs, and Three.js resources.
- Preserve accessibility and both Chinese and English UI behavior.
- Add or update tests when a testable behavior changes, once an appropriate test harness exists; meanwhile describe practical manual coverage honestly.
- Document intentional tradeoffs and compatibility changes in the pull request.

Repository-specific AI and agent instructions are in [AGENTS.md](AGENTS.md).

## Pull Requests

- Use a clear, imperative title that describes the user-visible or technical change.
- Explain the problem, the approach, and any behavior or compatibility impact.
- List verification commands and manual browser checks. Mark checks that were not run.
- Include screenshots for meaningful visual changes and sample files only when they are safe to share.
- Keep each pull request focused; do not bundle unrelated formatting or generated build output.
