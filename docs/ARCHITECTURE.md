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
├─ modules/                # Business capabilities
│  ├─ adjustments/
│  ├─ editor/
│  ├─ image-import/
│  └─ layers/
├─ presentation/           # Page composition and rendering integrations
│  ├─ canvas/
│  ├─ preview/
│  └─ App.tsx
├─ App.tsx                 # Compatibility facade for existing entry points
└─ styles.css
```

## Dependency Direction

The intended direction is:

```text
presentation -> modules -> core
presentation -> common/config
modules      -> core/common/config
core         -> common
common       -> no business modules
```

`core` modules should stay independent from React rendering. Browser APIs are
kept at explicit boundaries such as persistence, image processing, export,
Canvas, and Three.js adapters.

`app/client-app.tsx` remains the Next.js client boundary. It imports the
compatibility facade in `src/App.tsx`, which re-exports the page composition
from `src/presentation/App.tsx`. This preserves existing entry points while
allowing the actual application composition to live in the presentation layer.
