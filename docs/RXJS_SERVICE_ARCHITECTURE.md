# RxJS Service Architecture

## Assessment

This project is a reasonable candidate for an RxJS-backed service layer, but
RxJS should not become the implementation language for every piece of state.
The editor has several long-lived workflows that benefit from a command stream:

- project state shared by the canvas, palette, layers, usage, and export panels;
- undo/redo and autosave;
- image conversion requests that should cancel or supersede older requests;
- import, export, and other asynchronous browser effects;
- cross-panel notifications and status changes.

Other state is better kept local to the component that owns the interaction:

- pointer coordinates, drag sessions, and canvas previews;
- open/closed popovers and dialogs;
- pointer tracking, zoom, pan, and shape drafts;
- pure derived values such as usage summaries and visible palette entries.

The recommended target is:

```text
UI -> feature service -> pure core/domain functions
                 \-> browser effects
```

The UI reads service snapshots and sends intent-level commands. It should not
own the project aggregate, history stacks, persistence timing, or async
workflow cancellation.

## Current Slice

`src/services/project-service.ts` is the project aggregate service. It owns:

- the current `BeadProject`;
- undo and redo stacks;
- timestamping project revisions;
- debounced draft persistence;
- a `BehaviorSubject` snapshot consumed through
  `src/service-core/use-observable-state.ts`.

`src/presentation/App.tsx` only composes the workspace and accepts image drops.
`EditorTopBar`, `SourcePanel`, `ToolRail`, `WorkspaceCanvas`, `RightPanel`,
`LayerPanel`, and `AdjustmentPanel` resolve their own services through
`useService` and subscribe with `useObservableState`. They do not receive
business state or service methods through props.
Existing project normalization and immutable transformations remain in
`src/core/project.ts`.

The client composition root is `src/service-core/service-injector.ts`,
mounted by `src/service-core/service-provider.tsx`.
It creates a `tsyringe` child container per application instance, registers
each stateful service once, resolves dependencies, and activates all services
together. Constructor dependencies are registered instances in that same
scope, rather than transient factories. Two components resolving the same
token receive the same instance. There are no module-level service singletons.

`BaseService.activate()` and `BaseService.deactivate()` own RxJS subscription
lifecycle. Importing a service does not start persistence or async effects.
Services deactivate in reverse order. Keyboard listeners, pending image
requests, and object URLs are released at the owning service's boundary.

## Capability Ownership

| Service | Responsibility |
| --- | --- |
| `ProjectService` | Project, cell edits, resize, settings, history, autosave |
| `LayerService` | Layer commands, names, usage selection, solo visibility restoration |
| `AdjustmentService` | Adjustment parameters and session, reset, effects, color cleanup |
| `ToolService` | Shared tool parameters, tool shortcuts, clipboard, option visibility |
| `PaletteService` | Palette mode, selected color, recent colors |
| `ReferenceImageService` | Reference file, object URL, transform, O-key shortcut |
| `ImageImportService` | Source image, generation settings, request supersession, validated JSON import |
| `ExportService` | Download effects, localized filenames and export status |
| `LocalizationService` | Language, document language and language preference |
| `NoticeService` | Cross-panel notices and ready/generated message localization |
| `WorkspaceViewService` | Color highlighting, isolated-bead visibility, separate cell-hover stream |
| `WorkspaceService` | New-document coordination and document-level shortcuts |

State with multiple consumers has one service owner. For example, both
`ToolRail` and `WorkspaceCanvas` subscribe to `ToolService`; selecting a tool
does not require an App-level setter or prop forwarding. Canvas pointer
coordinates and gesture refs remain local. Cell hover has a separate stream
consumed by the cell-information region, so it does not rerender the complete
right panel.

Keep presentation-only state such as the selected panel tab, rename draft,
drag target, export-popover draft, tooltip, zoom and pan in its component.
Small visual children such as the clipboard preview and export menu retain
explicit props; dependency injection is a feature boundary, not a requirement
for every visual component.

Adjustment sessions survive tab switches but end when an external edit,
layer switch, resize or history navigation invalidates their baseline.
Image generation checks request identity and project identity after each
asynchronous processing stage before committing its result.

## Guardrails

- Keep pure transformations in `src/core`; services coordinate them.
- Do not put high-frequency pointer events into the project state stream.
- Use `switchMap` for replaceable async work and `concatMap` only when every
  queued command must complete.
- Keep browser-only persistence and object-URL management at explicit effect
  boundaries.
- UI subscribes to snapshots; service methods are the write API. Do not call
  a snapshot subject's `next()` from presentation code.
- Destroy subscriptions when a service lifecycle ends. The application
  Injector owns the current service scope.

## Conclusion

RxJS is suitable as the business orchestration backbone for this editor, with
medium-to-high expected value. It is not a good reason to replace React's
local state or pure `useMemo` derivations wholesale. The service layer should
be introduced capability by capability, starting with project state and
history, then moving asynchronous image import and export workflows.
