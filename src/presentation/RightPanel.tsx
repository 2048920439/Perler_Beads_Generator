import { useEffect, useMemo, useState } from 'react';
import type { BeadLayer, PaletteColor } from '@/common/types';
import { getColor } from '@/core/palette';
import { createProject } from '@/core/project';
import { findIsolatedBeads, summarizeUsage } from '@/core/usage';
import { EyeIcon } from '@/common/ui/EditorIcons';
import { LayerPanel } from '@/features/layers/LayerPanel';
import { AdjustmentPanel } from '@/features/adjustments/AdjustmentPanel';
import { useObservableState, useService } from '@/service-core';
import { LayerService } from '@/services/layer-service';
import { ProjectService } from '@/services/project-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { PaletteService, type PaletteMode } from '@/services/palette-service';
import { ToolService } from '@/services/tool-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { layerDisplayName as displayLayerName } from '@/features/layers/layerLabels';

type RightTab = 'palette' | 'layers' | 'usage' | 'adjustments';
export function RightPanel() {
  const localization = useService(LocalizationService);
  const noticeService = useService(NoticeService);
  const paletteService = useService(PaletteService);
  const toolService = useService(ToolService);
  const view = useService(WorkspaceViewService);
  const language = useObservableState(localization.snapshot$);
  const notice = useObservableState(noticeService.snapshot$);
  const { mode: paletteMode, selectedColorId, recentColorIds } = useObservableState(paletteService.snapshot$);
  const { tool } = useObservableState(toolService.snapshot$);
  const { showIsolatedBeads } = useObservableState(view.snapshot$);
  const setShowIsolatedBeads = (value: boolean) => view.setShowIsolatedBeads(value);
  const setPaletteMode = (mode: PaletteMode) => paletteService.setMode(mode);
  const projectService = useService(ProjectService);
  const layerService = useService(LayerService);
  const { project } = useObservableState(projectService.snapshot$);
  const layers = project.layers?.length ? project.layers : createProject(project.width, project.height).layers;
  const activeLayer = layers.find((layer) => layer.id === project.activeLayerId) ?? layers[0];
  const countedLayers = layers.filter((layer) => layer.includeInUsage);
  const usage = useMemo(() => summarizeUsage(project), [project]);
  const totalBeads = usage.reduce((sum, row) => sum + row.count, 0);
  const totalPacks = usage.reduce((sum, row) => sum + row.packs, 0);
  const boardCount = Math.ceil(project.width / project.boardSettings.boardWidth) * Math.ceil(project.height / project.boardSettings.boardHeight);
  const isolatedBeads = useMemo(() => findIsolatedBeads(project).length, [project]);
  const [rightTab, setRightTab] = useState<RightTab>('palette');
  const [paletteGroup, setPaletteGroup] = useState('all');
  const activePalette = paletteService.colors;
  const recentColors = recentColorIds.flatMap((id) => {
    const color = activePalette.find((item) => item.id === id);
    return color ? [color] : [];
  });
  const selectedColor = getColor(selectedColorId);
  const paletteGroups = useMemo(
    () => [{ id: 'all', label: 'All' }, ...[...new Set(activePalette.map((color) => color.group))].map((group) => ({ id: group, label: group }))],
    [activePalette],
  );
  const visiblePalette = paletteGroup === 'all' ? activePalette : activePalette.filter((color) => color.group === paletteGroup);

  function displayCode(color: PaletteColor) { return color.primaryCode; }
  function displayName(color: PaletteColor) { return color.name; }
  function selectColor(colorId: string, options?: { updateRecent?: boolean }) { paletteService.selectColor(colorId, options); }
  function setHighlightedColorId(colorId: string | null) { view.highlightColor(colorId); }
  useEffect(() => {
    if (!paletteGroups.some((group) => group.id === paletteGroup)) setPaletteGroup('all');
  }, [paletteGroup, paletteGroups]);

  function layerDisplayName(layer: BeadLayer, index: number): string {
    return displayLayerName(layer, index, language);
  }
  function updateUsageLayerSelection(layerIds: Set<string>) { layerService.updateUsageSelection(layerIds); }
  function toggleUsageLayer(layerId: string) {
    const includedLayerIds = new Set(countedLayers.map((layer) => layer.id));
    if (includedLayerIds.has(layerId)) includedLayerIds.delete(layerId);
    else includedLayerIds.add(layerId);
    updateUsageLayerSelection(includedLayerIds);
  }
  function stepBeadsPerPack(direction: -1 | 1) {
    const current = project.settings.beadsPerPack;
    const step = 500;
    const next = direction > 0
      ? current % step === 0 ? current + step : Math.ceil(current / step) * step
      : current % step === 0 ? current - step : Math.floor(current / step) * step;
    layerService.setBeadsPerPack(Math.max(step, next));
  }
  function setBeadsPerPack(value: number) { layerService.setBeadsPerPack(value); }
  function updateProject(changes: Partial<typeof project['settings']>) {
    projectService.updateSettings(changes);
  }
  return (
  <aside className="right-panel">
    <div className="right-tabs" role="tablist" aria-label="Right panel">
      <button
        className={rightTab === 'palette' ? 'active' : ''}
        role="tab"
        aria-selected={rightTab === 'palette'}
        onClick={() => setRightTab('palette')}
      >
        {localization.text.palette}
      </button>
      <button
        className={rightTab === 'layers' ? 'active' : ''}
        role="tab"
        aria-selected={rightTab === 'layers'}
        onClick={() => setRightTab('layers')}
      >
        {localization.text.layers}
      </button>
      <button
        className={rightTab === 'usage' ? 'active' : ''}
        role="tab"
        aria-selected={rightTab === 'usage'}
        onClick={() => setRightTab('usage')}
      >
        {localization.text.usage}
      </button>
      <button
        className={rightTab === 'adjustments' ? 'active' : ''}
        role="tab"
        aria-selected={rightTab === 'adjustments'}
        onClick={() => setRightTab('adjustments')}
      >
        {localization.text.adjustments}
      </button>
    </div>

    <section className="panel-section status-section">
      <div>
        <strong>{notice}</strong>
        <span>
          {localization.text.panelStatus(project.width, project.height, usage.length, totalBeads, boardCount)}
        </span>
      </div>
      <span className="status-pill">{localization.text.tools[tool].title}</span>
    </section>

    <details className="panel-section canvas-colors-section" open>
      <summary className="canvas-colors-toggle">
        <h2>{language === 'zh' ? '画布已用色号' : 'Colors used on canvas'}</h2>
        <span>{usage.length} {language === 'zh' ? '色' : 'colors'}</span>
      </summary>
      <div className="usage-list canvas-colors-list">
        {usage.map((row) => (
          <button
            key={row.color.id}
            type="button"
            onClick={() => selectColor(row.color.id)}
            onMouseEnter={() => setHighlightedColorId(row.color.id)}
            onMouseLeave={() => setHighlightedColorId(null)}
          >
            <span className="usage-chip" style={{ backgroundColor: row.color.hex }} />
            <span className="usage-color-info">
              <strong>{displayCode(row.color)}</strong>
              <small>{displayName(row.color)}</small>
            </span>
            <span className="usage-count">
              <strong>{localization.text.layerBeadCount(row.count)}</strong>
            </span>
          </button>
        ))}
        {usage.length === 0 && <div className="usage-empty">{localization.text.noUsage}</div>}
      </div>
    </details>

    {rightTab === 'palette' && (
      <section className="panel-section panel-tab-body palette-section">
        <h2>{localization.text.palette}</h2>
        <div className="palette-selected-card">
          <span style={{ backgroundColor: selectedColor?.hex }} />
          <div className="palette-selected-main">
            <strong>{selectedColor ? displayCode(selectedColor) : ''}</strong>
            <small>{selectedColor ? displayName(selectedColor) : ''}</small>
          </div>
          <div className="palette-selected-hex">
            <small>{selectedColor?.hex}</small>
          </div>
        </div>
        <div className="recent-colors-field">
          <span>{localization.text.recentColors}</span>
          <div className="recent-color-row">
            {recentColors.map((color) => (
              <button
                key={color.id}
                type="button"
                className={selectedColorId === color.id ? 'active' : ''}
                title={`${displayCode(color)} ${displayName(color)}`}
                aria-label={`${localization.text.recentColors} ${displayCode(color)}`}
                onClick={() => selectColor(color.id, { updateRecent: false })}
              >
                <span style={{ backgroundColor: color.hex }} />
                <small>{displayCode(color)}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="readonly-brand-field">
          {localization.text.brandCodes}
          <select value={paletteMode} onChange={(event) => setPaletteMode(event.target.value as PaletteMode)}>
            <option value="basic">{localization.text.mardBasic}</option>
            <option value="complete">{localization.text.mardComplete}</option>
          </select>
        </div>
        <div className="palette-filter" aria-label="Palette groups">
          {paletteGroups.map((group) => (
            <button
              key={group.id}
              className={paletteGroup === group.id ? 'active' : ''}
              onClick={() => setPaletteGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="palette-grid">
          {visiblePalette.map((color) => (
            <button
              key={color.id}
              className={selectedColorId === color.id ? 'swatch active' : 'swatch'}
              title={`${displayCode(color)} ${displayName(color)}`}
              onClick={() => {
                selectColor(color.id);
              }}
            >
              <span style={{ backgroundColor: color.hex }} />
              <small>{displayCode(color)}</small>
            </button>
          ))}
        </div>
      </section>
    )}

    {rightTab === 'layers' && (
      <LayerPanel />
    )}

    {rightTab === 'usage' && (
      <section className="panel-section panel-tab-body usage-section">
        <h2>{localization.text.usage}</h2>
        <div className="usage-overview">
          <div>
            <span>{localization.text.totalBeadsLabel}</span>
            <strong>{totalBeads}</strong>
          </div>
          <div>
            <span>{localization.text.colorTypes}</span>
            <strong>{usage.length}</strong>
          </div>
          <div>
            <span>{localization.text.estimatedPacks}</span>
            <strong>{totalPacks}</strong>
          </div>
        </div>
        <label className="usage-pack-setting">
          <span>{localization.text.beadsPerPack}</span>
          <div className="usage-pack-control">
            <div className="usage-pack-stepper">
              <button
                type="button"
                onClick={() => stepBeadsPerPack(-1)}
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={10000}
                step={500}
                value={project.settings.beadsPerPack}
                onChange={(event) => setBeadsPerPack(Number(event.target.value))}
              />
              <button
                type="button"
                onClick={() => stepBeadsPerPack(1)}
              >
                +
              </button>
            </div>
            <small>{localization.text.perPackUnit}</small>
          </div>
        </label>
        <div className="usage-summary-card">
          <div className="usage-summary-head">
            <strong>{localization.text.countedLayerTitle}</strong>
            <span>{localization.text.countedLayers(countedLayers.length)}</span>
          </div>
          <div className="usage-layer-actions">
            <button
              type="button"
              className={countedLayers.length === layers.length ? 'active' : ''}
              onClick={() => updateUsageLayerSelection(new Set(layers.map((layer) => layer.id)))}
            >
              {localization.text.countAllLayers}
            </button>
            <button
              type="button"
              className={countedLayers.length === 1 && countedLayers[0]?.id === activeLayer.id ? 'active' : ''}
              onClick={() => updateUsageLayerSelection(new Set([activeLayer.id]))}
            >
              {localization.text.countCurrentLayer}
            </button>
          </div>
          <div className="usage-layer-chips">
            {layers.map((layer) => {
              return (
                <button
                  key={layer.id}
                  type="button"
                  className={layer.includeInUsage ? 'active' : ''}
                  aria-pressed={layer.includeInUsage}
                  onClick={() => toggleUsageLayer(layer.id)}
                >
                  {layerDisplayName(layer, layers.findIndex((item) => item.id === layer.id))}
                </button>
              );
            })}
          </div>
          {countedLayers.length === 0 && <div className="usage-no-layers">{localization.text.noCountedLayers}</div>}
          {(usage.length > 32 || isolatedBeads > 0) && (
            <div className="usage-notes">
              {usage.length > 32 && <span>{localization.text.manyColors}</span>}
              {isolatedBeads > 0 && (
                <span className="usage-note-line">
                  <span>{localization.text.isolatedBeads(isolatedBeads)}</span>
                  <button
                    className={showIsolatedBeads ? 'usage-note-eye active' : 'usage-note-eye'}
                    type="button"
                    title={showIsolatedBeads ? localization.text.hideIsolatedBeads : localization.text.showIsolatedBeads}
                    aria-label={showIsolatedBeads ? localization.text.hideIsolatedBeads : localization.text.showIsolatedBeads}
                    aria-pressed={showIsolatedBeads}
                        onClick={() => setShowIsolatedBeads(!showIsolatedBeads)}
                  >
                    <EyeIcon visible={showIsolatedBeads} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="usage-list">
          {usage.map((row) => (
            <button
              key={row.color.id}
              onMouseEnter={() => setHighlightedColorId(row.color.id)}
              onMouseLeave={() => setHighlightedColorId(null)}
            >
              <span className="usage-chip" style={{ backgroundColor: row.color.hex }} />
              <span className="usage-color-info">
                <strong>{displayCode(row.color)}</strong>
                <small>{displayName(row.color)}</small>
              </span>
              <span className="usage-count">
                <strong>{row.count}</strong>
                <small>{row.packs} {localization.text.packUnit}</small>
              </span>
            </button>
          ))}
          {usage.length === 0 && <div className="usage-empty">{localization.text.noUsage}</div>}
        </div>
      </section>
    )}

    {rightTab === 'adjustments' && (
      <AdjustmentPanel />
    )}

    {rightTab === 'palette' && (
      <>
        <section className="panel-section view-section">
          <h2>{localization.text.view}</h2>
        <div className="view-toggle-grid">
          <div className="view-shape-toggle" aria-label={localization.text.beadShape}>
            <span>{localization.text.beadShape}</span>
            <div>
              <button
                type="button"
                className={project.settings.beadDisplayMode === 'bead' ? 'active' : ''}
                aria-pressed={project.settings.beadDisplayMode === 'bead'}
                onClick={() => updateProject({ beadDisplayMode: 'bead' })}
              >
                <span className="shape-choice-icon shape-choice-icon-round" aria-hidden="true" />
                <span>{localization.text.roundBeads}</span>
              </button>
              <button
                type="button"
                className={project.settings.beadDisplayMode === 'pixel' ? 'active' : ''}
                aria-pressed={project.settings.beadDisplayMode === 'pixel'}
                onClick={() => updateProject({ beadDisplayMode: 'pixel' })}
              >
                <span className="shape-choice-icon shape-choice-icon-square" aria-hidden="true" />
                <span>{localization.text.squareBeads}</span>
              </button>
            </div>
          </div>
          <div className="view-row">
            <label className="checkline">
              <input
                type="checkbox"
                checked={project.settings.showGrid}
                onChange={(event) =>
                  updateProject({ showGrid: event.target.checked })
                }
              />
              {localization.text.grid}
            </label>
            <label className="checkline">
              <input
                type="checkbox"
                checked={project.settings.showCoordinates}
                onChange={(event) =>
                  updateProject({ showCoordinates: event.target.checked })
                }
              />
              {localization.text.coordinates}
            </label>
          </div>
          <div className="view-row">
            <label className="checkline">
              <input
                type="checkbox"
                checked={project.settings.showColorCodes}
                onChange={(event) =>
                  updateProject({ showColorCodes: event.target.checked })
                }
              />
              {localization.text.showColorCodes}
            </label>
            <label className="checkline">
              <input
                type="checkbox"
                checked={project.settings.showLayerOverlap}
                onChange={(event) =>
                  updateProject({ showLayerOverlap: event.target.checked })
                }
              />
              {localization.text.layerOverlap}
            </label>
          </div>
        </div>
        </section>

        <CellInfo />
      </>
    )}
  </aside>
  );
}

function CellInfo() {
  const localization = useService(LocalizationService);
  useObservableState(localization.snapshot$);
  const view = useService(WorkspaceViewService);
  const hoverCell = useObservableState(view.hoverCell$);
  return (
    <section className="panel-section hover-section">
      <h2>{localization.text.cell}</h2>
      <span>{hoverCell
        ? `R${hoverCell.y + 1} C${hoverCell.x + 1} - ${getColor(hoverCell.colorId)?.primaryCode ?? localization.text.empty}`
        : localization.text.hoverBoard}</span>
    </section>
  );
}
