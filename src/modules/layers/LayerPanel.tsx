import { useState } from 'react';
import type { DragEvent } from 'react';
import type { BeadLayer } from '@/common/types';
import type { EditorText } from '@/config/localization';
import { DragHandleIcon, DuplicateIcon, EyeIcon, LockIcon, PencilIcon, TrashIcon } from '@/common/ui/EditorIcons';

type DragTarget = { id: string; edge: 'before' | 'after' };

type Props = {
  text: EditorText;
  layers: BeadLayer[];
  activeLayerId: string;
  showActiveLayerOnly: boolean;
  layerDisplayName: (layer: BeadLayer, index: number) => string;
  layerMetaText: (isActive: boolean, isVisible: boolean, isLocked: boolean, beadCount: number) => string;
  onAddLayer: () => void;
  onToggleActiveLayerOnly: () => void;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, changes: Partial<BeadLayer>) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onMoveLayer: (sourceId: string, target: DragTarget) => void;
  onSaveLayerName: (layer: BeadLayer, index: number, name: string) => void;
};

function dragTargetFromEvent(event: DragEvent<HTMLElement>, layerId: string): DragTarget {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    id: layerId,
    edge: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
  };
}

export function LayerPanel({
  text,
  layers,
  activeLayerId,
  showActiveLayerOnly,
  layerDisplayName,
  layerMetaText,
  onAddLayer,
  onToggleActiveLayerOnly,
  onSelectLayer,
  onUpdateLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onMoveLayer,
  onSaveLayerName,
}: Props) {
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
        <h2>{text.layers}</h2>
        <button onClick={onAddLayer}>{text.addLayer}</button>
      </div>
      <button
        className={showActiveLayerOnly ? 'layer-solo-toggle active' : 'layer-solo-toggle'}
        type="button"
        aria-pressed={showActiveLayerOnly}
        onClick={onToggleActiveLayerOnly}
      >
        <EyeIcon visible={showActiveLayerOnly} />
        <span>{text.showActiveLayerOnly}</span>
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
                title={text.reorderLayer}
                aria-label={text.reorderLayer}
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
                title={layer.visible ? text.eye : text.hiddenLayer}
                aria-label={layer.visible ? text.eye : text.hiddenLayer}
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
                    aria-label={text.renameLayer}
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
                    {text.countLayer}
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
                        title={text.renameLayer}
                        aria-label={text.renameLayer}
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
                    {text.countLayer}
                  </label>
                </div>
              )}
              <div className="layer-actions">
                <button
                  className={layer.locked ? 'mini-icon-toggle active' : 'mini-icon-toggle'}
                  aria-label={layer.locked ? text.unlock : text.lock}
                  title={layer.locked ? text.unlockHint : text.lockHint}
                  onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                >
                  <LockIcon locked={layer.locked} />
                </button>
                <button
                  className="mini-icon-toggle"
                  aria-label={text.duplicateLayer}
                  title={text.duplicateLayer}
                  onClick={() => onDuplicateLayer(layer.id)}
                >
                  <DuplicateIcon />
                </button>
                <button
                  className="mini-icon-toggle danger"
                  disabled={layers.length <= 1}
                  aria-label={text.deleteLayer}
                  title={text.deleteLayer}
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
