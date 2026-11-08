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
import { PaletteService } from './palette-service';
import { ToolService } from './tool-service';
import { linePoints } from './domain/workspace/grid-geometry';
import { collectTextIndices } from './domain/workspace/text-rasterizer';

export type { GridPoint } from './domain/workspace/cell-operations';
export type { PaintCellInput, PaintLineInput } from './domain/editing';
export type CanvasPoint = { cell: { x: number; y: number } | null; gridX: number; gridY: number };
type OccupiedPoint = CanvasPoint & { cell: { x: number; y: number } };
type PointerEdit =
  | { kind: 'draw'; last: OccupiedPoint; singleErase: boolean }
  | { kind: 'copy'; last: OccupiedPoint; action: 'add' | 'remove'; indices: number[] }
  | { kind: 'move'; start: OccupiedPoint; cells: CellValue[]; indices: number[]; dx: number; dy: number }
  | { kind: 'shape'; shape: ShapeInput };

@singleton()
export class CanvasEditService extends BaseService {
  private gesture: EditHandle | null = null;
  private pointerEdit: PointerEdit | null = null;

  constructor(
    private readonly editor: EditorService,
    private readonly tools: ToolService,
    private readonly notice: NoticeService,
    private readonly palette: PaletteService,
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
    this.pointerEdit = null;
  }

  get movingPointer(): boolean { return this.pointerEdit?.kind === 'move'; }

  pointerAction(button: number, spaceDown: boolean): 'pan' | 'erase' | 'edit' {
    const tool = this.tools.snapshot.tool;
    const rightClickAction = tool === 'pencil' ? this.project.settings.rightClickAction : 'pan';
    if (tool === 'pan' || button === 1 || spaceDown || (button === 2 && rightClickAction === 'pan')) return 'pan';
    return button === 2 && rightClickAction === 'erase' ? 'erase' : 'edit';
  }

  startPointer(point: OccupiedPoint, displayProject: BeadProject, singleErase = false): 'draw' | 'copy' | 'move' | 'shape' | 'rightErase' | null {
    this.pointerEdit = null;
    const { cell } = point;
    const { x, y } = cell;
    const tool = this.tools.snapshot;
    const colorId = this.palette.snapshot.selectedColorId;
    const cells = this.activeLayerCells;
    const index = y * this.project.width + x;
    if (!singleErase && tool.tool === 'eyedropper') {
      const color = this.getTopVisibleColor(displayProject, index);
      if (color) {
        this.palette.selectColor(color);
        this.tools.setTool('pencil');
        this.tools.closeOptions();
        this.notice.show((text) => text.colorPicked);
      }
      return null;
    }
    if (!singleErase && tool.tool === 'copy') {
      if (!cells[index]) return null;
      if (tool.copyMode === 'selection') {
        const action = tool.copySelectionIndices.includes(index) ? 'remove' : 'add';
        const { indices } = this.updateCopySelection([cell], action, tool.copySelectionIndices);
        this.pointerEdit = { kind: 'copy', last: point, action, indices };
        return 'copy';
      }
      const pattern = this.createClipboardPattern(cells, this.collectConnectedOccupied(cells, x, y));
      if (pattern.cells.some(Boolean)) this.tools.copyPattern(pattern);
      return null;
    }
    if (!singleErase && tool.tool === 'recolor') {
      const source = this.getTopVisibleColor(displayProject, index);
      if (source && source !== colorId) this.replaceColor(source, colorId);
      return null;
    }
    if (!this.canEdit) return null;
    if (!singleErase && tool.tool === 'paste') {
      if (!tool.clipboardPattern) return null;
      this.beginGesture();
      this.paste(tool.clipboardPattern, x, y);
      this.finishGesture();
      return null;
    }
    if (!singleErase && (tool.tool === 'move' || tool.tool === 'mirror')) {
      if (!cells[index]) return null;
      const partial = tool.tool === 'move' ? tool.moveMode === 'partial' : tool.mirrorMode === 'partial';
      const indices = partial ? this.collectConnectedOccupied(cells, x, y) : [];
      this.beginGesture();
      if (tool.tool === 'mirror') {
        this.mirror(tool.mirrorDirection, indices);
        this.finishGesture();
        return null;
      }
      this.pointerEdit = { kind: 'move', start: point, cells, indices, dx: 0, dy: 0 };
      return 'move';
    }
    if (!singleErase && tool.tool === 'shape') {
      this.beginGesture();
      this.pointerEdit = { kind: 'shape', shape: {
        kind: tool.shapeKind, fillMode: tool.shapeFillMode, arrowKind: tool.arrowKind, start: cell, end: cell,
      } };
      return 'shape';
    }
    if (!singleErase && tool.tool === 'text') {
      const indices = collectTextIndices(tool.textToolValue, tool.textToolDirection, tool.textToolSize,
        tool.textToolSpacing, x, y, this.project.width, this.project.height);
      if (indices.length) {
        this.beginGesture();
        this.applyText(indices, colorId);
        this.finishGesture();
      }
      return null;
    }
    if (!singleErase && tool.tool === 'remove' && !cells[index]) return null;
    this.beginGesture();
    if (!singleErase && tool.tool === 'fill') {
      this.fill(x, y, colorId);
      this.finishGesture();
      return null;
    }
    if (!singleErase && tool.tool === 'remove') {
      this.remove(x, y, tool.removeMode);
      this.finishGesture();
      return null;
    }
    const value = singleErase || tool.tool === 'eraser' ? null : colorId;
    this.paintCell({ x, y, gridX: point.gridX, gridY: point.gridY, value, brushSize: tool.eraserSize,
      brush: value === null && !singleErase });
    this.pointerEdit = { kind: 'draw', last: point, singleErase };
    return singleErase ? 'rightErase' : 'draw';
  }

  movePointer(point: CanvasPoint): ShapeInput | null {
    const edit = this.pointerEdit;
    if (!edit) return null;
    const tool = this.tools.snapshot;
    if (edit.kind === 'shape') {
      if (point.cell) edit.shape = { ...edit.shape, end: point.cell };
      return edit.shape;
    }
    if (edit.kind === 'move') {
      const proposedDx = Math.floor(point.gridX) - Math.floor(edit.start.gridX);
      const proposedDy = Math.floor(point.gridY) - Math.floor(edit.start.gridY);
      const { dx, dy } = this.clampShift(edit.cells, proposedDx, proposedDy, edit.indices);
      if (edit.indices.length && !this.canShift(edit.cells, dx, dy, edit.indices)) return null;
      if (dx !== edit.dx || dy !== edit.dy) {
        edit.dx = dx;
        edit.dy = dy;
        this.shift(dx, dy, edit.indices);
      }
      return null;
    }
    if (edit.kind === 'copy') {
      if (point.cell) {
        edit.indices = this.updateCopySelection(linePoints(edit.last.cell.x, edit.last.cell.y, point.cell.x, point.cell.y),
          edit.action, edit.indices).indices;
        edit.last = { ...point, cell: point.cell };
      }
      return null;
    }
    if (tool.tool === 'eraser' && !edit.singleErase) {
      this.paintBrushLine({ x: edit.last.gridX, y: edit.last.gridY }, { x: point.gridX, y: point.gridY }, tool.eraserSize);
      edit.last = { ...point, cell: point.cell ?? edit.last.cell };
    } else if (point.cell) {
      const value = edit.singleErase || tool.tool === 'eraser' ? null : this.palette.snapshot.selectedColorId;
      this.paintLine({
        from: { ...edit.last.cell, gridX: edit.last.gridX, gridY: edit.last.gridY },
        to: { ...point.cell, gridX: point.gridX, gridY: point.gridY }, value,
        brushSize: tool.eraserSize, brush: value === null && !edit.singleErase,
      });
      edit.last = { ...point, cell: point.cell };
    }
    return null;
  }

  finishPointer(): void {
    if (this.pointerEdit?.kind === 'shape') this.applyShape(this.pointerEdit.shape, this.palette.snapshot.selectedColorId);
    this.finishGesture();
    this.pointerEdit = null;
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
