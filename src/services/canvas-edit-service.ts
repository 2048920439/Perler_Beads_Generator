import { singleton } from '@/service-core/di';
import type { BeadProject, ClipboardPattern, MirrorDirection, RemoveMode } from '@/common/types';
import { BaseService } from '@/service-core/base-service';
import {
  canShiftSelection, clampShiftDelta, collectConnectedOccupiedIndices, createClipboardPattern,
  getActiveLayerCells, getTopVisibleColor, type CellValue,
} from './domain/workspace/cell-operations';
import type { CellCommand, PaintCellInput, PaintLineInput, ShapeInput } from './domain/editing';
import { EditorService, type EditHandle } from './editor-service';
import { NoticeService } from './notice-service';
import { ToolService } from './tool-service';

export type { GridPoint } from './domain/workspace/cell-operations';
export type { PaintCellInput, PaintLineInput } from './domain/editing';

@singleton()
export class CanvasEditService extends BaseService {
  private gesture: EditHandle | null = null;

  constructor(
    private readonly editor: EditorService,
    private readonly tools: ToolService,
    private readonly notice: NoticeService,
  ) { super(); }

  get project(): BeadProject { return this.editor.project; }
  get activeLayerCells(): CellValue[] { return this.editor.activeLayer.cells; }
  get canEdit(): boolean { return !this.editor.activeLayer.locked; }
  getActiveLayerCells(project: BeadProject = this.project): CellValue[] { return getActiveLayerCells(project); }
  getTopVisibleColor(project: BeadProject, index: number): string | null { return getTopVisibleColor(project, index); }

  beginGesture(): void {
    this.gesture = this.editor.beginEdit();
    if (this.gesture) this.tools.closeOptions(true);
  }

  finishGesture(): void {
    if (this.gesture) this.editor.finishEdit(this.gesture);
    this.gesture = null;
  }

  cancelGesture(): void {
    if (this.gesture) this.editor.cancelEdit(this.gesture);
    this.gesture = null;
  }

  paintCell(input: PaintCellInput): CellValue[] { return this.apply({ type: 'paint', input }); }
  paintLine(input: PaintLineInput): CellValue[] { return this.apply({ type: 'line', input }); }
  paintBrushLine(from: { x: number; y: number }, to: { x: number; y: number }, brushSize: number): CellValue[] {
    return this.apply({ type: 'brush', from, to, size: brushSize });
  }
  fill(x: number, y: number, colorId: string): CellValue[] { return this.apply({ type: 'fill', x, y, colorId }); }
  remove(x: number, y: number, mode: RemoveMode): CellValue[] { return this.apply({ type: 'remove', x, y, mode }); }
  mirror(direction: MirrorDirection, indices: number[] = []): CellValue[] {
    return this.apply({ type: 'mirror', direction, indices });
  }
  shift(dx: number, dy: number, indices: number[] = []): CellValue[] {
    return this.apply({ type: 'shift', dx, dy, indices });
  }
  clampShift(cells: CellValue[], dx: number, dy: number, selectionIndices: number[] = []): { dx: number; dy: number } {
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
    points: Array<{ x: number; y: number }>, action: 'add' | 'remove', currentIndices: number[],
  ): { indices: number[]; pattern: ClipboardPattern | null } {
    const cells = this.activeLayerCells;
    const selected = new Set(currentIndices);
    let changed = false;
    points.forEach(({ x, y }) => {
      if (x < 0 || y < 0 || x >= this.project.width || y >= this.project.height) return;
      const index = y * this.project.width + x;
      if (!cells[index]) return;
      if (action === 'add') {
        if (!selected.has(index)) { selected.add(index); changed = true; }
      } else if (selected.delete(index)) changed = true;
    });
    if (!changed) return { indices: currentIndices, pattern: this.tools.snapshot.clipboardPattern };
    const indices = [...selected].filter((index) => Boolean(cells[index]));
    const pattern = indices.length ? this.createClipboardPattern(cells, indices) : null;
    this.tools.updateCopySelection(indices, pattern);
    return { indices, pattern };
  }

  paste(pattern: ClipboardPattern, x: number, y: number): CellValue[] {
    const before = this.activeLayerCells;
    const cells = this.apply({ type: 'paste', pattern, x, y });
    if (cells !== before) this.notice.show((text) => text.pastedPattern);
    return cells;
  }
  applyShape(shape: ShapeInput, colorId: string): CellValue[] { return this.apply({ type: 'shape', shape, colorId }); }
  applyText(indices: number[], colorId: string): CellValue[] { return this.apply({ type: 'indices', indices, colorId }); }
  replaceColor(sourceColorId: string, selectedColorId: string): number {
    const result = this.editor.replaceColor(sourceColorId, selectedColorId);
    const changed = result.status === 'applied' ? result.affected ?? 0 : 0;
    if (changed) this.notice.show((text) => text.recoloredBeads(changed));
    return changed;
  }

  private apply(command: CellCommand): CellValue[] {
    if (this.gesture) this.editor.updateEdit(this.gesture, command);
    else this.editor.execute(command);
    return this.activeLayerCells;
  }
}
