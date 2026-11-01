const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function compileTypeScript(module, filename) {
  const originalRequire = module.require.bind(module);
  module.require = (specifier) => originalRequire(
    specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : specifier,
  );
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      useDefineForClassFields: true,
    },
  });
  module._compile(outputText, filename);
}

require.extensions['.ts'] = compileTypeScript;
const operations = require('../src/services/domain/workspace/cell-operations.ts');

test('paint operations preserve dimensions and brush coverage', () => {
  const empty = Array(16).fill(null);
  const painted = operations.paintCell(empty, 4, 4, 1, 1, 'red', 0.5, 1.5, 1.5, false);
  assert.equal(painted[5], 'red');
  assert.equal(empty[5], null);

  const brushed = operations.paintBrushLine(empty, 4, 4, { x: 1.5, y: 1.5 }, { x: 2.5, y: 1.5 }, 1);
  assert.equal(brushed.length, 16);
  assert.ok(brushed.some((cell) => cell === null));
});

test('fill, mirror, move, and paste stay bounded', () => {
  const cells = Array(9).fill(null);
  cells[0] = 'a';
  cells[1] = 'a';
  const filled = operations.floodFill(cells, 3, 3, 0, 0, 'b');
  assert.equal(filled[0], 'b');
  assert.equal(filled[1], 'b');

  const mirrored = operations.mirrorCells(filled, 3, 3, 'horizontal');
  assert.equal(mirrored[1], 'b');
  assert.equal(mirrored[0], 'b');

  const shifted = operations.shiftCells(mirrored, 3, 3, 1, 0);
  assert.equal(shifted.length, 9);
  assert.equal(shifted[0], null);

  const pattern = operations.createClipboardPattern(shifted, 3, [1, 2]);
  const pasted = operations.pasteClipboardPattern(Array(9).fill(null), 3, 3, pattern, 2, 2);
  assert.equal(pasted.length, 9);
  assert.ok(pasted.some(Boolean));
});
