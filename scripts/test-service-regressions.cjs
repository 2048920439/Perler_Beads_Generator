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
    },
  });
  module._compile(outputText, filename);
}
require.extensions['.ts'] = compileService;
require.extensions['.tsx'] = compileService;

const { createServiceScope } = require('../src/service-core/service-injector.ts');
const { ProjectService } = require('../src/services/project-service.ts');
const { LayerService } = require('../src/services/layer-service.ts');
const { ImageImportService } = require('../src/services/image-import-service.ts');
const { CanvasEditService } = require('../src/services/canvas-edit-service.ts');
const { NoticeService } = require('../src/services/notice-service.ts');
const { ToolService } = require('../src/services/tool-service.ts');
const { autosaveKey, createProject, withLayers } = require('../src/services/domain/project.ts');

const globalNames = ['window', 'document', 'localStorage'];
const originalGlobals = new Map(globalNames.map((name) => [
  name, Object.getOwnPropertyDescriptor(globalThis, name),
]));
const activeServices = [];

afterEach(() => {
  activeServices.splice(0).reverse().forEach((service) => service.deactivate());
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

function projectService() {
  const service = new ProjectService();
  activeServices.push(service);
  service.activate();
  return service;
}

function drawCell(service, index, colorId) {
  const cells = service.activeLayer.cells.slice();
  cells[index] = colorId;
  service.updateCells(cells);
}

function soloProject() {
  const scope = createServiceScope();
  activeServices.push(scope);
  scope.activate();
  const project = scope.injector.resolve(ProjectService);
  const layers = scope.injector.resolve(LayerService);
  const images = scope.injector.resolve(ImageImportService);
  const initial = createProject(8, 8);
  const base = initial.layers[0];
  project.replace(withLayers(initial, [
    { ...base, cells: Array(64).fill('mard-h7') },
    { ...base, id: 'overlay', name: 'Overlay', visible: false, cells: Array(64).fill('mard-h2') },
  ]));
  layers.toggleActiveLayerOnly();
  return { project, layers, images };
}

function copySelectionServices() {
  const scope = createServiceScope();
  activeServices.push(scope);
  scope.activate();
  const project = scope.injector.resolve(ProjectService);
  project.replace(createProject(8, 8));
  const cells = Array(64).fill(null);
  cells.fill('mard-h7', 0, 4);
  project.updateCells(cells);
  const tools = scope.injector.resolve(ToolService);
  tools.setTool('copy');
  tools.setCopyMode('selection');
  return {
    project,
    tools,
    canvas: scope.injector.resolve(CanvasEditService),
    notice: scope.injector.resolve(NoticeService),
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

test('deactivation saves edits, removes listeners and cancels the timer', async () => {
  const browser = browserStorage();
  const project = projectService();
  project.activate();
  drawCell(project, 0, 'mard-h7');
  project.deactivate();
  project.deactivate();
  assert.equal(browser.savedProject().cells[0], 'mard-h7');
  assert.equal(browser.writes.length, 1);

  drawCell(project, 1, 'mard-h2');
  browser.window.dispatchEvent(new Event('pagehide'));
  browser.document.visibilityState = 'hidden';
  browser.document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(browser.writes.length, 1);
  assert.equal(browser.savedProject().cells[1], null);

  project.activate();
  project.activate();
  browser.window.dispatchEvent(new Event('pagehide'));
  assert.equal(browser.writes.length, 2);
  assert.equal(browser.savedProject().cells[1], 'mard-h2');
});

test('unavailable storage does not break editing or deactivation', () => {
  const browser = browserStorage();
  const project = projectService();
  localStorage.setItem = () => { throw new Error('Storage is unavailable.'); };
  assert.doesNotThrow(() => {
    drawCell(project, 0, 'mard-h7');
    browser.window.dispatchEvent(new Event('pagehide'));
    browser.document.visibilityState = 'hidden';
    browser.document.dispatchEvent(new Event('visibilitychange'));
    project.deactivate();
  });
  assert.equal(project.activeLayer.cells[0], 'mard-h7');
});

test('importing the same project clears the previous solo visibility snapshot', async () => {
  const { project, layers, images } = soloProject();
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

  project.undo();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
  project.redo();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [false, true]);
});

test('invalid imports preserve the current solo visibility snapshot', async () => {
  const { project, layers, images } = soloProject();
  layers.selectLayer('overlay');
  const previous = project.snapshot.project;
  await assert.rejects(images.importRecord({ text: async () => '{"invalid":true}' }));
  assert.equal(project.snapshot.project, previous);
  layers.toggleActiveLayerOnly();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
});

test('cancelled imports preserve the current solo visibility snapshot', async () => {
  const { project, layers, images } = soloProject();
  layers.selectLayer('overlay');
  const previous = project.snapshot.project;
  let finishReading;
  const pending = images.importRecord({
    text: () => new Promise((resolve) => { finishReading = resolve; }),
  });
  images.reset();
  finishReading(JSON.stringify(createProject(9, 9)));
  await pending;
  assert.equal(project.snapshot.project, previous);
  layers.toggleActiveLayerOnly();
  assert.deepEqual(project.snapshot.project.layers.map((layer) => layer.visible), [true, false]);
});
