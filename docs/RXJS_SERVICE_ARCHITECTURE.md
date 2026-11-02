# RxJS Service Architecture

## Dependency Direction

```text
UI -> feature services -> EditorService -> ProjectService
                         \-> pure domain operations
UI -> EditorQueryService -> project/palette/localization/view state
```

`ProjectService` is the only owner of the project, history, runtime revision and
draft persistence. Its mutation methods are internal to `EditorService`.
Feature services must not assemble modified projects or manage history stacks.
`EditorQueryService` is a read model, not an editing API.

## Injector and Lifecycle

There is one in-memory `Injector` and one instance of each service per browser
runtime. Refreshing creates a new runtime. There are no child containers or
per-component service scopes. All services use `@singleton()` through the DI
entry point that loads `reflect-metadata` first. TypeScript decorator metadata
provides constructor injection.

The composition root keeps a list of service types, not constructed instances
or dependency wiring. When the Injector singleton is created, it resolves the
service graph once; resolution-completion hooks collect instances in
dependency-first order. To add a service, annotate the class, declare constructor
dependencies and add its type to that list. Domain modules never resolve
services, and feature services never access the Injector.

`ServiceProvider` only binds the already-created services when the root React
tree mounts and unbinds them when it is destroyed. `BaseService` owns
subscriptions and external event handlers, and unbinding only removes those
bindings. It does not reset project/history or clear reference-image state.
Pending image requests and their object URLs are cancelled at this resource
boundary. StrictMode may bind/unbind the same instances more than once; both
operations are idempotent. Language changes update localization without
rebinding the service graph.

Language buttons use native history navigation between the equivalent locale
workspace URLs. This avoids a root-layout document reload, retaining singleton
state and undo history. Localization also handles back/forward, document title
and description; directly opening either locale URL still uses its static page.

## Capability Ownership

| Service | Responsibility |
| --- | --- |
| `ProjectService` | Project state, history storage, revision, timestamps, autosave |
| `EditorService` | Editing commands, validation, transactions, lock and history policies |
| `EditorQueryService` | Display projection, layer information, usage and palette-derived read model |
| `CanvasEditService` | Canvas intent coordination, clipboard selection, tool options and notices |
| `LayerService` | Layer intent coordination, localized and duplicate naming |
| `AdjustmentService` | Adjustment parameters and baseline-preview session |
| `ImportService` | File validation, image conversion, JSON parsing, request supersession, temporary URLs |
| `WorkspaceService` | New/import document coordination, undo/redo commands and shortcuts |
| `ToolService` | Tool parameters, shortcuts, clipboard, selection and options |
| `PaletteService` | Palette mode, selected color, recent colors |
| `WorkspaceViewService` | View command entry, highlights, isolated beads and separate hover stream |
| `ReferenceImageService` | Reference image resource, display, transform and shortcut |
| `ExportService` | Export parameters, localized filenames and browser downloads |
| `LocalizationService` | Current language and document-language synchronization |
| `NoticeService` | Notification state and notification localization |

## Editing Contract

Commands return `EditResult`: applied, unchanged, or rejected with a typed reason
(locked, invalid input, stale revision, invalid session, or empty history).
The kernel contains no UI strings, notifications or tool/palette state.
Adjustment palettes are explicit command inputs.

Continuous editing uses `beginEdit`, `updateEdit`, `finishEdit` and `cancelEdit`.
Opaque handles are checked by identity. A session owns its baseline; move and
adjustment updates are calculated from it, not from previously transformed
previews. Drawing updates use current cells. A discrete command, layer switch,
lock change, resize or history navigation finishes the old session. Subsequent
updates from the old handle are rejected.

Finishing records one history entry only when final content differs from the
baseline. Cancelling restores the baseline without consuming redo. Escape and
pointer cancellation cancel canvas gestures; adjustment reset cancels its
preview. Switching adjustment panels does not end the preview.

History covers content, canvas dimensions, layer structure/metadata and document
replacement, with a 40-entry limit. Project settings and transient view/tool/
reference state do not enter history. Undo/redo retains current settings and
the active layer when it still exists. Effective new history clears redo;
no-op commands do not change timestamps, revisions or history.

Layer locks block content operations, including image replacement; global
recolor skips locked layers and respects the effective visible scope.
Layer management and document resizing remain allowed, including cropping or
expanding locked layers. Undo/redo and document replacement bypass content locks.
Solo mode only changes the display projection, never actual layer visibility.

## Boundaries and Performance

Public state streams use `ReadonlyState`: subscription and `getValue`, without
`next` or `complete`. React's `useObservableState` reads that contract through
`useSyncExternalStore`. Mutable subjects are private.

Pure editing/adjustment transformations live under `services/domain`. Canvas
pointer tracking, zoom, pan and shape drafts stay local. Browser glyph
rasterization remains outside the kernel. Paint operations report no change
through array identity without an additional full-project comparison.

Images and JSON stay in the browser. Import validates nested cells, layers and
settings and normalizes compatible older records. Image processing checks
request identity and project revision after each async stage; the kernel
rechecks revision and target-layer lock before applying the result.
Successful project imports are coordinated by `WorkspaceService`; failed or
cancelled reads leave project and tool state intact.

## Verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build`.
The Node checks cover pure operations, eager singleton resolution, root binding,
state write boundaries, transactions, history, locks, import cancellation and
persistence. Tests unbind services, clear singleton instance caches while
retaining decorator registrations, and reload the composition-root module.
Production exposes no reset entry point. Browser behavior still requires
focused checks.
