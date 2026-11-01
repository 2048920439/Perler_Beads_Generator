import type { BeadProject, ClipboardPattern, MirrorDirection, RemoveMode } from '@/common/types';
import { BaseService } from '@/service-core/base-service';
import {
  canShiftSelection,
  clampShiftDelta,
  collectConnectedOccupiedIndices,
  collectRemoveIndices,
  createClipboardPattern,
  floodFill,
  mirrorCells,
  paintBrushLine,
  paintCell,
  paintLine,
  pasteClipboardPattern,
  shiftCells,
  type CellValue,
  type GridPoint,
} from '@/services/domain/workspace/cell-operations';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { ProjectService } from './project-service';
import { ToolService } from './tool-service';

export type { GridPoint } from '@/services/domain/workspace/cell-operations';

export type PaintCellInput = {
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  value: CellValue;
  brushSize: number;
  brush: boolean;
};

export type PaintLineInput = {
  from: GridPoint;
  to: GridPoint;
  value: CellValue;
  brushSize: number;
  brush: boolean;
};

export class CanvasEditService extends BaseService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly tools: ToolService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) {
    super();
  }

  get project(): BeadProject {
    return this.projectService.snapshot.project;
  }

  get activeLayerCells(): CellValue[] {
    return this.getActiveLayerCells(this.project);
  }

  get canEdit(): boolean {
    return !this.projectService.activeLayer.locked;
  }

  getActiveLayerCells(project: BeadProject = this.project): CellValue[] {
    return project.layers.find((layer) => layer.id === project.activeLayerId)?.cells ?? project.cells;
  }

  getTopVisibleColor(project: BeadProject, index: number): string | null {
    for (let layerIndex = project.layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
      const layer = project.layers[layerIndex];
      if (!layer.visible) continue;
      const colorId = layer.cells?.[index];
      if (colorId) return colorId;
    }
    return null;
  }

  beginGesture(): void {
    if (!this.canEdit) return;
    this.tools.closeOptions(true);
    this.projectService.commitHistory();
  }

  updateCells(cells: CellValue[]): boolean {
    if (!this.canEdit) return false;
    this.projectService.updateCells(cells);
    return true;
  }

  paintCell(input: PaintCellInput, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const next = paintCell(
      cells,
      this.project.width,
      this.project.height,
      input.x,
      input.y,
      input.value,
      input.brushSize,
      input.gridX,
      input.gridY,
      input.brush,
    );
    this.updateCells(next);
    return next;
  }

  paintLine(input: PaintLineInput, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const next = paintLine(
      cells,
      this.project.width,
      this.project.height,
      input.from,
      input.to,
      input.value,
      input.brushSize,
      input.brush,
    );
    this.updateCells(next);
    return next;
  }

  paintBrushLine(
    from: { x: number; y: number },
    to: { x: number; y: number },
    brushSize: number,
    cells: CellValue[] = this.activeLayerCells,
  ): CellValue[] {
    const next = paintBrushLine(cells, this.project.width, this.project.height, from, to, brushSize);
    this.updateCells(next);
    return next;
  }

  fill(x: number, y: number, colorId: string, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const next = floodFill(cells, this.project.width, this.project.height, x, y, colorId);
    this.updateCells(next);
    return next;
  }

  remove(x: number, y: number, mode: RemoveMode, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const startIndex = y * this.project.width + x;
    if (!cells[startIndex]) return cells;
    const next = cells.slice();
    collectRemoveIndices(cells, this.project.width, this.project.height, x, y, mode).forEach((index) => {
      next[index] = null;
    });
    this.updateCells(next);
    return next;
  }

  mirror(
    direction: MirrorDirection,
    selectionIndices: number[] = [],
    cells: CellValue[] = this.activeLayerCells,
    apply = true,
  ): CellValue[] {
    const next = mirrorCells(cells, this.project.width, this.project.height, direction, selectionIndices);
    if (apply && next !== cells) this.updateCells(next);
    return next;
  }

  shift(
    dx: number,
    dy: number,
    selectionIndices: number[] = [],
    cells: CellValue[] = this.activeLayerCells,
  ): CellValue[] {
    const next = shiftCells(cells, this.project.width, this.project.height, dx, dy, selectionIndices);
    this.updateCells(next);
    return next;
  }

  clampShift(
    cells: CellValue[],
    dx: number,
    dy: number,
    selectionIndices: number[] = [],
  ): { dx: number; dy: number } {
    return clampShiftDelta(cells, this.project.width, this.project.height, dx, dy, selectionIndices);
  }

  canShift(cells: CellValue[], dx: number, dy: number, selectionIndices: number[]): boolean {
    return canShiftSelection(cells, this.project.width, this.project.height, dx, dy, selectionIndices);
  }

  collectConnectedOccupied(cells: CellValue[], x: number, y: number): number[] {
    return collectConnectedOccupiedIndices(cells, this.project.width, this.project.height, x, y);
  }

  createClipboardPattern(cells: CellValue[], indices: number[]): ClipboardPattern {
    return createClipboardPattern(cells, this.project.width, indices);
  }

  updateCopySelection(
    points: Array<{ x: number; y: number }>,
    action: 'add' | 'remove',
    currentIndices: number[],
  ): { indices: number[]; pattern: ClipboardPattern | null } {
    const cells = this.activeLayerCells;
    const selected = new Set(currentIndices);
    let changed = false;
    points.forEach(({ x, y }) => {
      if (x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) return;
      const index = y * this.project.width + x;
      if (!cells[index]) return;
      if (action === 'add') {
        if (!selected.has(index)) {
          selected.add(index);
          changed = true;
        }
      } else if (selected.delete(index)) {
        changed = true;
      }
    });
    if (!changed) return { indices: currentIndices, pattern: this.tools.snapshot.clipboardPattern };
    const indices = [...selected].filter((index) => Boolean(cells[index]));
    const pattern = indices.length > 0 ? this.createClipboardPattern(cells, indices) : null;
    this.tools.updateCopySelection(indices, pattern);
    return { indices, pattern };
  }

  paste(pattern: ClipboardPattern, x: number, y: number, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const next = pasteClipboardPattern(cells, this.project.width, this.project.height, pattern, x, y);
    if (this.updateCells(next)) this.notice.show(this.localization.text.pastedPattern);
    return next;
  }

  applyIndices(indices: number[], colorId: string, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    const next = cells.slice();
    indices.forEach((index) => {
      next[index] = colorId;
    });
    this.updateCells(next);
    return next;
  }

  applyShape(indices: number[], colorId: string, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    return this.applyIndices(indices, colorId, cells);
  }

  applyText(indices: number[], colorId: string, cells: CellValue[] = this.activeLayerCells): CellValue[] {
    return this.applyIndices(indices, colorId, cells);
  }

  replaceColor(sourceColorId: string, selectedColorId: string): number {
    const changed = this.projectService.replaceColor(sourceColorId, selectedColorId);
    if (changed) this.notice.show(this.localization.text.recoloredBeads(changed));
    return changed;
  }
}
