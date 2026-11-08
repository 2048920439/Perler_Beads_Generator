const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const options = {
  moduleResolution: ts.ModuleResolutionKind.Node10,
  baseUrl: root,
  paths: { '@/*': ['src/*'] },
};

function normalize(filename) {
  return path.normalize(filename);
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(filename) ? [normalize(filename)] : [];
  });
}

function checkArchitecture(files, readSource = (filename) => fs.readFileSync(filename, 'utf8')) {
  const graph = new Map(files.map((filename) => [filename, []]));
  for (const filename of files) {
    const source = readSource(filename);
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      const resolvedFile = ts.resolveModuleName(specifier, filename, options, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolvedFile) continue;
      const resolved = normalize(resolvedFile);
      if (!graph.has(resolved)) continue;
      graph.get(filename).push(resolved);
      if (/[/\\](components|presentation|app)[/\\]/.test(filename)) {
        assert.notEqual(resolved, path.join(sourceRoot, 'services/project-service.ts'), filename);
      }
    }
  }
  const complete = new Set();
  function visit(filename, stack) {
    assert.ok(!stack.includes(filename), [...stack, filename].map((item) => path.relative(root, item)).join(' -> '));
    if (complete.has(filename)) return;
    for (const dependency of graph.get(filename)) visit(dependency, [...stack, filename]);
    complete.add(filename);
  }
  for (const filename of files) visit(filename, []);
}

test('source module imports are acyclic and UI cannot import the project store', () => {
  checkArchitecture(sourceFiles(sourceRoot));
});

test('architecture check rejects UI project store imports and module cycles', () => {
  const files = sourceFiles(sourceRoot);
  const ui = normalize(path.join(sourceRoot, 'presentation/App.tsx'));
  const project = normalize(path.join(sourceRoot, 'services/project-service.ts'));
  const editor = normalize(path.join(sourceRoot, 'services/editor-service.ts'));
  const original = (filename) => fs.readFileSync(filename, 'utf8');
  assert.throws(() => checkArchitecture(files, (filename) =>
    original(filename) + (filename === ui ? "\nimport '@/services/project-service';" : '')),
  /App\.tsx/);
  assert.throws(() => checkArchitecture(files, (filename) =>
    original(filename) + (filename === project ? "\nimport './editor-service';" : '')),
  (error) => error.message.includes('project-service.ts') && error.message.includes('editor-service.ts'));
  assert.ok(files.includes(editor));
});
