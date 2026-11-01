import type { BeadProject, ClipboardPattern, CopyMode, MoveMode, RemoveMode, TextDirection, ToolId } from '@/common/types';
import {
  collectBrushIndices,
  collectConnectedCellIndices,
  collectConnectedOccupiedIndices,
  collectFloodFillIndices,
  collectSameColorIndices,
  getActiveLayerCells,
  getTopVisibleColor,
} from '@/services/domain/workspace/cell-operations';
import type { ColorResolver, PointerGridPoint } from './canvas-types';
import { drawCellBoundarySet, drawCellSet, drawCopySelectionSet } from './selection-renderer';
import { collectTextIndices } from './text-rasterizer';

export function drawBrushCursor(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  cellSize: number,
): void {
  const diameter = Math.max(0.25, size);
  const radius = (diameter * cellSize) / 2;
  const x = centerX * cellSize;
  const y = centerY * cellSize;
  const visibleRadius = Math.max(2, radius);
  context.save();
  context.beginPath();
  context.arc(x, y, visibleRadius, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.12)';
  context.fill();
  context.lineWidth = Math.max(1, cellSize * 0.055);
  context.strokeStyle = 'rgba(17, 24, 39, 0.48)';
  context.setLineDash([cellSize * 0.22, cellSize * 0.18]);
  context.stroke();
  context.beginPath();
  context.arc(x, y, visibleRadius, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(255, 255, 255, 0.68)';
  context.lineWidth = Math.max(0.6, cellSize * 0.025);
  context.setLineDash([]);
  context.stroke();
  context.restore();
}

export function drawShapePreview(
  context: CanvasRenderingContext2D,
  indices: number[],
  width: number,
  cellSize: number,
  selectedColorId: string,
  resolveColor: ColorResolver,
): void {
  if (indices.length === 0) return;
  const color = resolveColor(selectedColorId);
  context.save();
  if (color) {
    context.fillStyle = hexToRgba(color.hex, 0.32);
    indices.forEach((index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      context.fillRect(x * cellSize + 2, y * cellSize + 2, cellSize - 4, cellSize - 4);
    });
  }
  drawCellBoundarySet(context, indices, width, cellSize);
  context.restore();
}

function drawClipboardPatternPreview(
  context: CanvasRenderingContext2D,
  pattern: ClipboardPattern,
  startX: number,
  startY: number,
  boardWidth: number,
  boardHeight: number,
  cellSize: number,
  resolveColor: ColorResolver,
): void {
  const indices: number[] = [];
  context.save();
  pattern.cells.forEach((colorId, index) => {
    if (!colorId) return;
    const x = startX + (index % pattern.width);
    const y = startY + Math.floor(index / pattern.width);
    if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) return;
    const color = resolveColor(colorId);
    if (color) {
      context.fillStyle = hexToRgba(color.hex, 0.34);
      context.fillRect(x * cellSize + 2, y * cellSize + 2, cellSize - 4, cellSize - 4);
    }
    indices.push(y * boardWidth + x);
  });
  drawCellBoundarySet(context, indices, boardWidth, cellSize);
  context.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawToolImpactPreview(
  context: CanvasRenderingContext2D,
  project: BeadProject,
  tool: ToolId,
  selectedColorId: string,
  hoverPoint: PointerGridPoint,
  eraserSize: number,
  moveMode: MoveMode,
  removeMode: RemoveMode,
  mirrorMode: MoveMode,
  clipboardPattern: ClipboardPattern | null,
  copyMode: CopyMode,
  copySelectionIndices: number[],
  textToolValue: string,
  textToolDirection: TextDirection,
  textToolSize: number,
  textToolSpacing: number,
  cellSize: number,
  resolveColor: ColorResolver,
): void {
  if (tool === 'eraser') {
    if (eraserSize <= 0) return;
    const indices = collectBrushIndices(hoverPoint.gridX, hoverPoint.gridY, eraserSize, project.width, project.height);
    drawCellSet(context, indices, project.width, cellSize, {
      fill: 'rgba(185, 58, 50, 0.08)',
      stroke: 'rgba(185, 58, 50, 0.42)',
      lineWidth: 1,
    });
    return;
  }

  if (tool === 'fill') {
    if (!hoverPoint.cell) return;
    const indices = collectFloodFillIndices(
      getActiveLayerCells(project),
      project.width,
      project.height,
      hoverPoint.cell.x,
      hoverPoint.cell.y,
      selectedColorId,
    );
    drawCellSet(context, indices, project.width, cellSize, {
      fill: 'rgba(23, 101, 106, 0.06)',
      stroke: 'rgba(23, 101, 106, 0.34)',
      lineWidth: 1,
    });
    return;
  }

  if (tool === 'remove') {
    if (!hoverPoint.cell) return;
    const cells = getActiveLayerCells(project);
    const startIndex = hoverPoint.cell.y * project.width + hoverPoint.cell.x;
    if (!cells[startIndex]) return;
    const indices =
      removeMode === 'same-connected'
        ? collectConnectedCellIndices(cells, project.width, project.height, hoverPoint.cell.x, hoverPoint.cell.y)
        : removeMode === 'all-same-color'
          ? collectSameColorIndices(cells, hoverPoint.cell.x, hoverPoint.cell.y, project.width)
          : collectConnectedOccupiedIndices(cells, project.width, project.height, hoverPoint.cell.x, hoverPoint.cell.y);
    drawCellSet(context, indices, project.width, cellSize, {
      fill: 'rgba(185, 58, 50, 0.065)',
      stroke: 'rgba(185, 58, 50, 0.34)',
      lineWidth: 1,
    });
    return;
  }

  if (tool === 'move') {
    if (!hoverPoint.cell) return;
    const cells = getActiveLayerCells(project);
    const startIndex = hoverPoint.cell.y * project.width + hoverPoint.cell.x;
    if (!cells[startIndex]) return;
    const indices =
      moveMode === 'partial'
        ? collectConnectedOccupiedIndices(cells, project.width, project.height, hoverPoint.cell.x, hoverPoint.cell.y)
        : cells.flatMap((colorId, index) => (colorId ? [index] : []));
    drawCellBoundarySet(context, indices, project.width, cellSize);
    return;
  }

  if (tool === 'copy') {
    if (!hoverPoint.cell) return;
    const cells = getActiveLayerCells(project);
    const startIndex = hoverPoint.cell.y * project.width + hoverPoint.cell.x;
    if (!cells[startIndex]) return;
    if (copyMode === 'selection') {
      if (copySelectionIndices.includes(startIndex)) return;
      drawCopySelectionSet(context, [startIndex], project.width, cellSize, 0.7);
      return;
    }
    const indices = collectConnectedOccupiedIndices(cells, project.width, project.height, hoverPoint.cell.x, hoverPoint.cell.y);
    drawCellBoundarySet(context, indices, project.width, cellSize);
    return;
  }

  if (tool === 'paste') {
    if (!hoverPoint.cell || !clipboardPattern) return;
    drawClipboardPatternPreview(context, clipboardPattern, hoverPoint.cell.x, hoverPoint.cell.y, project.width, project.height, cellSize, resolveColor);
    return;
  }

  if (tool === 'mirror') {
    if (!hoverPoint.cell) return;
    const cells = getActiveLayerCells(project);
    const startIndex = hoverPoint.cell.y * project.width + hoverPoint.cell.x;
    if (!cells[startIndex]) return;
    const indices =
      mirrorMode === 'partial'
        ? collectConnectedOccupiedIndices(cells, project.width, project.height, hoverPoint.cell.x, hoverPoint.cell.y)
        : cells.flatMap((colorId, index) => (colorId ? [index] : []));
    drawCellBoundarySet(context, indices, project.width, cellSize);
    return;
  }

  if (tool === 'recolor') {
    if (!hoverPoint.cell) return;
    const sourceColorId = getTopVisibleColor(project, hoverPoint.cell.y * project.width + hoverPoint.cell.x);
    if (!sourceColorId || sourceColorId === selectedColorId) return;
    const indices = collectRecolorIndices(project, sourceColorId);
    drawCellSet(context, indices, project.width, cellSize, {
      fill: 'rgba(240, 200, 75, 0.18)',
      stroke: 'rgba(23, 101, 106, 0.74)',
      lineWidth: 1.55,
    });
    return;
  }

  if (tool === 'text') {
    if (!hoverPoint.cell) return;
    const indices = collectTextIndices(textToolValue, textToolDirection, textToolSize, textToolSpacing, hoverPoint.cell.x, hoverPoint.cell.y, project.width, project.height);
    drawShapePreview(context, indices, project.width, cellSize, selectedColorId, resolveColor);
    return;
  }

  if (tool === 'pencil') return;

  if (tool !== 'eyedropper' || !hoverPoint.cell) return;
  drawCellSet(context, [hoverPoint.cell.y * project.width + hoverPoint.cell.x], project.width, cellSize, {
    stroke: 'rgba(90, 78, 38, 0.62)',
    lineWidth: 1.2,
  });
}

function collectRecolorIndices(project: BeadProject, sourceColorId: string): number[] {
  const indices = new Set<number>();
  (project.layers ?? []).forEach((layer) => {
    if (!layer.visible || layer.locked) return;
    layer.cells.forEach((colorId, index) => {
      if (colorId === sourceColorId) indices.add(index);
    });
  });
  return [...indices];
}
