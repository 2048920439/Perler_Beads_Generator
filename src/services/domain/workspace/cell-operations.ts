import type { BeadProject, ClipboardPattern, MirrorDirection, RemoveMode } from '@/common/types';

export type GridPoint = {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
};

export type CellValue = string | null;

export function getActiveLayerCells(project: BeadProject): CellValue[] {
  return project.layers.find((layer) => layer.id === project.activeLayerId)?.cells ?? project.cells;
}

export function getTopVisibleColor(project: BeadProject, index: number): string | null {
  for (let layerIndex = project.layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const layer = project.layers[layerIndex];
    if (!layer.visible) continue;
    const colorId = layer.cells?.[index];
    if (colorId) return colorId;
  }
  return null;
}

export function paintCell(
  cells: CellValue[],
  width: number,
  height: number,
  x: number,
  y: number,
  value: CellValue,
  brushSize: number,
  gridX = x + 0.5,
  gridY = y + 0.5,
  brush = value === null,
): CellValue[] {
  const next = cells.slice();
  if (brush) return applyBrush(next, gridX, gridY, brushSize, value, width, height) ? next : cells;
  if (x < 0 || y < 0 || x >= width || y >= height || next[y * width + x] === value) return cells;
  next[y * width + x] = value;
  return next;
}

export function paintLine(
  cells: CellValue[],
  width: number,
  height: number,
  from: GridPoint,
  to: GridPoint,
  value: CellValue,
  brushSize: number,
  brush = value === null,
): CellValue[] {
  const next = cells.slice();
  let changed = false;
  const steps = Math.max(
    Math.abs(to.x - from.x),
    Math.abs(to.y - from.y),
    Math.ceil(Math.max(Math.abs(to.gridX - from.gridX), Math.abs(to.gridY - from.gridY)) * 2),
    1,
  );
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(from.x + (to.x - from.x) * ratio);
    const y = Math.round(from.y + (to.y - from.y) * ratio);
    const gridX = from.gridX + (to.gridX - from.gridX) * ratio;
    const gridY = from.gridY + (to.gridY - from.gridY) * ratio;
    if (brush) changed = applyBrush(next, gridX, gridY, brushSize, value, width, height) || changed;
    else if (x >= 0 && y >= 0 && x < width && y < height && next[y * width + x] !== value) {
      next[y * width + x] = value;
      changed = true;
    }
  }
  return changed ? next : cells;
}

export function paintBrushLine(
  cells: CellValue[],
  width: number,
  height: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  brushSize: number,
  value: CellValue = null,
): CellValue[] {
  const next = cells.slice();
  let changed = false;
  const steps = Math.max(Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * 3), 1);
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    changed = applyBrush(next, from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio, brushSize, value, width, height) || changed;
  }
  return changed ? next : cells;
}

export function collectBrushIndices(centerX: number, centerY: number, size: number, width: number, height: number): number[] {
  if (size <= 0.5) {
    const x = Math.floor(centerX);
    const y = Math.floor(centerY);
    return x >= 0 && y >= 0 && x < width && y < height ? [y * width + x] : [];
  }
  const diameter = Math.max(1, Math.round(size));
  const radius = diameter / 2;
  const minX = Math.max(0, Math.floor(centerX - radius - 0.5));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius - 0.5));
  const minY = Math.max(0, Math.floor(centerY - radius - 0.5));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius - 0.5));
  const indices: number[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (circleIntersectsCell(centerX, centerY, radius, x, y)) indices.push(y * width + x);
    }
  }
  return indices;
}

export function floodFill(cells: CellValue[], width: number, height: number, x: number, y: number, selectedColorId: string): CellValue[] {
  const next = cells.slice();
  const startIndex = y * width + x;
  const target = next[startIndex];
  if (target === selectedColorId) return next;
  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (next[index] !== target) continue;
    next[index] = selectedColorId;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

export function collectFloodFillIndices(
  cells: CellValue[],
  width: number,
  height: number,
  x: number,
  y: number,
  selectedColorId: string,
): number[] {
  const startIndex = y * width + x;
  const target = cells[startIndex];
  if (target === selectedColorId) return [startIndex];
  return collectConnectedCellIndices(cells, width, height, x, y);
}

export function collectConnectedCellIndices(cells: CellValue[], width: number, height: number, x: number, y: number): number[] {
  const startIndex = y * width + x;
  const target = cells[startIndex];
  const seen = new Set<number>();
  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (seen.has(index) || cells[index] !== target) continue;
    seen.add(index);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return [...seen];
}

export function collectSameColorIndices(cells: CellValue[], x: number, y: number, width: number): number[] {
  const target = cells[y * width + x];
  if (!target) return [];
  return cells.flatMap((colorId, index) => (colorId === target ? [index] : []));
}

export function collectConnectedOccupiedIndices(cells: CellValue[], width: number, height: number, x: number, y: number): number[] {
  const startIndex = y * width + x;
  if (!cells[startIndex]) return [];
  const seen = new Set<number>();
  const stack = [[x, y]];
  const neighbors = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (seen.has(index) || !cells[index]) continue;
    seen.add(index);
    neighbors.forEach(([dx, dy]) => stack.push([cx + dx, cy + dy]));
  }
  return [...seen];
}

export function collectRemoveIndices(cells: CellValue[], width: number, height: number, x: number, y: number, mode: RemoveMode): number[] {
  if (mode === 'same-connected') return collectConnectedCellIndices(cells, width, height, x, y);
  if (mode === 'all-same-color') return collectSameColorIndices(cells, x, y, width);
  return collectConnectedOccupiedIndices(cells, width, height, x, y);
}

export function createClipboardPattern(cells: CellValue[], width: number, indices: number[]): ClipboardPattern {
  if (indices.length === 0) return { width: 0, height: 0, cells: [] };
  let minX = width;
  let maxX = -1;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = -1;
  indices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  const patternWidth = maxX - minX + 1;
  const patternHeight = maxY - minY + 1;
  const patternCells = Array<CellValue>(patternWidth * patternHeight).fill(null);
  indices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    patternCells[(y - minY) * patternWidth + (x - minX)] = colorId;
  });
  return { width: patternWidth, height: patternHeight, cells: patternCells };
}

export function pasteClipboardPattern(
  cells: CellValue[],
  width: number,
  height: number,
  pattern: ClipboardPattern,
  startX: number,
  startY: number,
): CellValue[] {
  const next = cells.slice();
  pattern.cells.forEach((colorId, index) => {
    if (!colorId) return;
    const x = startX + (index % pattern.width);
    const y = startY + Math.floor(index / pattern.width);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    next[y * width + x] = colorId;
  });
  return next;
}

export function shiftCells(cells: CellValue[], width: number, height: number, dx: number, dy: number, selectionIndices: number[] = []): CellValue[] {
  if (dx === 0 && dy === 0) return cells;
  const moveIndices = selectionIndices.length > 0 ? selectionIndices : cells.flatMap((colorId, index) => (colorId ? [index] : []));
  const next = selectionIndices.length > 0 ? cells.slice() : Array<CellValue>(width * height).fill(null);
  if (selectionIndices.length > 0) moveIndices.forEach((index) => { next[index] = null; });
  moveIndices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return;
    next[nextY * width + nextX] = colorId;
  });
  return next;
}

export function clampShiftDelta(
  cells: CellValue[],
  width: number,
  height: number,
  dx: number,
  dy: number,
  selectionIndices: number[] = [],
): { dx: number; dy: number } {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  const moveIndices = selectionIndices.length > 0 ? selectionIndices : cells.flatMap((colorId, index) => (colorId ? [index] : []));
  moveIndices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  if (maxX < 0 || maxY < 0) return { dx: 0, dy: 0 };
  return {
    dx: Math.min(width - 1 - maxX, Math.max(-minX, dx)),
    dy: Math.min(height - 1 - maxY, Math.max(-minY, dy)),
  };
}

export function canShiftSelection(cells: CellValue[], width: number, height: number, dx: number, dy: number, selectionIndices: number[]): boolean {
  const selected = new Set(selectionIndices);
  return selectionIndices.every((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return false;
    const nextIndex = nextY * width + nextX;
    return selected.has(nextIndex) || !cells[nextIndex];
  });
}

export function mirrorCells(
  cells: CellValue[],
  width: number,
  height: number,
  direction: MirrorDirection,
  selectionIndices: number[] = [],
): CellValue[] {
  const moveIndices = selectionIndices.length > 0 ? selectionIndices : cells.flatMap((colorId, index) => (colorId ? [index] : []));
  if (moveIndices.length === 0) return cells;
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  moveIndices.forEach((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  const selected = new Set(moveIndices);
  const next = selectionIndices.length > 0 ? cells.slice() : Array<CellValue>(width * height).fill(null);
  if (selectionIndices.length > 0) {
    const canMirror = moveIndices.every((index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      const nextX = direction === 'horizontal' ? minX + maxX - x : x;
      const nextY = direction === 'vertical' ? minY + maxY - y : y;
      const nextIndex = nextY * width + nextX;
      return selected.has(nextIndex) || !cells[nextIndex];
    });
    if (!canMirror) return cells;
    moveIndices.forEach((index) => { next[index] = null; });
  }
  moveIndices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    const nextX = direction === 'horizontal' ? minX + maxX - x : x;
    const nextY = direction === 'vertical' ? minY + maxY - y : y;
    next[nextY * width + nextX] = colorId;
  });
  return next;
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const error2 = 2 * error;
    if (error2 >= dy) { error += dy; x += sx; }
    if (error2 <= dx) { error += dx; y += sy; }
  }
  return points;
}

function applyBrush(cells: CellValue[], centerX: number, centerY: number, size: number, value: CellValue, width: number, height: number): boolean {
  if (size <= 0.5) {
    const x = Math.floor(centerX);
    const y = Math.floor(centerY);
    if (x < 0 || y < 0 || x >= width || y >= height || cells[y * width + x] === value) return false;
    cells[y * width + x] = value;
    return true;
  }
  const diameter = Math.max(1, Math.round(size));
  const radius = diameter / 2;
  const minX = Math.max(0, Math.floor(centerX - radius - 0.5));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius - 0.5));
  const minY = Math.max(0, Math.floor(centerY - radius - 0.5));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius - 0.5));
  let changed = false;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const closestX = Math.max(x + 0.3, Math.min(x + 0.7, centerX));
      const closestY = Math.max(y + 0.3, Math.min(y + 0.7, centerY));
      if ((closestX - centerX) ** 2 + (closestY - centerY) ** 2 <= radius ** 2 && cells[y * width + x] !== value) {
        cells[y * width + x] = value;
        changed = true;
      }
    }
  }
  return changed;
}

function circleIntersectsCell(centerX: number, centerY: number, radius: number, cellX: number, cellY: number): boolean {
  const activationInset = 0.3;
  const closestX = Math.max(cellX + activationInset, Math.min(cellX + 1 - activationInset, centerX));
  const closestY = Math.max(cellY + activationInset, Math.min(cellY + 1 - activationInset, centerY));
  const dx = closestX - centerX;
  const dy = closestY - centerY;
  return dx * dx + dy * dy <= radius * radius;
}
