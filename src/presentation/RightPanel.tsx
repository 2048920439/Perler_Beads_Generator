import { useEffect, useState } from 'react';
import type { BeadLayer, PaletteColor } from '@/common/types';
import { EyeIcon } from '@/common/ui/EditorIcons';
import { LayerPanel } from '@/components/layers/LayerPanel';
import { AdjustmentPanel } from '@/components/adjustments/AdjustmentPanel';
import { useObservableState, useService } from '@/service-core';
import { LayerService } from '@/services/layer-service';
import { LocalizationService } from '@/services/localization-service';
import { NoticeService } from '@/services/notice-service';
import { PaletteService, type PaletteMode } from '@/services/palette-service';
import { ToolService } from '@/services/tool-service';
import { WorkspaceViewService } from '@/services/workspace-view-service';
import { EditorQueryService } from '@/services/editor-query-service';

type RightTab = 'palette' | 'layers' | 'usage' | 'adjustments';
export function RightPanel() {
  const localization = useService(LocalizationService);
  const noticeService = useService(NoticeService);
  const paletteService = useService(PaletteService);
  const toolService = useService(ToolService);
  const view = useService(WorkspaceViewService);
  const editor = useService(EditorQueryService);
  const notice = useObservableState(noticeService.snapshot$);
  const { mode: paletteMode, selectedColorId } = useObservableState(paletteService.snapshot$);
  const { tool } = useObservableState(toolService.snapshot$);
  const { showIsolatedBeads } = useObservableState(view.snapshot$);
  const setShowIsolatedBeads = (value: boolean) => view.setShowIsolatedBeads(value);
  const setPaletteMode = (mode: PaletteMode) => paletteService.setMode(mode);
  const layerService = useService(LayerService);
  const { project, layers, activeLayer, countedLayers, usage, totalBeads, totalPacks, isolatedBeads, boardCount, selectedColor, recentColors, paletteGroups } = useObservableState(editor.snapshot$);
  const [rightTab, setRightTab] = useState<RightTab>('palette');
  const [paletteGroup, setPaletteGroup] = useState('all');
  const visiblePalette = paletteService.getColors(paletteGroup);

  function displayCode(color: PaletteColor) { return color.primaryCode; }
  function displayName(color: PaletteColor) { return color.name; }
  function selectColor(colorId: string, options?: { updateRecent?: boolean }) { paletteService.selectColor(colorId, options); }
  function setHighlightedColorId(colorId: string | null) { view.highlightColor(colorId); }
  useEffect(() => {
    if (!paletteGroups.some((group) => group.id === paletteGroup)) setPaletteGroup('all');
  }, [paletteGroup, paletteGroups]);

  function layerDisplayName(layer: BeadLayer, index: number): string { return editor.getLayerDisplayName(layer, index); }
  function toggleUsageLayer(layerId: string) {
    layerService.toggleUsageLayer(layerId);
  }
  function stepBeadsPerPack(direction: -1 | 1) {
    layerService.stepBeadsPerPack(direction);
  }
  function setBeadsPerPack(value: number) { layerService.setBeadsPerPack(value); }
  function updateProject(changes: Partial<typeof project['settings']>) {
    view.updateSettings(changes);
  }
  return (
  <aside className="right-panel">
    <div className="right-tabs" role="tablist" aria-label={localization.text.rightPanel}>
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
        <h2>{localization.text.canvasColors}</h2>
        <span>{localization.text.colorCount(usage.length)}</span>
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
        <div className="palette-filter" aria-label={localization.text.paletteGroups}>
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
              onClick={() => layerService.countAllLayers()}
            >
              {localization.text.countAllLayers}
            </button>
            <button
              type="button"
              className={countedLayers.length === 1 && countedLayers[0]?.id === activeLayer.id ? 'active' : ''}
              onClick={() => layerService.countActiveLayer()}
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
  const editor = useService(EditorQueryService);
  useObservableState(localization.snapshot$);
  const view = useService(WorkspaceViewService);
  const hoverCell = useObservableState(view.hoverCell$);
  return (
    <section className="panel-section hover-section">
      <h2>{localization.text.cell}</h2>
      <span>{hoverCell
        ? `R${hoverCell.y + 1} C${hoverCell.x + 1} - ${editor.getColor(hoverCell.colorId)?.primaryCode ?? localization.text.empty}`
        : localization.text.hoverBoard}</span>
    </section>
  );
}
