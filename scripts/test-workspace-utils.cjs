const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function compileTypeScript(module, filename) {
  const originalRequire = module.require.bind(module);
  module.require = (specifier) => originalRequire(
    specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : specifier,
  );
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
}
require.extensions['.ts'] = compileTypeScript;

const { almostSamePoint, linePoints, uniqueInBounds } = require('../src/components/editor/Utils/grid-geometry.ts');
const { collectShapeIndices } = require('../src/components/editor/Utils/shape-rasterizer.ts');
const { collectTextIndices } = require('../src/components/editor/Utils/text-rasterizer.ts');
const { drawPattern } = require('../src/components/editor/Utils/canvas-renderer.ts');
const { drawCellBoundarySet } = require('../src/components/editor/Utils/selection-renderer.ts');
const { createProject } = require('../src/services/domain/project.ts');

const originalGlobals = new Map(['window', 'document'].map((name) => [
  name, Object.getOwnPropertyDescriptor(globalThis, name),
]));
afterEach(() => {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

// Deterministic glyph pixels verify layout and cache behavior, not browser fonts.
function installGlyphCanvas() {
  let canvases = 0;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        canvases += 1;
        const canvas = { width: 0, height: 0 };
        canvas.getContext = () => ({
          measureText: () => ({ width: 10 }),
          clearRect() {},
          fillText() {},
          getImageData() {
            const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
            for (let y = 15; y < 20; y += 1) {
              for (let x = 15; x < 25; x += 1) data[(y * canvas.width + x) * 4 + 3] = 255;
            }
            return { data };
          },
        });
        return canvas;
      },
    },
  });
  return () => canvases;
}

function recordingContext() {
  const calls = [];
  const context = new Proxy({ canvas: { width: 480, height: 320 } }, {
    get(target, property) {
      return property in target ? target[property] : (...args) => calls.push([property, ...args]);
    },
    set(target, property, value) {
      calls.push(['set', property, value]);
      target[property] = value;
      return true;
    },
  });
  return { context, calls };
}

function patternArguments(context, tool, variant = 0) {
  const project = createProject(6, 5);
  project.layers[0].cells = Array.from({ length: 30 }, (_, index) => index % 3 === 0 ? 'a' : index % 4 === 0 ? 'b' : null);
  project.layers.push({
    ...project.layers[0], id: 'overlay', opacity: 0.6,
    cells: Array.from({ length: 30 }, (_, index) => index % 5 === 0 ? 'b' : null),
  });
  project.settings.showLayerOverlap = true;
  project.settings.showColorCodes = true;
  project.settings.beadDisplayMode = variant % 2 === 0 ? 'bead' : 'pixel';
  const colors = {
    a: { id: 'a', hex: '#ff0000', rgb: [255, 0, 0], primaryCode: 'A' },
    b: { id: 'b', hex: '#ffffff', rgb: [255, 255, 255], primaryCode: 'B' },
  };
  const draft = variant === 3 ? {
    kind: 'ellipse', fillMode: 'outline', arrowKind: 'single',
    start: { x: 0, y: 0 }, end: { x: 5, y: 4 },
  } : null;
  return [
    context, project, 18, 1, { x: 12, y: 16 }, variant === 1 ? 'a' : null, [0],
    tool, 'b', 2, variant % 2 === 0 ? 'layer' : 'partial',
    ['same-connected', 'all-same-color', 'connected'][variant % 3],
    variant % 2 === 0 ? 'partial' : 'layer',
    { width: 2, height: 2, cells: ['a', null, 'b', 'a'] },
    variant % 2 === 0 ? 'connected' : 'selection', [0, 3], draft,
    { cell: variant === 4 ? null : { x: 0, y: 0 }, gridX: 0.5, gridY: 0.5 },
    variant !== 5,
    {
      visible: variant >= 2, placement: variant % 2 === 0 ? 'below' : 'above',
      image: { naturalWidth: 80, naturalHeight: 40 }, opacity: 0.5, scale: 1.2, offset: { x: 1, y: -1 },
    },
    'AB', 'horizontal', 5, 1, (colorId) => colors[colorId], (colorId) => `code-${colorId}`,
  ];
}

test('grid helpers preserve line rounding, clipping, order, and pan tolerance', () => {
  assert.deepEqual(linePoints(0, 0, 2, 1), [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
  assert.deepEqual(linePoints(1, 1, 1, 1), [{ x: 1, y: 1 }, { x: 1, y: 1 }]);
  assert.deepEqual(uniqueInBounds([{ x: 2, y: 1 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 0 }], 3, 2), [5, 0]);
  assert.equal(almostSamePoint({ x: 0, y: 0 }, { x: 0.49, y: -0.49 }), true);
  assert.equal(almostSamePoint({ x: 0, y: 0 }, { x: 0.5, y: 0 }), false);
});

test('shape rasterizers preserve rectangle fills, square constraints, and clipping', () => {
  const indices = (kind, mode, start, end) => collectShapeIndices(kind, mode, 'single', start, end, 5, 5);
  assert.deepEqual(indices('rectangle', 'filled', { x: 1, y: 1 }, { x: 3, y: 3 }), [6, 7, 8, 11, 12, 13, 16, 17, 18]);
  assert.equal(indices('rectangle', 'outline', { x: 1, y: 1 }, { x: 3, y: 3 }).includes(12), false);
  assert.deepEqual(indices('square', 'filled', { x: 0, y: 0 }, { x: 4, y: 1 }), [0, 1, 5, 6]);
  assert.deepEqual(indices('line', 'outline', { x: -2, y: 0 }, { x: 2, y: 0 }), [0, 1, 2]);
});

test('all shape, fill, and arrow variants return unique in-bounds cell indices', () => {
  for (const kind of ['line', 'rectangle', 'square', 'ellipse', 'circle', 'triangle', 'arrow']) {
    for (const mode of ['outline', 'filled']) {
      for (const arrow of ['single', 'double', 'block']) {
        for (const [start, end] of [
          [{ x: 1, y: 1 }, { x: 9, y: 7 }],
          [{ x: 9, y: 7 }, { x: 1, y: 1 }],
          [{ x: -3, y: -2 }, { x: 4, y: 3 }],
          [{ x: 3, y: 3 }, { x: 3, y: 3 }],
        ]) {
          const indices = collectShapeIndices(kind, mode, arrow, start, end, 10, 8);
          assert.ok(indices.length > 0, `${kind}/${mode}/${arrow}`);
          assert.equal(new Set(indices).size, indices.length);
          assert.ok(indices.every((index) => Number.isInteger(index) && index >= 0 && index < 80));
        }
      }
    }
  }
});

test('text layout preserves directions, spacing, newlines, fallback, clipping, and caches', () => {
  const canvasCount = installGlyphCanvas();
  assert.deepEqual(collectTextIndices('AB', 'horizontal', 5, 1, 2, 3, 12, 20), [38, 39, 41, 42]);
  assert.deepEqual(collectTextIndices('AB', 'vertical', 5, 1, 2, 3, 12, 20), [38, 39, 62, 63]);
  assert.deepEqual(collectTextIndices('A\nB', 'horizontal', 5, 1, 2, 3, 12, 20), [38, 39, 134, 135]);
  assert.deepEqual(collectTextIndices('A B', 'horizontal', 5, 1, 0, 0, 12, 20), [0, 1, 6, 7]);
  assert.deepEqual(collectTextIndices('', 'horizontal', 5, 1, 0, 0, 12, 20), [0, 1, 3, 4, 6, 7]);
  assert.deepEqual(collectTextIndices('AB', 'horizontal', 5, 1, 11, 0, 12, 20), [11]);
  const count = canvasCount();
  const result = collectTextIndices('AB', 'horizontal', 5, 1, 0, 0, 12, 20);
  result.fill(-1);
  assert.deepEqual(collectTextIndices('AB', 'horizontal', 5, 1, 0, 0, 12, 20), [0, 1, 3, 4]);
  assert.equal(canvasCount(), count);
});

test('selection boundaries omit shared cell edges and restore drawing state', () => {
  const { context, calls } = recordingContext();
  drawCellBoundarySet(context, [0, 1], 4, 18);
  assert.equal(calls.filter(([operation]) => operation === 'lineTo').length, 12);
  assert.deepEqual(calls.at(-1), ['restore']);
  assert.equal(calls.filter(([operation]) => operation === 'save').length, 1);
});

test('canvas rendering handles every tool, reference placement, display mode, and locked state', () => {
  installGlyphCanvas();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { devicePixelRatio: 2 } });
  const tools = ['pencil', 'eraser', 'fill', 'remove', 'recolor', 'eyedropper', 'move', 'copy', 'paste', 'mirror', 'shape', 'text', 'pan'];
  for (const tool of tools) {
    for (let variant = 0; variant < 6; variant += 1) {
      const { context, calls } = recordingContext();
      const args = patternArguments(context, tool, variant);
      const before = JSON.stringify(args[1]);
      drawPattern(...args);
      assert.deepEqual(calls[0], ['clearRect', 0, 0, 240, 160]);
      assert.deepEqual(calls.at(-1), ['restore']);
      assert.equal(calls.filter(([operation]) => operation === 'save').length, calls.filter(([operation]) => operation === 'restore').length);
      assert.equal(JSON.stringify(args[1]), before, `${tool}/${variant} mutated the project`);
      if (variant >= 2) {
        const imageIndex = calls.findIndex(([operation]) => operation === 'drawImage');
        const beadIndex = calls.findIndex(([operation]) => operation === (variant % 2 === 0 ? 'arc' : 'fillText'));
        assert.ok(imageIndex > 0);
        assert.equal(imageIndex < beadIndex, variant % 2 === 0, `${tool}/${variant} reference placement`);
      }
    }
  }
});
