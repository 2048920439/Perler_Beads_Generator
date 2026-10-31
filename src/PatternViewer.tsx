'use client';

import * as React from 'react';
import Link from 'next/link';
import PatternViewerCanvas from './PatternViewerCanvas';
import { getColor } from './palette';
import { parseProjectJson } from './project';
import type { BeadProject } from './types';

type Language = 'zh' | 'en';

const languageKey = 'perler-beads-generator:language';
const viewerCacheKey = 'perler-beads-generator:viewer-project';
const viewerStateCacheKey = 'perler-beads-generator:viewer-state';

const copy = {
  zh: {
    title: '拼豆图纸查看器',
    subtitle: '只读查看',
    importTitle: '导入 JSON 图纸',
    importHint: '选择或拖放编辑器导出的 JSON 文件',
    chooseFile: '选择 JSON 文件',
    noProject: '尚未导入图纸',
    colors: '图纸色卡',
    colorsCount: (count: number) => `${count} 种颜色`,
    view: '视图',
    beadShape: '拼豆形状',
    roundBeads: '圆形',
    squareBeads: '方形',
    grid: '网格',
    coordinates: '坐标',
    showColorCodes: '显示色号',
    layerOverlap: '重叠图层',
    cell: '单元格',
    hoverBoard: '移动到画布查看单元格',
    empty: '空',
    selectAll: '全选',
    clearAll: '取消全选',
    horizontal: '左右翻转',
    vertical: '上下翻转',
    fit: '适配',
    editor: '返回编辑器',
    error: '导入失败',
    emptyColors: '图纸中没有可显示的颜色',
    readOnly: '只读模式',
    beads: (count: number) => `${count} 颗`,
    dimensions: (width: number, height: number) => `${width} × ${height}`,
  },
  en: {
    title: 'Perler Pattern Viewer',
    subtitle: 'Read-only view',
    importTitle: 'Import JSON pattern',
    importHint: 'Choose or drop a JSON file exported from the editor',
    chooseFile: 'Choose JSON file',
    noProject: 'No pattern imported',
    colors: 'Pattern colors',
    colorsCount: (count: number) => `${count} colors`,
    view: 'View',
    beadShape: 'Bead shape',
    roundBeads: 'Round',
    squareBeads: 'Square',
    grid: 'Grid',
    coordinates: 'Coordinates',
    showColorCodes: 'Color codes',
    layerOverlap: 'Layer overlap',
    cell: 'Cell',
    hoverBoard: 'Move over the canvas to inspect a cell',
    empty: 'empty',
    selectAll: 'Select all',
    clearAll: 'Clear all',
    horizontal: 'Flip left / right',
    vertical: 'Flip top / bottom',
    fit: 'Fit',
    editor: 'Back to editor',
    error: 'Import failed',
    emptyColors: 'No visible colors in this pattern',
    readOnly: 'Read-only',
    beads: (count: number) => `${count} beads`,
    dimensions: (width: number, height: number) => `${width} × ${height}`,
  },
} as const;

type ColorRow = {
  id: string;
  count: number;
  hex: string;
  code: string;
  name: string;
};

type ViewerSettings = {
  beadDisplayMode: 'bead' | 'pixel';
  showGrid: boolean;
  showCoordinates: boolean;
  showColorCodes: boolean;
  showLayerOverlap: boolean;
};

type ViewerCacheState = {
  highlightedColorIds: string[];
  flipHorizontal: boolean;
  flipVertical: boolean;
  viewerSettings: ViewerSettings;
};

type HoverCell = {
  x: number;
  y: number;
  colorId: string | null;
};

export default function PatternViewer() {
  const [language, setLanguage] = React.useState<Language>('zh');
  const [project, setProject] = React.useState<BeadProject | null>(null);
  const [highlightedColorIds, setHighlightedColorIds] = React.useState<Set<string>>(new Set());
  const [flipHorizontal, setFlipHorizontal] = React.useState(false);
  const [flipVertical, setFlipVertical] = React.useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const [mobileColorDrawerOpen, setMobileColorDrawerOpen] = React.useState(false);
  const [mobileColorsOverflow, setMobileColorsOverflow] = React.useState(false);
  const [viewerSettings, setViewerSettings] = React.useState<ViewerSettings>({
    beadDisplayMode: 'bead',
    showGrid: true,
    showCoordinates: true,
    showColorCodes: false,
    showLayerOverlap: false,
  });
  const [hoverCell, setHoverCell] = React.useState<HoverCell | null>(null);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const mobileColorRowRef = React.useRef<HTMLDivElement | null>(null);
  const text = copy[language];

  function viewerSettingsForProject(nextProject: BeadProject, saved?: Partial<ViewerSettings>): ViewerSettings {
    return {
      beadDisplayMode:
        saved?.beadDisplayMode === 'pixel'
          ? 'pixel'
          : saved?.beadDisplayMode === 'bead'
            ? 'bead'
            : nextProject.settings.beadDisplayMode === 'pixel'
              ? 'pixel'
              : 'bead',
      showGrid: typeof saved?.showGrid === 'boolean' ? saved.showGrid : nextProject.settings.showGrid,
      showCoordinates: typeof saved?.showCoordinates === 'boolean' ? saved.showCoordinates : nextProject.settings.showCoordinates,
      showColorCodes: typeof saved?.showColorCodes === 'boolean' ? saved.showColorCodes : nextProject.settings.showColorCodes,
      showLayerOverlap: typeof saved?.showLayerOverlap === 'boolean' ? saved.showLayerOverlap : nextProject.settings.showLayerOverlap,
    };
  }

  function applyProject(nextProject: BeadProject, cached?: Partial<ViewerCacheState>) {
    const visibleColorIds = [...new Set(nextProject.cells.filter((id): id is string => Boolean(id) && Boolean(getColor(id))))];
    const visibleColorIdSet = new Set(visibleColorIds);
    const selectedColorIds = Array.isArray(cached?.highlightedColorIds)
      ? cached.highlightedColorIds.filter((id) => visibleColorIdSet.has(id))
      : visibleColorIds;

    setProject(nextProject);
    setHighlightedColorIds(new Set(selectedColorIds));
    setViewerSettings(viewerSettingsForProject(nextProject, cached?.viewerSettings));
    setHoverCell(null);
    setFlipHorizontal(Boolean(cached?.flipHorizontal));
    setFlipVertical(Boolean(cached?.flipVertical));
    setMobileColorDrawerOpen(false);
    setError('');
  }

  React.useEffect(() => {
    const stored = window.localStorage.getItem(languageKey);
    if (stored === 'en' || stored === 'zh') setLanguage(stored);
  }, []);

  React.useEffect(() => {
    const storedProject = window.localStorage.getItem(viewerCacheKey);
    if (!storedProject) return;

    try {
      const parsedProject = JSON.parse(storedProject) as unknown;
      const isLegacyEnvelope = Boolean(parsedProject && typeof parsedProject === 'object' && 'project' in parsedProject);
      const legacyCache = isLegacyEnvelope ? (parsedProject as { project?: unknown } & Partial<ViewerCacheState>) : undefined;
      const projectSource = isLegacyEnvelope ? legacyCache?.project : parsedProject;
      if (!projectSource) throw new Error('Cached viewer project is empty.');

      const storedState = window.localStorage.getItem(viewerStateCacheKey);
      const parsedState = storedState ? (JSON.parse(storedState) as Partial<ViewerCacheState>) : undefined;
      const state = parsedState ?? legacyCache;
      applyProject(parseProjectJson(JSON.stringify(projectSource)), state);
    } catch {
      window.localStorage.removeItem(viewerCacheKey);
      window.localStorage.removeItem(viewerStateCacheKey);
    }
  }, []);

  React.useEffect(() => {
    if (!project) return;
    try {
      window.localStorage.setItem(viewerCacheKey, JSON.stringify(project));
    } catch {
      // Ignore storage quota and privacy-mode failures; the viewer remains usable.
    }
  }, [project]);

  React.useEffect(() => {
    if (!project) return;
    const state: ViewerCacheState = {
      highlightedColorIds: [...highlightedColorIds],
      flipHorizontal,
      flipVertical,
      viewerSettings,
    };
    try {
      window.localStorage.setItem(viewerStateCacheKey, JSON.stringify(state));
    } catch {
      // Ignore storage quota and privacy-mode failures; the viewer remains usable.
    }
  }, [project, highlightedColorIds, flipHorizontal, flipVertical, viewerSettings]);

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  React.useEffect(() => {
    if (!mobilePanelOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobilePanelOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobilePanelOpen]);

  React.useEffect(() => {
    if (!mobilePanelOpen || window.innerWidth > 980) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobilePanelOpen]);

  const colors = React.useMemo<ColorRow[]>(() => {
    if (!project) return [];
    const counts = new Map<string, number>();
    project.cells.forEach((colorId) => {
      if (colorId) counts.set(colorId, (counts.get(colorId) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([id, count]) => {
        const color = getColor(id);
        return color
          ? { id, count, hex: color.hex, code: color.primaryCode, name: color.name }
          : null;
      })
      .filter((row): row is ColorRow => Boolean(row))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [project]);

  React.useEffect(() => {
    const row = mobileColorRowRef.current;
    if (!row) return;
    const updateOverflow = () => {
      setMobileColorsOverflow(row.scrollWidth > row.clientWidth + 1);
    };
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(row);
    window.addEventListener('resize', updateOverflow);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [colors]);

  const beadCount = React.useMemo(() => project?.cells.filter(Boolean).length ?? 0, [project]);
  const allSelected = colors.length > 0 && colors.every((color) => highlightedColorIds.has(color.id));
  const noSelected = highlightedColorIds.size === 0;

  async function importFile(file: File) {
    try {
      const raw = await file.text();
      const nextProject = parseProjectJson(raw);
      applyProject(nextProject);
      setMobilePanelOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this JSON file.');
    }
  }

  function toggleColor(id: string) {
    setHighlightedColorIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setHighlightedColorIds(new Set(colors.map((color) => color.id)));
  }

  function clearAll() {
    setHighlightedColorIds(new Set());
  }

  function updateViewerSetting<Key extends keyof ViewerSettings>(key: Key, value: ViewerSettings[Key]) {
    setViewerSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="pattern-viewer-shell">
      <div className="pattern-viewer-mobile-header-stack">
        <header className="pattern-viewer-header">
          <div className="pattern-viewer-brand">
            <Link className="pattern-viewer-logo" href="/" aria-label={text.editor} title={text.editor}>
              <span />
              <span />
              <span />
              <span />
            </Link>
            <div>
              <strong>{text.title}</strong>
              <span>{text.subtitle}</span>
            </div>
          </div>
          <div className="pattern-viewer-header-actions">
            <button
              type="button"
              className="pattern-viewer-mobile-menu"
              aria-label={mobilePanelOpen ? 'Close pattern controls' : 'Open pattern controls'}
              aria-expanded={mobilePanelOpen}
              onClick={() => {
                setMobilePanelOpen((current) => !current);
                setMobileColorDrawerOpen(false);
              }}
            >
              <span aria-hidden="true">{mobilePanelOpen ? '×' : '☰'}</span>
            </button>
            <Link className="pattern-viewer-nav-link" href="/">{text.editor}</Link>
            <button
              type="button"
              className="pattern-viewer-language"
              onClick={() => {
                const next = language === 'zh' ? 'en' : 'zh';
                setLanguage(next);
                window.localStorage.setItem(languageKey, next);
              }}
            >
              {language === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </header>

        <div className="pattern-viewer-mobile-color-bar" role="region" aria-label={text.colors}>
          <div className="pattern-viewer-mobile-color-actions">
            <button type="button" onClick={selectAll} disabled={!project || colors.length === 0 || allSelected} title={text.selectAll}>✓</button>
            <button type="button" onClick={clearAll} disabled={!project || colors.length === 0 || noSelected} title={text.clearAll}>×</button>
          </div>
          <div className="pattern-viewer-mobile-color-row" ref={mobileColorRowRef}>
            {colors.map((color) => {
              const active = highlightedColorIds.has(color.id);
              return (
                <button
                  key={color.id}
                  type="button"
                  className={active ? 'pattern-viewer-mobile-color-chip active' : 'pattern-viewer-mobile-color-chip'}
                  aria-pressed={active}
                  title={`${color.code} · ${color.name}`}
                  onClick={() => toggleColor(color.id)}
                >
                  <span style={{ backgroundColor: color.hex }} />
                  <small>{color.code}</small>
                </button>
              );
            })}
            {!project && <span className="pattern-viewer-mobile-color-placeholder">{text.noProject}</span>}
          </div>
          {mobileColorsOverflow && (
            <button
              type="button"
              className={mobileColorDrawerOpen ? 'pattern-viewer-mobile-color-more active' : 'pattern-viewer-mobile-color-more'}
              aria-expanded={mobileColorDrawerOpen}
              aria-label={mobileColorDrawerOpen ? text.clearAll : text.colors}
              onClick={() => setMobileColorDrawerOpen((current) => !current)}
            >
              <span aria-hidden="true">{mobileColorDrawerOpen ? '×' : '•••'}</span>
            </button>
          )}
          {mobileColorDrawerOpen && mobileColorsOverflow && (
            <>
              <button
                type="button"
                className="pattern-viewer-mobile-color-backdrop"
                aria-label="Close color drawer"
                onClick={() => setMobileColorDrawerOpen(false)}
              />
              <div className="pattern-viewer-mobile-color-drawer">
                <div className="pattern-viewer-mobile-color-drawer-header">
                  <strong>{text.colors}</strong>
                  <span>{text.colorsCount(colors.length)}</span>
                </div>
                <div className="pattern-viewer-mobile-color-drawer-actions">
                  <button type="button" onClick={selectAll} disabled={!project || colors.length === 0 || allSelected}>{text.selectAll}</button>
                  <button type="button" onClick={clearAll} disabled={!project || colors.length === 0 || noSelected}>{text.clearAll}</button>
                </div>
                <div className="pattern-viewer-mobile-color-drawer-grid">
                  {colors.map((color) => {
                    const active = highlightedColorIds.has(color.id);
                    return (
                      <button
                        key={color.id}
                        type="button"
                        className={active ? 'pattern-viewer-mobile-color-drawer-card active' : 'pattern-viewer-mobile-color-drawer-card'}
                        aria-pressed={active}
                        onClick={() => toggleColor(color.id)}
                      >
                        <span className="pattern-viewer-color-swatch" style={{ backgroundColor: color.hex }} />
                        <span>
                          <strong>{color.code}</strong>
                          <small>{color.name}</small>
                        </span>
                        <small>{text.beads(color.count)}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <section className="pattern-viewer-layout">
        <section className="pattern-viewer-stage-section">
          <div className="pattern-viewer-stage-header">
            <div>
              <strong>{project?.name || text.noProject}</strong>
              <span>
                {project
                  ? `${text.dimensions(project.width, project.height)} · ${text.beads(beadCount)}`
                  : text.importHint}
              </span>
            </div>
            <span className="pattern-viewer-readonly-pill">{text.readOnly}</span>
          </div>

          {project ? (
            <>
              <PatternViewerCanvas
                project={project}
                highlightedColorIds={highlightedColorIds}
                flipHorizontal={flipHorizontal}
                flipVertical={flipVertical}
                settings={viewerSettings}
                onHover={setHoverCell}
                fitLabel={text.fit}
              />
              <div className="pattern-viewer-flip-controls" aria-label="Flip controls">
                <button
                  type="button"
                  className={flipHorizontal ? 'active' : ''}
                  aria-pressed={flipHorizontal}
                  onClick={() => setFlipHorizontal((current) => !current)}
                >
                  <span aria-hidden="true">↔</span>
                  {text.horizontal}
                </button>
                <button
                  type="button"
                  className={flipVertical ? 'active' : ''}
                  aria-pressed={flipVertical}
                  onClick={() => setFlipVertical((current) => !current)}
                >
                  <span aria-hidden="true">↕</span>
                  {text.vertical}
                </button>
              </div>
            </>
          ) : (
            <div className="pattern-viewer-empty-stage">{text.noProject}</div>
          )}
          <section className="pattern-viewer-hover-section">
            <strong>{text.cell}</strong>
            <span>
              {hoverCell
                ? `R${hoverCell.y + 1} C${hoverCell.x + 1} · ${getColor(hoverCell.colorId)?.primaryCode ?? text.empty}`
                : text.hoverBoard}
            </span>
          </section>
        </section>

        {mobilePanelOpen && (
          <button
            type="button"
            className="pattern-viewer-panel-backdrop"
            aria-label="Close pattern controls"
            onClick={() => setMobilePanelOpen(false)}
          />
        )}
        <aside className={mobilePanelOpen ? 'pattern-viewer-panel is-open' : 'pattern-viewer-panel'}>
          <div className="pattern-viewer-panel-mobile-header">
            <strong>{text.colors}</strong>
            <button
              type="button"
              className="pattern-viewer-panel-close"
              aria-label="Close pattern controls"
              onClick={() => setMobilePanelOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="pattern-viewer-import-card">
            <div className="pattern-viewer-section-heading">
              <div>
                <strong>{text.importTitle}</strong>
                <span>{text.importHint}</span>
              </div>
              <span className="pattern-viewer-json-badge">JSON</span>
            </div>
            <button
              type="button"
              className="pattern-viewer-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = [...event.dataTransfer.files].find((item) => item.name.toLowerCase().endsWith('.json'));
                if (file) void importFile(file);
              }}
            >
              <span className="pattern-viewer-upload-icon" aria-hidden="true">↑</span>
              <strong>{text.chooseFile}</strong>
              <span>{text.importHint}</span>
            </button>
            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = '';
              }}
            />
            {error && (
              <div className="pattern-viewer-error" role="alert">
                <strong>{text.error}</strong>
                <span>{error}</span>
              </div>
            )}
          </div>

          <section className="pattern-viewer-view-section">
            <div className="pattern-viewer-section-heading">
              <div>
                <strong>{text.view}</strong>
                <span>{text.subtitle}</span>
              </div>
            </div>
            <div className="pattern-viewer-view-shape-toggle">
              <span>{text.beadShape}</span>
              <div>
                <button
                  type="button"
                  className={viewerSettings.beadDisplayMode === 'bead' ? 'active' : ''}
                  aria-pressed={viewerSettings.beadDisplayMode === 'bead'}
                  onClick={() => updateViewerSetting('beadDisplayMode', 'bead')}
                >
                  <span className="shape-choice-icon shape-choice-icon-round" aria-hidden="true" />
                  <span>{text.roundBeads}</span>
                </button>
                <button
                  type="button"
                  className={viewerSettings.beadDisplayMode === 'pixel' ? 'active' : ''}
                  aria-pressed={viewerSettings.beadDisplayMode === 'pixel'}
                  onClick={() => updateViewerSetting('beadDisplayMode', 'pixel')}
                >
                  <span className="shape-choice-icon shape-choice-icon-square" aria-hidden="true" />
                  <span>{text.squareBeads}</span>
                </button>
              </div>
            </div>
            <div className="pattern-viewer-view-row">
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={viewerSettings.showGrid}
                  onChange={(event) => updateViewerSetting('showGrid', event.target.checked)}
                />
                {text.grid}
              </label>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={viewerSettings.showCoordinates}
                  onChange={(event) => updateViewerSetting('showCoordinates', event.target.checked)}
                />
                {text.coordinates}
              </label>
            </div>
            <div className="pattern-viewer-view-row">
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={viewerSettings.showColorCodes}
                  onChange={(event) => updateViewerSetting('showColorCodes', event.target.checked)}
                />
                {text.showColorCodes}
              </label>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={viewerSettings.showLayerOverlap}
                  onChange={(event) => updateViewerSetting('showLayerOverlap', event.target.checked)}
                />
                {text.layerOverlap}
              </label>
            </div>
          </section>

          <section className="pattern-viewer-colors-section">
            <div className="pattern-viewer-section-heading">
              <div>
                <strong>{text.colors}</strong>
                <span>{text.colorsCount(colors.length)}</span>
              </div>
              {project && colors.length > 0 && (
                <span className="pattern-viewer-selection-status">
                  {noSelected ? '0' : `${highlightedColorIds.size}`} / {colors.length}
                </span>
              )}
            </div>
            <div className="pattern-viewer-selection-actions">
              <button type="button" onClick={selectAll} disabled={!project || colors.length === 0 || allSelected}>{text.selectAll}</button>
              <button type="button" onClick={clearAll} disabled={!project || colors.length === 0 || noSelected}>{text.clearAll}</button>
            </div>
            <div className="pattern-viewer-color-list">
              {colors.map((color) => {
                const active = highlightedColorIds.has(color.id);
                return (
                  <button
                    key={color.id}
                    type="button"
                    className={active ? 'pattern-viewer-color-card active' : 'pattern-viewer-color-card'}
                    aria-pressed={active}
                    onClick={() => toggleColor(color.id)}
                  >
                    <span className="pattern-viewer-color-swatch" style={{ backgroundColor: color.hex }} />
                    <span className="pattern-viewer-color-info">
                      <strong>{color.code}</strong>
                      <small>{color.name}</small>
                    </span>
                    <span className="pattern-viewer-color-count">{text.beads(color.count)}</span>
                  </button>
                );
              })}
              {project && colors.length === 0 && <div className="pattern-viewer-empty-list">{text.emptyColors}</div>}
              {!project && <div className="pattern-viewer-empty-list">{text.noProject}</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
