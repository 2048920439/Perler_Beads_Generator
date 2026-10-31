import { useState } from 'react';
import type { DragEvent } from 'react';
import type { BeadLayer } from '@/common/types';
import { DragHandleIcon, DuplicateIcon, EyeIcon, LockIcon, PencilIcon, TrashIcon } from '@/common/ui/EditorIcons';
import { useObservableState, useService } from '@/service-core';
import { LayerService } from '@/services/layer-service';
import { LocalizationService } from '@/services/localization-service';
import { ProjectService } from '@/services/project-service';
import { layerDisplayName as displayLayerName } from './layerLabels';

type DragTarget = { id: string; edge: 'before' | 'after' };

function dragTargetFromEvent(event: DragEvent<HTMLElement>, layerId: string): DragTarget {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    id: layerId,
    edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
  };
}

export function LayerPanel() {
  const service = useService(LayerService);
  const projectService = useService(ProjectService);
  const localization = useService(LocalizationService);
  const language = useObservableState(localization.snapshot$);
  const { project } = useObservableState(projectService.snapshot$);
  const { layers, activeLayerId } = project;
  const layerDisplayName = (layer: BeadLayer, index: number) => displayLayerName(layer, index, language);
  function layerMetaText(isActive: boolean, isVisible: boolean, isLocked: boolean, beadCount: number): string {
    return [
      ...(isActive ? [localization.text.activeLayer] : []), ...(!isVisible ? [localization.text.hiddenLayer] : []),
      ...(isLocked ? [localization.text.lockedLayer] : []), localization.text.layerBeadCount(beadCount),
    ].join(' - ');
  }
  const onAddLayer = () => service.addLayer();
  const onToggleActiveLayerOnly = () => service.toggleActiveLayerOnly();
  const onSelectLayer = (id: string) => service.selectLayer(id);
  const onUpdateLayer = (id: string, changes: Partial<BeadLayer>) => service.updateLayer(id, changes);
  const onDuplicateLayer = (id: string) => service.duplicateLayer(id);
  const onDeleteLayer = (id: string) => service.deleteLayer(id);
  const onMoveLayer = (id: string, target: DragTarget) => service.moveLayer(id, target);
  const onSaveLayerName = (layer: BeadLayer, index: number, name: string) => service.renameLayer(layer, index, name);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);

  function saveEditingLayer(layer: BeadLayer, index: number) {
    const nextName = editingLayerName.trim();
    setEditingLayerId(null);
    if (nextName) onSaveLayerName(layer, index, nextName);
  }

  return (
    <section className="panel-section panel-tab-body layers-section">
      <div className="layers-header">
        <h2>{localization.text.layers}</h2>
        <button onClick={onAddLayer}>{localization.text.addLayer}</button>
      </div>
      <button
        className={project.settings.showActiveLayerOnly ? 'layer-solo-toggle active' : 'layer-solo-toggle'}
        type="button"
        aria-pressed={project.settings.showActiveLayerOnly}
        onClick={onToggleActiveLayerOnly}
      >
        <EyeIcon visible={project.settings.showActiveLayerOnly} />
        <span>{localization.text.showActiveLayerOnly}</span>
      </button>
      <div
        className="layer-list"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragTarget(null);
        }}
      >
        {[...layers].reverse().map((layer) => {
          const layerIndex = layers.findIndex((item) => item.id === layer.id);
          const isActive = layer.id === activeLayerId;
          const beadCount = layer.cells.filter(Boolean).length;
          const displayName = layerDisplayName(layer, layerIndex);
          const rowClassName = [
            'layer-row',
            isActive ? 'active' : '',
            draggingLayerId === layer.id ? 'dragging' : '',
            dragTarget?.id === layer.id && draggingLayerId !== layer.id ? `drag-over-${dragTarget.edge}` : '',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={layer.id}
              className={rowClassName}
              onDragOver={(event) => {
                if (!draggingLayerId || draggingLayerId === layer.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                const nextTarget = dragTargetFromEvent(event, layer.id);
                setDragTarget((current) =>
                  current?.id === nextTarget.id && current.edge === nextTarget.edge ? current : nextTarget,
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData('text/plain') || draggingLayerId;
                const nextTarget = dragTargetFromEvent(event, layer.id);
                setDraggingLayerId(null);
                setDragTarget(null);
                if (sourceId) onMoveLayer(sourceId, nextTarget);
              }}
            >
              <button
                className="layer-drag-handle"
                draggable
                title={localization.text.reorderLayer}
                aria-label={localization.text.reorderLayer}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', layer.id);
                  const dragImage = document.createElement('canvas');
                  dragImage.width = 1;
                  dragImage.height = 1;
                  event.dataTransfer.setDragImage(dragImage, 0, 0);
                  setDraggingLayerId(layer.id);
                }}
                onDragEnd={() => {
                  setDraggingLayerId(null);
                  setDragTarget(null);
                }}
              >
                <DragHandleIcon />
              </button>
              <button
                className={layer.visible ? 'mini-icon-toggle visibility-toggle active' : 'mini-icon-toggle visibility-toggle'}
                title={layer.visible ? localization.text.eye : localization.text.hiddenLayer}
                aria-label={layer.visible ? localization.text.eye : localization.text.hiddenLayer}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdateLayer(layer.id, { visible: !layer.visible });
                }}
              >
                <EyeIcon visible={layer.visible} />
              </button>
              {editingLayerId === layer.id ? (
                <form
                  className="layer-main layer-name-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveEditingLayer(layer, layerIndex);
                  }}
                >
                  <input
                    value={editingLayerName}
                    aria-label={localization.text.renameLayer}
                    autoFocus
                    onChange={(event) => setEditingLayerName(event.target.value)}
                    onBlur={() => saveEditingLayer(layer, layerIndex)}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingLayerId(null);
                      }
                    }}
                  />
                  <span className="layer-meta">{layerMetaText(isActive, layer.visible, layer.locked, beadCount)}</span>
                  <label className="checkline layer-count">
                    <input
                      type="checkbox"
                      checked={layer.includeInUsage}
                      onChange={(event) => onUpdateLayer(layer.id, { includeInUsage: event.target.checked })}
                    />
                    {localization.text.countLayer}
                  </label>
                </form>
              ) : (
                <div className="layer-main layer-main-static" onClick={() => onSelectLayer(layer.id)}>
                  <div className="layer-title-row">
                    <strong>
                      <span>{displayName}</span>
                      <button
                        className="layer-rename-button"
                        type="button"
                        title={localization.text.renameLayer}
                        aria-label={localization.text.renameLayer}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingLayerId(layer.id);
                          setEditingLayerName(displayName);
                        }}
                      >
                        <PencilIcon />
                      </button>
                    </strong>
                  </div>
                  <span className="layer-meta">{layerMetaText(isActive, layer.visible, layer.locked, beadCount)}</span>
                  <label className="checkline layer-count">
                    <input
                      type="checkbox"
                      checked={layer.includeInUsage}
                      onChange={(event) => onUpdateLayer(layer.id, { includeInUsage: event.target.checked })}
                    />
                    {localization.text.countLayer}
                  </label>
                </div>
              )}
              <div className="layer-actions">
                <button
                  className={layer.locked ? 'mini-icon-toggle active' : 'mini-icon-toggle'}
                  aria-label={layer.locked ? localization.text.unlock : localization.text.lock}
                  title={layer.locked ? localization.text.unlockHint : localization.text.lockHint}
                  onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                >
                  <LockIcon locked={layer.locked} />
                </button>
                <button
                  className="mini-icon-toggle"
                  aria-label={localization.text.duplicateLayer}
                  title={localization.text.duplicateLayer}
                  onClick={() => onDuplicateLayer(layer.id)}
                >
                  <DuplicateIcon />
                </button>
                <button
                  className="mini-icon-toggle danger"
                  disabled={layers.length <= 1}
                  aria-label={localization.text.deleteLayer}
                  title={localization.text.deleteLayer}
                  onClick={() => onDeleteLayer(layer.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
