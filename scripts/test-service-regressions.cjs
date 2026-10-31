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
const { autosaveKey, createProject, withLayers } = require('../src/core/project.ts');

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
