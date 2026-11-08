const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

// Load the TypeScript services without generating files or adding a test runtime.
function compileService(module, filename) {
  const originalRequire = module.require.bind(module);
  module.require = (specifier) => originalRequire(
    specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : specifier,
  );
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      useDefineForClassFields: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });
  module._compile(outputText, filename);
}
require.extensions['.ts'] = compileService;
require.extensions['.tsx'] = compileService;

require('reflect-metadata');
const { container } = require('tsyringe');
const injectorPath = require.resolve('../src/service-core/service-injector.ts');
let Injector;
const { ProjectService } = require('../src/services/project-service.ts');
const { LayerService } = require('../src/services/layer-service.ts');
const { ImportService } = require('../src/services/import-service.ts');
const { WorkspaceService } = require('../src/services/workspace-service.ts');
const { EditorService } = require('../src/services/editor-service.ts');
const { EditorQueryService } = require('../src/services/editor-query-service.ts');
const { AdjustmentService } = require('../src/services/adjustment-service.ts');
const { LocalizationService } = require('../src/services/localization-service.ts');
const { CanvasEditService } = require('../src/services/canvas-edit-service.ts');
const { NoticeService } = require('../src/services/notice-service.ts');
const { ToolService } = require('../src/services/tool-service.ts');
const { autosaveKey, createProject, withLayers } = require('../src/services/domain/project.ts');

const globalNames = ['window', 'document', 'localStorage'];
const originalGlobals = new Map(globalNames.map((name) => [
  name, Object.getOwnPropertyDescriptor(globalThis, name),
]));
afterEach(() => {
  Injector?.unbind();
  container.clearInstances();
  delete require.cache[injectorPath];
  Injector = undefined;
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function browserStorage() {
  const values = new Map();
  const writes = [];
  const browserWindow = new EventTarget();
  const browserDocument = new EventTarget();
  browserDocument.visibilityState = 'visible';
  browserDocument.documentElement = { lang: 'zh' };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
      writes.push(key);
    },
    removeItem: (key) => values.delete(key),
  };
  for (const [name, value] of Object.entries({
    window: browserWindow, document: browserDocument, localStorage: storage,
  })) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  return {
    window: browserWindow,
    document: browserDocument,
    values,
    writes,
    savedProject: () => JSON.parse(values.get(autosaveKey)),
  };
}

function services() {
  if (!Injector) {
    ({ Injector } = require(injectorPath));
    Injector.bind('zh');
  }
  return Injector;
}

function projectService() {
  return services().resolve(ProjectService);
}

function drawCell(service, index, colorId) {
  assert.strictEqual(service, services().resolve(ProjectService));
  services().resolve(EditorService).execute({ type: 'indices', indices: [index], colorId });
}

function soloProject() {
  const injector = services();
  const project = Injector.resolve(ProjectService);
  const layers = injector.resolve(LayerService);
  const images = injector.resolve(WorkspaceService);
  const imports = injector.resolve(ImportService);
  const editor = injector.resolve(EditorService);
  const initial = createProject(8, 8);
  const base = initial.layers[0];
  editor.replaceDocument(withLayers(initial, [
    { ...base, cells: Array(64).fill('mard-h7') },
    { ...base, id: 'overlay', name: 'Overlay', visible: false, cells: Array(64).fill('mard-h2') },
  ]));
  layers.toggleActiveLayerOnly();
  return { project, layers, images, imports, editor };
}

function copySelectionServices() {
  const injector = services();
  const project = injector.resolve(ProjectService);
  const editor = injector.resolve(EditorService);
  editor.replaceDocument(createProject(8, 8));
  editor.execute({ type: 'indices', indices: [0, 1, 2, 3], colorId: 'mard-h7' });
  const tools = injector.resolve(ToolService);
  tools.setTool('copy');
  tools.setCopyMode('selection');
  return {
    project,
    tools,
    canvas: injector.resolve(CanvasEditService),
    notice: injector.resolve(NoticeService),
  };
}

test('copy selection accumulates additions and removals across drag segments', () => {
  const { project, tools, canvas } = copySelectionServices();
  const baseline = project.snapshot;
  const initialIndices = [];
  let selection = canvas.updateCopySelection([{ x: 0, y: 0 }], 'add', initialIndices);
  assert.deepEqual(initialIndices, []);
  assert.deepEqual(selection.indices, [0]);
  selection = canvas.updateCopySelection([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'add', selection.indices);
  assert.deepEqual(selection.indices, [0, 1]);
  selection = canvas.updateCopySelection([{ x: 1, y: 0 }, { x: 2, y: 0 }], 'add', selection.indices);
  assert.deepEqual(selection.indices, [0, 1, 2]);
  selection = canvas.updateCopySelection([{ x: 2, y: 0 }, { x: 3, y: 0 }], 'add', selection.indices);
  assert.deepEqual(selection.indices, [0, 1, 2, 3]);
  assert.deepEqual(selection.pattern, { width: 4, height: 1, cells: Array(4).fill('mard-h7') });
  assert.strictEqual(tools.snapshot.copySelectionIndices, selection.indices);

  for (const x of [0, 1, 2, 3]) {
    selection = canvas.updateCopySelection([{ x, y: 0 }], 'remove', selection.indices);
    assert.deepEqual(selection.indices, Array.from({ length: 3 - x }, (_, index) => x + index + 1));
  }
  assert.equal(selection.pattern, null);
  assert.equal(tools.snapshot.clipboardPattern, null);
  assert.strictEqual(project.snapshot, baseline);
});

test('unchanged copy selection preserves snapshots and emits no duplicate notices', (context) => {
  const { tools, canvas, notice } = copySelectionServices();
  const selected = canvas.updateCopySelection([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'add', []);
  const snapshot = tools.snapshot;
  const emissions = { tools: 0, notices: 0 };
  const toolSubscription = tools.snapshot$.subscribe(() => { emissions.tools += 1; });
  const noticeSubscription = notice.snapshot$.subscribe(() => { emissions.notices += 1; });
  context.after(() => {
    toolSubscription.unsubscribe();
    noticeSubscription.unsubscribe();
  });
  const baseline = { ...emissions };

  for (const [points, action] of [
    [[{ x: 0, y: 0 }, { x: 1, y: 0 }], 'add'],
    [[{ x: 2, y: 0 }], 'remove'],
    [[{ x: 4, y: 0 }], 'add'],
    [[{ x: -1, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }], 'add'],
    [[], 'remove'],
  ]) {
    const result = canvas.updateCopySelection(points, action, selected.indices);
    assert.strictEqual(result.indices, selected.indices);
    assert.strictEqual(result.pattern, selected.pattern);
    assert.strictEqual(tools.snapshot, snapshot);
    assert.deepEqual(emissions, baseline);
  }

  const removed = canvas.updateCopySelection([{ x: 0, y: 0 }], 'remove', selected.indices);
  assert.deepEqual(removed.indices, [1]);
  assert.deepEqual(emissions, { tools: baseline.tools + 1, notices: baseline.notices + 1 });
});

test('empty copy-selection gestures do not overwrite an existing clipboard or notice', () => {
  const { tools, canvas, notice } = copySelectionServices();
  const pattern = { width: 1, height: 1, cells: ['mard-h2'] };
  tools.copyPattern(pattern, false);
  const snapshot = tools.snapshot;
  const message = notice.snapshot$.getValue();
  const indices = [];
  const result = canvas.updateCopySelection([{ x: 4, y: 0 }], 'add', indices);
  assert.strictEqual(result.indices, indices);
  assert.strictEqual(result.pattern, pattern);
  assert.strictEqual(tools.snapshot, snapshot);
  assert.equal(notice.snapshot$.getValue(), message);
});

test('ordinary editing remains debounced', async () => {
  const browser = browserStorage();
  const project = projectService();
  drawCell(project, 0, 'mard-h7');
  drawCell(project, 1, 'mard-h2');
  assert.equal(browser.values.has(autosaveKey), false);
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.deepEqual(browser.savedProject().cells.slice(0, 2), ['mard-h7', 'mard-h2']);
  assert.equal(browser.writes.length, 1);
});

test('pagehide saves the latest edit before the debounce expires', () => {
  const browser = browserStorage();
  const project = projectService();
  drawCell(project, 0, 'mard-h7');
  drawCell(project, 1, 'mard-h2');
  assert.equal(browser.values.has(autosaveKey), false);
  browser.window.dispatchEvent(new Event('pagehide'));
  const reloaded = new ProjectService();
  assert.deepEqual(reloaded.activeLayer.cells.slice(0, 2), ['mard-h7', 'mard-h2']);
});

test('hiding the document saves pending edits', () => {
  const browser = browserStorage();
  const project = projectService();
  drawCell(project, 0, 'mard-h7');
  browser.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(browser.values.has(autosaveKey), false);
  browser.document.visibilityState = 'hidden';
  browser.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(browser.savedProject().cells[0], 'mard-h7');
});

test('root unbind saves edits, removes listeners and cancels the timer', async () => {
  const browser = browserStorage();
  const injector = services();
  const project = projectService();
  drawCell(project, 0, 'mard-h7');
  injector.unbind();
  injector.unbind();
  assert.equal(browser.savedProject().cells[0], 'mard-h7');
  assert.equal(browser.writes.length, 1);

  drawCell(project, 1, 'mard-h2');
  browser.window.dispatchEvent(new Event('pagehide'));
  browser.document.visibilityState = 'hidden';
  browser.document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(browser.writes.length, 1);
  assert.equal(browser.savedProject().cells[1], null);

  injector.bind('zh');
  injector.bind('zh');
  browser.window.dispatchEvent(new Event('pagehide'));
  assert.equal(browser.writes.length, 2);
  assert.equal(browser.savedProject().cells[1], 'mard-h2');
});

test('unavailable storage does not break editing or root unbind', () => {
  const browser = browserStorage();
  const project = projectService();
  localStorage.setItem = () => { throw new Error('Storage is unavailable.'); };
  assert.doesNotThrow(() => {
    drawCell(project, 0, 'mard-h7');
    browser.window.dispatchEvent(new Event('pagehide'));
    browser.document.visibilityState = 'hidden';
    browser.document.dispatchEvent(new Event('visibilitychange'));
    services().unbind();
  });
  assert.equal(project.activeLayer.cells[0], 'mard-h7');
});

test('importing the same project preserves imported visibility without a solo snapshot', async () => {
  const { project, layers, images, editor } = soloProject();
  const imported = {
    ...project.snapshot.project,
    activeLayerId: 'overlay',
    layers: project.snapshot.project.layers.map((layer) => ({ ...layer, visible: layer.id === 'overlay' })),
  };
  await images.importRecord({ text: async () => JSON.stringify(imported) });
  assert.equal(project.snapshot.project.createdAt, imported.createdAt);
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [false, true]);
  layers.toggleActiveLayerOnly();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [false, true]);
  assert.equal(project.activeLayer.visible, true);
  assert.equal(project.snapshot.project.cells[0], 'mard-h2');

  editor.undo();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
  editor.redo();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [false, true]);
});

test('invalid imports preserve real layer visibility', async () => {
  const { project, layers, images } = soloProject();
  layers.selectLayer('overlay');
  const previous = project.snapshot.project;
  await assert.rejects(images.importRecord({ text: async () => '{"invalid":true}' }));
  assert.equal(project.snapshot.project, previous);
  layers.toggleActiveLayerOnly();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
});

test('cancelled imports preserve real layer visibility', async () => {
  const { project, layers, images, imports } = soloProject();
  layers.selectLayer('overlay');
  const previous = project.snapshot.project;
  let finishReading;
  const pending = images.importRecord({
    text: () => new Promise((resolve) => { finishReading = resolve; }),
  });
  imports.reset();
  finishReading(JSON.stringify(createProject(9, 9)));
  await pending;
  assert.equal(project.snapshot.project, previous);
  layers.toggleActiveLayerOnly();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
});

function editing() {
  const injector = services();
  const editor = injector.resolve(EditorService);
  editor.createDocument(8, 8);
  return { editor, project: injector.resolve(ProjectService), injector };
}

function colorCells(editor, indices, colorId = 'mard-h7') {
  return editor.execute({ type: 'indices', indices, colorId });
}

test('Injector eagerly resolves singleton services and root binding only manages listeners', () => {
  const browser = browserStorage();
  ({ Injector } = require(injectorPath));
  const project = Injector.resolve(ProjectService);
  const editor = Injector.resolve(EditorService);
  assert.equal(typeof Injector.initialize, 'undefined');
  assert.ok(project.snapshot.project);
  colorCells(editor, [0]);
  const baseline = project.snapshot;
  browser.window.dispatchEvent(new Event('pagehide'));
  assert.equal(browser.values.has(autosaveKey), false);
  Injector.bind('zh');
  Injector.bind('zh');
  assert.strictEqual(Injector.resolve(ProjectService), project);
  assert.strictEqual(project.snapshot, baseline);
  Injector.resolve(LocalizationService).setLanguage('en');
  assert.equal(Injector.resolve(LocalizationService).language, 'en');
  assert.equal(browser.document.documentElement.lang, 'en');
  Injector.unbind();
  Injector.bind('en');
  assert.strictEqual(project.snapshot, baseline);
});

test('language navigation preserves the singleton project and handles prefixed routes and popstate', () => {
  const browser = browserStorage();
  browser.window.location = new URL('https://example.test/beads/en/?mode=edit#board');
  browser.window.history = {
    pushState: (_state, _unused, url) => { browser.window.location = new URL(url, browser.window.location); },
  };
  const injector = services();
  const localization = injector.resolve(LocalizationService);
  localization.setLanguage('en');
  const editor = injector.resolve(EditorService);
  colorCells(editor, [0]);
  const project = injector.resolve(ProjectService);
  const snapshot = project.snapshot;
  localization.navigateLanguage('zh');
  assert.equal(browser.window.location.pathname, '/beads/zh/');
  assert.equal(browser.window.location.search, '?mode=edit');
  assert.equal(browser.window.location.hash, '#board');
  assert.equal(browser.document.documentElement.lang, 'zh');
  assert.strictEqual(project.snapshot, snapshot);
  browser.window.location = new URL('https://example.test/beads/en/');
  browser.window.dispatchEvent(new Event('popstate'));
  assert.equal(localization.language, 'en');
  editor.undo();
  assert.equal(editor.activeLayer.cells[0], null);
});

test('public observable state has no write or complete methods', () => {
  const injector = services();
  for (const type of [ProjectService, EditorQueryService, ToolService, ImportService, AdjustmentService, LocalizationService, NoticeService]) {
    const stream = injector.resolve(type).snapshot$;
    assert.equal(stream.next, undefined, type.name);
    assert.equal(stream.complete, undefined, type.name);
    assert.equal(typeof stream.getValue, 'function');
  }
});

test('localized notices update with the runtime language without losing their payload', () => {
  const injector = services();
  const notices = injector.resolve(NoticeService);
  const language = injector.resolve(LocalizationService);
  notices.show((text) => text.canvasResized(9, 10));
  language.setLanguage('en');
  assert.equal(notices.snapshot, language.text.canvasResized(9, 10));
  language.setLanguage('zh');
  assert.equal(notices.snapshot, language.text.canvasResized(9, 10));
  notices.show('External error');
  language.setLanguage('en');
  assert.equal(notices.snapshot, 'External error');
});

test('root bind failure cleans up bound services and permits retry', (context) => {
  const browser = browserStorage();
  const injector = services();
  injector.unbind();
  const notice = injector.resolve(NoticeService);
  const original = notice.onBind;
  context.mock.method(notice, 'onBind', function () {
    original.call(this);
    throw new Error('binding failure');
  });
  assert.throws(() => injector.bind('zh'), /binding failure/);
  const writes = browser.writes.length;
  browser.window.dispatchEvent(new Event('pagehide'));
  assert.equal(browser.writes.length, writes);
  context.mock.restoreAll();
  injector.bind('zh');
  browser.window.dispatchEvent(new Event('pagehide'));
  assert.equal(browser.writes.length, writes + 1);
});

test('a continuous gesture creates one history entry and supports undo and redo', () => {
  const { editor, project } = editing();
  const count = project.snapshot.past.length;
  const handle = editor.beginEdit();
  editor.updateEdit(handle, { type: 'indices', indices: [0], colorId: 'mard-h7' });
  editor.updateEdit(handle, { type: 'indices', indices: [1], colorId: 'mard-h2' });
  assert.equal(project.snapshot.past.length, count);
  assert.equal(editor.finishEdit(handle).status, 'applied');
  assert.equal(project.snapshot.past.length, count + 1);
  editor.undo();
  assert.deepEqual(project.activeLayer.cells.slice(0, 2), [null, null]);
  editor.redo();
  assert.deepEqual(project.activeLayer.cells.slice(0, 2), ['mard-h7', 'mard-h2']);
});

test('cancelling a gesture restores its baseline and keeps redo and view preferences', () => {
  const { editor, project } = editing();
  colorCells(editor, [0]);
  editor.undo();
  const future = project.snapshot.future;
  const past = project.snapshot.past;
  const handle = editor.beginEdit();
  editor.updateEdit(handle, { type: 'indices', indices: [1], colorId: 'mard-h2' });
  editor.updateSettings({ showGrid: false });
  editor.cancelEdit(handle);
  assert.equal(project.activeLayer.cells[1], null);
  assert.equal(editor.project.settings.showGrid, false);
  assert.strictEqual(project.snapshot.future, future);
  assert.strictEqual(project.snapshot.past, past);
  assert.deepEqual(editor.updateEdit(handle, { type: 'clear' }), { status: 'rejected', reason: 'invalid-session' });
  editor.redo();
  assert.equal(project.activeLayer.cells[0], 'mard-h7');
});

test('no-op commands preserve timestamps, revision, history and redo', () => {
  const { editor, project } = editing();
  colorCells(editor, [0]);
  editor.undo();
  const baseline = project.snapshot;
  for (const command of [
    { type: 'clear' },
    { type: 'indices', indices: [], colorId: 'mard-h7' },
    { type: 'paint', input: { x: 0, y: 0, gridX: 0.5, gridY: 0.5, value: null, brushSize: 0, brush: false } },
    { type: 'shift', dx: 0, dy: 0, indices: [] },
    { type: 'mirror', direction: 'horizontal', indices: [] },
  ]) {
    assert.equal(editor.execute(command).status, 'unchanged');
    assert.strictEqual(project.snapshot, baseline);
  }
  const handle = editor.beginEdit();
  assert.equal(editor.finishEdit(handle).status, 'unchanged');
  assert.strictEqual(project.snapshot, baseline);
});

test('a preview returned to its baseline creates no history and preserves redo', () => {
  const { editor, project } = editing();
  colorCells(editor, [0]);
  editor.undo();
  const baseline = project.snapshot;
  const handle = editor.beginEdit();
  editor.updateEdit(handle, { type: 'indices', indices: [2], colorId: 'mard-h2' });
  editor.updateEdit(handle, { type: 'clear' });
  assert.equal(editor.finishEdit(handle).status, 'unchanged');
  assert.strictEqual(project.snapshot.past, baseline.past);
  assert.strictEqual(project.snapshot.future, baseline.future);
  assert.equal(editor.project.updatedAt, baseline.project.updatedAt);
});

test('discrete edits, layer switches, locks and history navigation invalidate handles', () => {
  const { editor } = editing();
  for (const invalidate of [
    () => colorCells(editor, [1]),
    () => editor.addLayer('new'),
    () => editor.updateLayer(editor.activeLayer.id, { locked: true }),
    () => editor.resizeCanvas(9, 9),
    () => editor.undo(),
  ]) {
    editor.updateLayer(editor.activeLayer.id, { locked: false });
    const handle = editor.beginEdit();
    editor.updateEdit(handle, { type: 'indices', indices: [0], colorId: 'mard-h2' });
    invalidate();
    const revision = editor.revision;
    assert.deepEqual(editor.updateEdit(handle, { type: 'clear' }), { status: 'rejected', reason: 'invalid-session' });
    assert.equal(editor.revision, revision);
  }
});

test('content locks reject content writes but allow layer management, resizing and undo', () => {
  const { editor, project } = editing();
  colorCells(editor, [0, 63]);
  editor.updateLayer(editor.activeLayer.id, { locked: true });
  assert.equal(editor.beginEdit(), null);
  for (const command of [
    { type: 'clear' }, { type: 'fill', x: 0, y: 0, colorId: 'mard-h2' },
    { type: 'indices', indices: [0], colorId: 'mard-h2' },
  ]) assert.deepEqual(editor.execute(command), { status: 'rejected', reason: 'locked' });
  assert.equal(editor.replaceColor('mard-h7', 'mard-h2').status, 'unchanged');
  assert.equal(editor.updateLayer(editor.activeLayer.id, { name: 'Locked name' }).status, 'applied');
  assert.equal(editor.resizeCanvas(9, 9).status, 'applied');
  assert.equal(project.activeLayer.cells[7 * 9 + 7], 'mard-h7');
  assert.equal(editor.undo().status, 'applied');
  assert.equal(editor.project.width, 8);
  const original = editor.activeLayer.id;
  editor.duplicateLayer(original, 'Copy');
  assert.equal(editor.activeLayer.locked, false);
  assert.equal(editor.deleteLayer(original).status, 'applied');
});

test('bulk recolor only updates unlocked layers in the current visible scope', () => {
  const { editor } = editing();
  colorCells(editor, [0]);
  const base = editor.activeLayer.id;
  editor.addLayer('locked');
  colorCells(editor, [1]);
  editor.updateLayer(editor.activeLayer.id, { locked: true });
  editor.addLayer('hidden');
  colorCells(editor, [2]);
  editor.updateLayer(editor.activeLayer.id, { visible: false });
  editor.selectLayer(base);
  assert.deepEqual(editor.replaceColor('mard-h7', 'mard-h2'), { status: 'applied', affected: 1 });
  assert.deepEqual(editor.project.layers.map((layer) => layer.cells.filter((cell) => cell === 'mard-h7').length), [0, 1, 1]);
});

test('solo viewing and undo preserve real visibility, preferences and effective display', () => {
  const { project, layers, editor } = soloProject();
  const realLayers = project.snapshot.project.layers;
  const query = services().resolve(EditorQueryService);
  assert.strictEqual(project.snapshot.project.layers, realLayers);
  layers.selectLayer('overlay');
  assert.deepEqual(editor.project.layers.map((layer) => layer.visible), [true, false]);
  assert.equal(query.snapshot.displayProject.cells[0], 'mard-h2');
  editor.updateSettings({ showGrid: false, beadsPerPack: 1000 });
  colorCells(editor, [0], 'mard-h3');
  editor.undo();
  assert.equal(editor.project.settings.showActiveLayerOnly, true);
  assert.equal(editor.project.settings.showGrid, false);
  assert.equal(editor.project.settings.beadsPerPack, 1000);
  assert.equal(editor.project.activeLayerId, 'overlay');
  layers.toggleActiveLayerOnly();
  assert.deepEqual(editor.project.layers.map((layer) => layer.visible), [true, false]);
  assert.equal(query.snapshot.displayProject.cells[0], 'mard-h7');
});

test('layer usage, ordering, metadata and deletion are undoable', () => {
  const { editor } = editing();
  const base = editor.activeLayer.id;
  editor.addLayer('second');
  const second = editor.activeLayer.id;
  editor.updateUsageSelection(new Set([base]));
  assert.equal(editor.activeLayer.includeInUsage, false);
  editor.undo();
  assert.equal(editor.activeLayer.includeInUsage, true);
  editor.moveLayer(base, { id: second, edge: 'before' });
  assert.deepEqual(editor.project.layers.map((layer) => layer.id), [second, base]);
  editor.undo();
  assert.deepEqual(editor.project.layers.map((layer) => layer.id), [base, second]);
  editor.updateLayer(second, { opacity: 0.5, visible: false });
  editor.undo();
  assert.equal(editor.activeLayer.opacity, 1);
  editor.deleteLayer(second);
  assert.equal(editor.project.layers.length, 1);
  editor.undo();
  assert.equal(editor.project.layers.length, 2);
});

test('adjustment previews are baseline-based, resettable and committed once before other edits', () => {
  const { editor, project, injector } = editing();
  colorCells(editor, [0, 1]);
  const adjustment = injector.resolve(AdjustmentService);
  const baseline = editor.activeLayer.cells.slice();
  const history = project.snapshot.past.length;
  adjustment.setAdjustment('brightness', 50);
  const preview = editor.activeLayer.cells.slice();
  adjustment.setAdjustment('brightness', 50);
  assert.deepEqual(editor.activeLayer.cells, preview);
  adjustment.reset();
  assert.deepEqual(editor.activeLayer.cells, baseline);
  assert.equal(project.snapshot.past.length, history);
  adjustment.setAdjustment('brightness', 50);
  colorCells(editor, [2]);
  assert.equal(adjustment.snapshot.adjustments.brightness, 0);
  assert.equal(project.snapshot.past.length, history + 2);
  editor.undo();
  assert.deepEqual(editor.activeLayer.cells, preview);
  editor.undo();
  assert.deepEqual(editor.activeLayer.cells, baseline);
});

test('effects, cleanup and color limiting execute through the kernel', () => {
  const { editor, project, injector } = editing();
  for (const [index, colorId] of ['mard-h7', 'mard-h2', 'mard-a1', 'mard-a2'].entries()) colorCells(editor, [index], colorId);
  const adjustments = injector.resolve(AdjustmentService);
  for (const operation of [
    () => adjustments.applyEffect('invert'),
    () => adjustments.cleanup(),
    () => { adjustments.setLayerColorLimit(2); adjustments.limitColors(); },
  ]) {
    const baseline = editor.activeLayer.cells.slice();
    const history = project.snapshot.past.length;
    operation();
    if (project.snapshot.past.length > history) {
      editor.undo();
      assert.deepEqual(editor.activeLayer.cells, baseline);
    }
  }
});

test('moves use the session origin, can return to origin and reject collisions', () => {
  const { editor, project } = editing();
  colorCells(editor, [0]);
  colorCells(editor, [2], 'mard-h2');
  const baseline = editor.activeLayer.cells.slice();
  const handle = editor.beginEdit();
  editor.updateEdit(handle, { type: 'shift', dx: 1, dy: 0, indices: [0] });
  assert.equal(editor.activeLayer.cells[1], 'mard-h7');
  editor.updateEdit(handle, { type: 'shift', dx: 2, dy: 0, indices: [0] });
  assert.equal(editor.activeLayer.cells[2], 'mard-h2');
  editor.updateEdit(handle, { type: 'shift', dx: 0, dy: 0, indices: [0] });
  assert.deepEqual(editor.activeLayer.cells, baseline);
  const count = project.snapshot.past.length;
  assert.equal(editor.finishEdit(handle).status, 'unchanged');
  assert.equal(project.snapshot.past.length, count);
});

test('repeated and clamped move previews preserve revisions without comparing the entire layer', (context) => {
  const { editor, project } = editing();
  editor.createDocument(180, 180);
  colorCells(editor, [0]);
  const handle = editor.beginEdit();
  const operations = require('../src/services/domain/editing.ts');
  const comparisons = context.mock.method(operations, 'sameCells');
  const move = (dx) => editor.updateEdit(handle, { type: 'shift', dx, dy: 0, indices: [0] });
  assert.equal(move(1).status, 'applied');
  let revision = editor.revision;
  assert.equal(move(1).status, 'unchanged');
  assert.equal(editor.revision, revision);
  assert.equal(move(999).status, 'applied');
  assert.equal(project.activeLayer.cells[179], 'mard-h7');
  revision = editor.revision;
  assert.equal(move(1000).status, 'unchanged');
  assert.equal(editor.revision, revision);
  assert.equal(move(0).status, 'applied');
  assert.equal(project.activeLayer.cells[0], 'mard-h7');
  assert.equal(project.activeLayer.cells[179], null);
  revision = editor.revision;
  assert.equal(move(0).status, 'unchanged');
  assert.equal(editor.revision, revision);
  assert.equal(comparisons.mock.callCount(), 0);
  assert.equal(editor.finishEdit(handle).status, 'unchanged');
  assert.equal(comparisons.mock.callCount(), 1);
});

test('invalid commands and stale generated results do not change the project', () => {
  const { editor, project } = editing();
  const baseline = project.snapshot;
  for (const command of [
    { type: 'indices', indices: [-1], colorId: 'mard-h7' },
    { type: 'indices', indices: [0], colorId: 'unknown' },
    { type: 'fill', x: 8, y: 0, colorId: 'mard-h7' },
    { type: 'paint', input: { x: NaN, y: 0, gridX: 0, gridY: 0, value: null, brushSize: 0, brush: false } },
    { type: 'paste', x: 0, y: 0, pattern: { width: 0, height: 1, cells: [] } },
  ]) assert.deepEqual(editor.execute(command), { status: 'rejected', reason: 'invalid-input' });
  assert.strictEqual(project.snapshot, baseline);
  const generated = { width: 8, height: 8, cells: Array(64).fill('mard-h2'), colorsUsed: 1, totalBeads: 64 };
  const revision = editor.revision;
  colorCells(editor, [0]);
  assert.deepEqual(editor.applyGeneratedPattern(generated, editor.activeLayer.id, revision), { status: 'rejected', reason: 'stale-revision' });
  editor.updateLayer(editor.activeLayer.id, { locked: true });
  assert.deepEqual(editor.applyGeneratedPattern(generated, editor.activeLayer.id, editor.revision), { status: 'rejected', reason: 'locked' });
});

test('valid generation resizes all layers and is a single undoable command', () => {
  const { editor, project } = editing();
  colorCells(editor, [0]);
  const original = editor.activeLayer.id;
  editor.addLayer('target');
  const history = project.snapshot.past.length;
  const result = { width: 9, height: 9, cells: Array(81).fill('mard-h2'), colorsUsed: 1, totalBeads: 81 };
  assert.equal(editor.applyGeneratedPattern(result, editor.activeLayer.id, editor.revision).status, 'applied');
  assert.equal(project.snapshot.past.length, history + 1);
  assert.equal(editor.project.layers.find((layer) => layer.id === original).cells[0], 'mard-h7');
  editor.undo();
  assert.equal(editor.project.width, 8);
  assert.ok(editor.activeLayer.cells.every((cell) => cell === null));
});

test('history is limited to 40 entries and a new effective edit clears redo', () => {
  const { editor, project } = editing();
  for (let index = 0; index < 45; index += 1) colorCells(editor, [0], index % 2 ? 'mard-h2' : 'mard-h7');
  assert.equal(project.snapshot.past.length, 40);
  editor.undo();
  assert.equal(project.snapshot.future.length, 1);
  colorCells(editor, [1]);
  assert.equal(project.snapshot.future.length, 0);
  assert.deepEqual(editor.redo(), { status: 'rejected', reason: 'empty-history' });
});

test('legacy cells and nested project input validation preserve compatibility', async () => {
  const { editor, injector } = editing();
  const importer = injector.resolve(ImportService);
  const legacy = importer.importProjectText(JSON.stringify({ width: 8, height: 8, cells: ['mard-h7'] }));
  assert.equal(legacy.layers[0].cells[0], 'mard-h7');
  assert.equal(legacy.cells[0], 'mard-h7');
  const baseline = editor.project;
  for (const patch of [
    { layers: [null] }, { cells: [17] }, { settings: { beadsPerPack: 0 } },
    { settings: null }, { boardSettings: { boardWidth: 0 } },
    { layers: [{ id: 'base', cells: [], locked: 'yes' }] },
  ]) {
    await assert.rejects(injector.resolve(WorkspaceService).importRecord({
      text: async () => JSON.stringify({ width: 8, height: 8, cells: [], ...patch }),
    }));
    assert.strictEqual(editor.project, baseline);
  }
  const roundtrip = importer.importProjectText(JSON.stringify(legacy));
  assert.deepEqual(roundtrip.layers, legacy.layers);
});

test('new and imported documents are undoable and successful imports reset tool state', async () => {
  const { editor, injector } = editing();
  colorCells(editor, [0]);
  const workspace = injector.resolve(WorkspaceService);
  const tools = injector.resolve(ToolService);
  workspace.startBlank(9, 9);
  assert.equal(editor.project.width, 9);
  workspace.undo();
  assert.equal(editor.project.width, 8);
  assert.equal(editor.activeLayer.cells[0], 'mard-h7');
  tools.copyPattern({ width: 1, height: 1, cells: ['mard-h7'] });
  await workspace.importRecord({ text: async () => JSON.stringify(createProject(10, 10)) });
  assert.equal(editor.project.width, 10);
  assert.equal(tools.snapshot.clipboardPattern, null);
  workspace.undo();
  assert.equal(editor.project.width, 8);
});

test('image conversion rejects results if editing occurred during processing', async (context) => {
  const { editor, injector } = editing();
  const processing = require('../src/services/domain/image-processing/imageToBeads.ts');
  let finish;
  context.mock.method(processing, 'imageFileToBeads', () => new Promise((resolve) => { finish = resolve; }));
  context.mock.method(processing, 'createAlignedReferenceBlob', async () => new Blob(['reference']));
  const importer = injector.resolve(ImportService);
  const file = new Blob(['image'], { type: 'image/png' });
  file.name = 'pattern.png';
  importer.openImage(file);
  const pending = importer.generate(8, 8, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]);
  colorCells(editor, [0]);
  finish({ width: 8, height: 8, cells: Array(64).fill('mard-h2'), colorsUsed: 1, totalBeads: 64 });
  await pending;
  assert.equal(editor.activeLayer.cells[0], 'mard-h7');
  assert.equal(editor.activeLayer.cells[1], null);
  assert.equal(importer.snapshot.isGenerating, false);
});

test('newer image requests supersede older requests without overwriting their status', async (context) => {
  const { editor, injector, project } = editing();
  const processing = require('../src/services/domain/image-processing/imageToBeads.ts');
  const finishes = [];
  context.mock.method(processing, 'imageFileToBeads', () => new Promise((resolve) => { finishes.push(resolve); }));
  context.mock.method(processing, 'createAlignedReferenceBlob', async () => new Blob(['reference']));
  const importer = injector.resolve(ImportService);
  const file = new Blob(['image'], { type: 'image/png' });
  file.name = 'pattern.png';
  importer.openImage(file);
  const corners = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }];
  const history = project.snapshot.past.length;
  const first = importer.generate(8, 8, corners);
  const second = importer.generate(8, 8, corners);
  finishes[1]({ width: 8, height: 8, cells: Array(64).fill('mard-h2'), colorsUsed: 1, totalBeads: 64 });
  await second;
  finishes[0]({ width: 8, height: 8, cells: Array(64).fill('mard-h7'), colorsUsed: 1, totalBeads: 64 });
  await first;
  assert.ok(editor.activeLayer.cells.every((cell) => cell === 'mard-h2'));
  assert.equal(project.snapshot.past.length, history + 1);
  assert.equal(importer.snapshot.isGenerating, false);
});

test('canvas commands share the kernel, including shape, erase, fill, remove, paste and mirror', () => {
  const { editor, injector } = editing();
  const canvas = injector.resolve(CanvasEditService);
  canvas.beginGesture();
  canvas.paintCell({ x: 1, y: 1, gridX: 1.5, gridY: 1.5, value: 'mard-h7', brushSize: 0, brush: false });
  canvas.paintLine({
    from: { x: 1, y: 1, gridX: 1.5, gridY: 1.5 }, to: { x: 3, y: 1, gridX: 3.5, gridY: 1.5 },
    value: 'mard-h7', brushSize: 0, brush: false,
  });
  canvas.finishGesture();
  assert.deepEqual(editor.activeLayer.cells.slice(9, 12), Array(3).fill('mard-h7'));
  canvas.fill(1, 1, 'mard-h2');
  assert.deepEqual(editor.activeLayer.cells.slice(9, 12), Array(3).fill('mard-h2'));
  canvas.paintBrushLine({ x: 1.5, y: 1.5 }, { x: 2.5, y: 1.5 }, 1);
  assert.equal(editor.activeLayer.cells[9], null);
  canvas.paste({ width: 2, height: 1, cells: ['mard-h7', 'mard-h2'] }, 6, 7);
  assert.deepEqual(editor.activeLayer.cells.slice(62), ['mard-h7', 'mard-h2']);
  canvas.mirror('horizontal', [62, 63]);
  assert.deepEqual(editor.activeLayer.cells.slice(62), ['mard-h2', 'mard-h7']);
  canvas.remove(7, 7, 'all-same-color');
  assert.ok(!editor.activeLayer.cells.includes('mard-h7'));
  canvas.applyShape({
    kind: 'rectangle', fillMode: 'filled', arrowKind: 'single', start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
  }, 'mard-h7');
  assert.deepEqual([0, 1, 8, 9].map((index) => editor.activeLayer.cells[index]), Array(4).fill('mard-h7'));
  canvas.applyText([3, 4], 'mard-h2');
  assert.deepEqual(editor.activeLayer.cells.slice(3, 5), ['mard-h2', 'mard-h2']);
});

test('canvas pointer intents edit, copy, move, cancel and commit shape through the service', () => {
  const { editor, project, injector } = editing();
  const canvas = injector.resolve(CanvasEditService);
  const tools = injector.resolve(ToolService);
  const point = (x, y) => ({ cell: { x, y }, gridX: x + 0.5, gridY: y + 0.5 });
  tools.setTool('pencil');
  assert.equal(canvas.startPointer(point(0, 0), editor.project), 'draw');
  canvas.movePointer(point(2, 0));
  canvas.finishPointer();
  assert.ok(editor.activeLayer.cells.slice(0, 3).every(Boolean));
  assert.equal(project.snapshot.past.length, 2);
  tools.setTool('copy');
  tools.setCopyMode('selection');
  assert.equal(canvas.startPointer(point(0, 0), editor.project), 'copy');
  canvas.movePointer(point(2, 0));
  canvas.finishPointer();
  assert.deepEqual(tools.snapshot.copySelectionIndices, [0, 1, 2]);
  tools.setTool('move');
  assert.equal(canvas.startPointer(point(0, 0), editor.project), 'move');
  canvas.movePointer(point(0, 1));
  canvas.cancelGesture();
  assert.ok(editor.activeLayer.cells.slice(0, 3).every(Boolean));
  assert.ok(editor.activeLayer.cells.slice(8, 11).every((cell) => cell === null));
  tools.setTool('shape');
  assert.equal(canvas.startPointer(point(0, 1), editor.project), 'shape');
  assert.deepEqual(canvas.movePointer(point(2, 1)).end, { x: 2, y: 1 });
  canvas.finishPointer();
  assert.ok(editor.activeLayer.cells.slice(8, 11).every(Boolean));
  editor.undo();
  assert.ok(editor.activeLayer.cells.slice(8, 11).every((cell) => cell === null));
});

test('query reuses project-derived data for palette and view changes and invalidates after edits', () => {
  const { editor, injector } = editing();
  const query = injector.resolve(EditorQueryService);
  const palette = injector.resolve(require('../src/services/palette-service.ts').PaletteService);
  const view = injector.resolve(require('../src/services/workspace-view-service.ts').WorkspaceViewService);
  colorCells(editor, [0]);
  const initial = query.snapshot;
  palette.selectColor('mard-h2');
  assert.strictEqual(query.snapshot.usage, initial.usage);
  assert.strictEqual(query.snapshot.displayProject, initial.displayProject);
  view.setShowIsolatedBeads(true);
  const highlighted = query.snapshot.highlightedCellIndices;
  assert.deepEqual(highlighted, [0]);
  view.highlightColor('mard-h7');
  assert.strictEqual(query.snapshot.highlightedCellIndices, highlighted);
  editor.updateSettings({ showGrid: false });
  assert.strictEqual(query.snapshot.usage, initial.usage);
  assert.strictEqual(query.snapshot.highlightedCellIndices, highlighted);
  editor.updateSettings({ beadsPerPack: 100 });
  assert.notStrictEqual(query.snapshot.usage, initial.usage);
  assert.strictEqual(query.snapshot.highlightedCellIndices, highlighted);
  const beforeEdit = query.snapshot.usage;
  colorCells(editor, [1]);
  assert.notStrictEqual(query.snapshot.usage, beforeEdit);
  assert.deepEqual(query.snapshot.highlightedCellIndices, []);
});

test('client entry disables SSR and singleton construction restores the draft before edits', () => {
  const entry = fs.readFileSync(path.join(root, 'src/app/client-entry.tsx'), 'utf8');
  assert.match(entry, /ssr:\s*false/);
  const browser = browserStorage();
  const draft = createProject(8, 8);
  browser.values.set(autosaveKey, JSON.stringify(draft));
  const injector = services();
  const editor = injector.resolve(EditorService);
  assert.equal(editor.project.width, 8);
  colorCells(editor, [0]);
  injector.unbind();
  injector.bind('en');
  assert.equal(editor.activeLayer.cells[0], 'mard-h7');
});

test('large-grid edits preserve untouched layer arrays and revision stays out of exported data', () => {
  const { editor } = editing();
  editor.createDocument(180, 180);
  colorCells(editor, [0]);
  const base = editor.activeLayer;
  editor.addLayer('overlay');
  colorCells(editor, [32399], 'mard-h2');
  assert.strictEqual(editor.project.layers[0], base);
  assert.strictEqual(editor.project.layers[0].cells, base.cells);
  assert.equal(editor.activeLayer.cells.length, 32400);
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(editor.project)), 'revision'), false);
});

test('service dependency graph is acyclic, root binding follows dependencies and writes stay in the kernel', (context) => {
  const directory = path.join(root, 'src/services');
  const graph = new Map();
  const types = [];
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('-service.ts'))) {
    const source = fs.readFileSync(path.join(directory, filename), 'utf8');
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    const declaration = ast.statements.find(ts.isClassDeclaration);
    const name = declaration.name.text;
    types.push(require(path.join(directory, filename))[name]);
    const constructor = declaration.members.find(ts.isConstructorDeclaration);
    const dependencies = (constructor?.parameters ?? []).map((parameter) => parameter.type?.getText(ast)).filter(Boolean);
    graph.set(name, dependencies);
    assert.ok(ts.getDecorators(declaration)?.some((decorator) => decorator.expression.getText(ast) === 'singleton()'), name);
    assert.ok(!source.includes('new Injector') && !source.includes('Injector.resolve'), filename);
    if (name !== 'EditorService' && name !== 'ProjectService') {
      const projectParameters = new Set((constructor?.parameters ?? [])
        .filter((parameter) => parameter.type?.getText(ast) === 'ProjectService')
        .map((parameter) => parameter.name.getText(ast)));
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const receiver = node.expression.expression;
          if (ts.isPropertyAccessExpression(receiver) && receiver.expression.kind === ts.SyntaxKind.ThisKeyword
            && projectParameters.has(receiver.name.text)) {
            assert.ok(!['publish', 'recordHistory', 'undo', 'redo'].includes(node.expression.name.text), filename);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  const registered = require('../src/services/service-modules.ts').serviceModules.flat();
  assert.equal(new Set(registered).size, registered.length, 'duplicate service registration');
  assert.deepEqual(new Set(registered), new Set(types), 'all singleton services must be registered');
  const complete = new Set();
  function visit(name, stack = []) {
    assert.ok(!stack.includes(name), [...stack, name].join(' -> '));
    if (complete.has(name)) return;
    for (const dependency of graph.get(name) ?? []) if (graph.has(dependency)) visit(dependency, [...stack, name]);
    complete.add(name);
  }
  for (const name of graph.keys()) visit(name);
  const injector = services();
  injector.unbind();
  const bound = [];
  const unbound = [];
  for (const type of types) {
    const service = injector.resolve(type);
    const bind = service.onBind;
    const unbind = service.onUnbind;
    context.mock.method(service, 'onBind', function () {
      bound.push(type.name);
      return bind.call(this);
    });
    context.mock.method(service, 'onUnbind', function () {
      unbound.push(type.name);
      return unbind.call(this);
    });
  }
  injector.bind('zh');
  injector.bind('zh');
  assert.equal(bound.length, types.length);
  for (const [name, dependencies] of graph) {
    for (const dependency of dependencies) {
      if (graph.has(dependency)) assert.ok(bound.indexOf(dependency) < bound.indexOf(name), `${dependency} before ${name}`);
    }
  }
  injector.unbind();
  injector.unbind();
  assert.deepEqual(unbound, [...bound].reverse());
});
