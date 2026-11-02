import type { ArrowKind, BeadLayer, BeadProject, ClipboardPattern, MirrorDirection, PaletteColor, RemoveMode, ShapeFillMode, ShapeKind } from '@/common/types';
import { collectShapeIndices } from './workspace/shape-rasterizer';
import {
  canShiftSelection, clampShiftDelta, collectRemoveIndices, floodFill, mirrorCells, paintBrushLine, paintCell, paintLine,
  pasteClipboardPattern, shiftCells, type CellValue, type GridPoint,
} from './workspace/cell-operations';
import {
  adjustLayerCells, applyEffectToLayer, limitLayerColors, mergeCloseLayerColors,
  type AdjustmentSettings, type LayerEffect,
} from './adjustment-operations';
import { composeVisibleCells } from './project';

export type PaintCellInput = {
  x: number; y: number; gridX: number; gridY: number;
  value: CellValue; brushSize: number; brush: boolean;
};
export type PaintLineInput = {
  from: GridPoint; to: GridPoint; value: CellValue; brushSize: number; brush: boolean;
};
export type ShapeInput = {
  kind: ShapeKind; fillMode: ShapeFillMode; arrowKind: ArrowKind;
  start: { x: number; y: number }; end: { x: number; y: number };
};
export type CellCommand =
  | { type: 'paint'; input: PaintCellInput }
  | { type: 'line'; input: PaintLineInput }
  | { type: 'brush'; from: { x: number; y: number }; to: { x: number; y: number }; size: number }
  | { type: 'fill'; x: number; y: number; colorId: string }
  | { type: 'remove'; x: number; y: number; mode: RemoveMode }
  | { type: 'mirror'; direction: MirrorDirection; indices: number[] }
  | { type: 'shift'; dx: number; dy: number; indices: number[] }
  | { type: 'paste'; pattern: ClipboardPattern; x: number; y: number }
  | { type: 'indices'; indices: number[]; colorId: string }
  | { type: 'shape'; shape: ShapeInput; colorId: string }
  | { type: 'clear' }
  | { type: 'adjust'; settings: AdjustmentSettings; palette: PaletteColor[] }
  | { type: 'effect'; effect: LayerEffect; palette: PaletteColor[] }
  | { type: 'cleanup'; strength: number; palette: PaletteColor[] }
  | { type: 'limit'; limit: number; palette: PaletteColor[] };

export type LayerChanges = Partial<Pick<BeadLayer,
  'name' | 'customName' | 'visible' | 'locked' | 'includeInUsage' | 'opacity'
>>;
export type LayerMoveTarget = { id: string; edge: 'before' | 'after' };

export function sameCells(left: CellValue[], right: CellValue[]): boolean {
  return left === right || (left.length === right.length && left.every((value, index) => value === right[index]));
}

// Preserve untouched layers and cell arrays; normalization belongs at input boundaries.
export function replaceLayers(project: BeadProject, layers: BeadLayer[], activeLayerId = project.activeLayerId): BeadProject {
  return {
    ...project, layers,
    activeLayerId: layers.some((layer) => layer.id === activeLayerId) ? activeLayerId : layers[0].id,
    cells: composeVisibleCells(layers, project.width, project.height),
  };
}

export function applyCellEdit(
  cells: CellValue[], width: number, height: number, command: CellCommand,
): { cells: CellValue[]; affected?: number } {
  switch (command.type) {
    case 'paint': {
      const input = command.input;
      return { cells: paintCell(cells, width, height, input.x, input.y, input.value, input.brushSize, input.gridX, input.gridY, input.brush) };
    }
    case 'line': {
      const input = command.input;
      return { cells: paintLine(cells, width, height, input.from, input.to, input.value, input.brushSize, input.brush) };
    }
    case 'brush': return { cells: paintBrushLine(cells, width, height, command.from, command.to, command.size) };
    case 'fill': return { cells: floodFill(cells, width, height, command.x, command.y, command.colorId) };
    case 'remove': {
      if (!cells[command.y * width + command.x]) return { cells };
      const next = cells.slice();
      collectRemoveIndices(cells, width, height, command.x, command.y, command.mode).forEach((index) => { next[index] = null; });
      return { cells: next };
    }
    case 'mirror': return { cells: mirrorCells(cells, width, height, command.direction, command.indices) };
    case 'shift': {
      const { dx, dy } = clampShiftDelta(cells, width, height, command.dx, command.dy, command.indices);
      if (command.indices.length && !canShiftSelection(cells, width, height, dx, dy, command.indices)) return { cells };
      return { cells: shiftCells(cells, width, height, dx, dy, command.indices) };
    }
    case 'paste': return { cells: pasteClipboardPattern(cells, width, height, command.pattern, command.x, command.y) };
    case 'indices':
    case 'shape': {
      const indices = command.type === 'shape'
        ? collectShapeIndices(command.shape.kind, command.shape.fillMode, command.shape.arrowKind, command.shape.start, command.shape.end, width, height)
        : command.indices;
      let next = cells;
      indices.forEach((index) => {
        if (next[index] === command.colorId) return;
        if (next === cells) next = cells.slice();
        next[index] = command.colorId;
      });
      return { cells: next };
    }
    case 'clear': return { cells: cells.some(Boolean) ? Array<CellValue>(width * height).fill(null) : cells };
    case 'adjust': return { cells: adjustLayerCells(cells, command.settings, command.palette) };
    case 'effect': {
      const result = applyEffectToLayer(cells, command.palette, command.effect);
      return { cells: result.cells, affected: result.changed };
    }
    case 'cleanup': {
      const result = mergeCloseLayerColors(cells, command.palette, command.strength);
      return { cells: result.cells, affected: result.changed };
    }
    case 'limit': {
      const result = limitLayerColors(cells, command.palette, command.limit);
      return { cells: result.cells, affected: result.changed };
    }
  }
}

export function moveLayers(layers: BeadLayer[], sourceId: string, target: LayerMoveTarget): BeadLayer[] {
  if (sourceId === target.id) return layers;
  const display = [...layers].reverse();
  const sourceIndex = display.findIndex((layer) => layer.id === sourceId);
  if (sourceIndex < 0) return layers;
  const [moved] = display.splice(sourceIndex, 1);
  const targetIndex = display.findIndex((layer) => layer.id === target.id);
  if (!moved || targetIndex < 0) return layers;
  display.splice(target.edge === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
  display.reverse();
  return display.every((layer, index) => layer === layers[index]) ? layers : display;
}
