# Frontend Architecture

The editor is a browser-only Next.js application. The directory layout follows
the responsibility-oriented structure commonly used in NestJS projects without
introducing NestJS runtime dependencies.

```text
src/
├─ common/                 # Shared contracts and UI primitives
│  ├─ types.ts
│  └─ ui/EditorIcons.tsx
├─ config/                 # Static editor configuration and localization
│  ├─ editor.ts
│  └─ localization.tsx
├─ core/                   # Browser-independent domain and adapters
│  ├─ export/exporters.ts
│  ├─ image-processing/imageToBeads.ts
│  ├─ palette.ts
│  ├─ project.ts
│  └─ usage.ts
├─ features/               # Business capabilities
│  ├─ adjustments/
│  ├─ editor/
│  ├─ image-import/
│  └─ layers/
├─ presentation/           # Page composition and rendering integrations
│  ├─ App.tsx
│  └─ SourcePanel.tsx
└─ styles.css
```

The RxJS service boundary lives between presentation and core:

```text
presentation -> services -> core
                    \-> browser effects
```

`src/services` owns long-lived business state and orchestration. `src/service-core`
contains the lifecycle, Injector, and React subscription bridge used by those
services. High-frequency canvas interaction and transient panel state remain in
presentation components.

`app/client-app.tsx` mounts `ServiceProvider`, which creates one `tsyringe`
scope per client application. Services receive other services through
constructor injection, and `BaseService` activation/deactivation owns RxJS
subscriptions and browser-side effects.

The workspace's feature components resolve their own services with `useService`.
`App` composes those regions without forwarding business-state props.
Shared tool, palette, reference-image, import, project, and notification state
belongs to its corresponding service. Local drafts, popovers, pointer tracking,
zoom and pan stay in their owning components. The cell-hover stream is separate
from other workspace state to avoid refreshing unrelated panels on pointer moves.
See [RXJS_SERVICE_ARCHITECTURE.md](RXJS_SERVICE_ARCHITECTURE.md) for service ownership.

## Dependency Direction

The intended direction is:

```text
presentation -> features -> core
presentation -> common/config
features     -> core/common/config
core         -> common
common       -> no business features
```

`core` modules should stay independent from React rendering. Browser APIs are
kept at explicit boundaries such as persistence, image processing, export,
Canvas, and Three.js adapters.

`app/client-app.tsx` is the single client entry boundary. It mounts the service
provider and imports the page composition directly from
`src/presentation/App.tsx`.
