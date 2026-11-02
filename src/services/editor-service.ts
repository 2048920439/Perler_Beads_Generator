import { BehaviorSubject } from 'rxjs';
import { singleton } from '@/service-core/di';
import { BaseService } from '@/service-core/base-service';
import type { BeadLayer, BeadProject, ConvertResult, ProjectSettings } from '@/common/types';
import { getColor } from './domain/palette';
import { composeVisibleCells, createLayer, createProject, normalizeProject, resizeCells } from './domain/project';
import { applyCellEdit, moveLayers, replaceLayers, sameCells, type CellCommand, type LayerChanges, type LayerMoveTarget } from './domain/editing';
import { clampInteger } from './domain/adjustment-operations';
import { canShiftSelection, clampShiftDelta, type CellValue } from './domain/workspace/cell-operations';
import { ProjectService } from './project-service';

export type EditResult =
  | { status: 'applied' | 'unchanged'; affected?: number }
  | { status: 'rejected'; reason: 'locked' | 'invalid-input' | 'stale-revision' | 'invalid-session' | 'empty-history' };
export type EditHandle = Readonly<{ token: symbol }>;
type ShiftPreview = { dx: number; dy: number; indices: number[]; cells: CellValue[] };
type EditSession = {
  handle: EditHandle; base: BeadProject; layerId: string; updatedAt: string;
  shiftPreview?: ShiftPreview;
};
const unchanged = (): EditResult => ({ status: 'unchanged' });
const rejected = (reason: Extract<EditResult, { status: 'rejected' }>['reason']): EditResult => ({ status: 'rejected', reason });

@singleton()
export class EditorService extends BaseService {
  private session: EditSession | null = null;
  private readonly sessionState = new BehaviorSubject<EditHandle | null>(null);
  readonly session$ = this.sessionState.asObservable();

  constructor(private readonly projectService: ProjectService) { super(); }

  get project(): BeadProject { return this.projectService.snapshot.project; }
  get revision(): number { return this.projectService.snapshot.revision; }
  get activeLayer(): BeadLayer { return this.projectService.activeLayer; }

  beginEdit(): EditHandle | null {
    this.finishCurrentEdit();
    if (this.activeLayer.locked) return null;
    const handle = Object.freeze({ token: Symbol('edit') });
    this.session = { handle, base: this.project, layerId: this.project.activeLayerId, updatedAt: this.project.updatedAt };
    this.sessionState.next(handle);
    return handle;
  }

  isEditActive(handle: EditHandle): boolean { return this.session?.handle === handle; }

  updateEdit(handle: EditHandle, command: CellCommand): EditResult {
    if (!this.session || this.session.handle !== handle) return rejected('invalid-session');
    if (this.activeLayer.id !== this.session.layerId) return rejected('invalid-session');
    return this.applyCells(command);
  }

  execute(command: CellCommand): EditResult {
    this.finishCurrentEdit();
    const base = this.project;
    const result = this.applyCells(command);
    if (result.status === 'applied') this.projectService.recordHistory(base);
    return result;
  }

  finishEdit(handle: EditHandle): EditResult {
    if (this.session?.handle !== handle) return rejected('invalid-session');
    const { base, layerId, updatedAt } = this.session;
    this.session = null;
    const currentCells = this.activeLayer.cells;
    const baseCells = base.layers.find((layer) => layer.id === layerId)?.cells ?? [];
    const changed = !sameCells(baseCells, currentCells);
    if (changed) this.projectService.recordHistory(base);
    else if (this.project.updatedAt !== updatedAt) this.projectService.publish({ ...this.project, updatedAt }, undefined, false);
    this.sessionState.next(null);
    return { status: changed ? 'applied' : 'unchanged' };
  }

  cancelEdit(handle: EditHandle): EditResult {
    if (this.session?.handle !== handle) return rejected('invalid-session');
    const { base, layerId, updatedAt } = this.session;
    this.session = null;
    const baseCells = base.layers.find((layer) => layer.id === layerId)?.cells;
    const changed = baseCells && !sameCells(baseCells, this.activeLayer.cells);
    if (changed) {
      this.projectService.publish({ ...replaceLayers(this.project, this.project.layers.map(
        (layer) => layer.id === layerId ? { ...layer, cells: baseCells } : layer,
      )), updatedAt }, undefined, false);
    } else if (this.project.updatedAt !== updatedAt) {
      this.projectService.publish({ ...this.project, updatedAt }, undefined, false);
    }
    this.sessionState.next(null);
    return { status: changed ? 'applied' : 'unchanged' };
  }

  undo(): EditResult {
    this.finishCurrentEdit();
    if (!this.projectService.snapshot.past.length) return rejected('empty-history');
    this.projectService.undo();
    return { status: 'applied' };
  }

  redo(): EditResult {
    this.finishCurrentEdit();
    if (!this.projectService.snapshot.future.length) return rejected('empty-history');
    this.projectService.redo();
    return { status: 'applied' };
  }

  replaceDocument(project: BeadProject): EditResult {
    this.finishCurrentEdit();
    return this.commit(normalizeProject(project));
  }

  createDocument(width: number, height: number): EditResult {
    if (!Number.isInteger(width) || !Number.isInteger(height)
      || width < 1 || height < 1 || width > 180 || height > 180) return rejected('invalid-input');
    return this.replaceDocument(createProject(width, height));
  }

  updateSettings(changes: Partial<ProjectSettings>): EditResult {
    const keys = Object.keys(changes) as Array<keyof ProjectSettings>;
    const settings = this.project.settings;
    if (keys.some((key) => {
      const value = changes[key];
      if (key === 'beadsPerPack') return !Number.isInteger(value) || Number(value) < 1 || Number(value) > 10000;
      if (key === 'beadDisplayMode') return value !== 'bead' && value !== 'pixel';
      if (key === 'rightClickAction') return value !== 'pan' && value !== 'erase';
      return typeof value !== 'boolean';
    })) return rejected('invalid-input');
    if (keys.every((key) => settings[key] === changes[key])) return unchanged();
    this.projectService.publish({ ...this.project, settings: { ...settings, ...changes } });
    if (this.session) this.session.updatedAt = this.project.updatedAt;
    return { status: 'applied' };
  }

  selectLayer(layerId: string): EditResult {
    if (!this.project.layers.some((layer) => layer.id === layerId)) return rejected('invalid-input');
    this.finishCurrentEdit();
    if (this.project.activeLayerId === layerId) return unchanged();
    this.projectService.publish({ ...this.project, activeLayerId: layerId });
    return { status: 'applied' };
  }

  addLayer(name: string): EditResult {
    if (!name.trim()) return rejected('invalid-input');
    this.finishCurrentEdit();
    const layer = createLayer(this.project.width, this.project.height, name);
    return this.commit(replaceLayers(this.project, [...this.project.layers, layer], layer.id));
  }

  duplicateLayer(layerId: string, name: string): EditResult {
    if (!name.trim()) return rejected('invalid-input');
    this.finishCurrentEdit();
    const layers = this.project.layers.slice();
    const index = layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return rejected('invalid-input');
    const layer = { ...layers[index], id: createLayer(1, 1, '').id, name, customName: true, locked: false, cells: layers[index].cells.slice() };
    layers.splice(index + 1, 0, layer);
    return this.commit(replaceLayers(this.project, layers, layer.id));
  }

  updateLayer(layerId: string, changes: LayerChanges): EditResult {
    this.finishCurrentEdit();
    const layer = this.project.layers.find((item) => item.id === layerId);
    if (!layer) return rejected('invalid-input');
    const keys = Object.keys(changes) as Array<keyof LayerChanges>;
    if (keys.some((key) => {
      if (key === 'name') return typeof changes.name !== 'string' || !changes.name.trim();
      if (key === 'opacity') return !Number.isFinite(changes.opacity) || Number(changes.opacity) < 0 || Number(changes.opacity) > 1;
      return typeof changes[key] !== 'boolean';
    })) return rejected('invalid-input');
    if (keys.every((key) => layer[key] === changes[key])) return unchanged();
    return this.commit(replaceLayers(this.project, this.project.layers.map((item) => item === layer ? { ...item, ...changes } : item)));
  }

  updateUsageSelection(includedIds: Set<string>): EditResult {
    this.finishCurrentEdit();
    const layers = this.project.layers.map((layer) => layer.includeInUsage === includedIds.has(layer.id)
      ? layer : { ...layer, includeInUsage: includedIds.has(layer.id) });
    return layers.every((layer, index) => layer === this.project.layers[index])
      ? unchanged() : this.commit(replaceLayers(this.project, layers));
  }

  deleteLayer(layerId: string): EditResult {
    this.finishCurrentEdit();
    if (!this.project.layers.some((layer) => layer.id === layerId)) return rejected('invalid-input');
    if (this.project.layers.length <= 1) return unchanged();
    return this.commit(replaceLayers(this.project, this.project.layers.filter((layer) => layer.id !== layerId)));
  }

  moveLayer(sourceId: string, target: LayerMoveTarget): EditResult {
    this.finishCurrentEdit();
    if (!this.project.layers.some((layer) => layer.id === sourceId)
      || !this.project.layers.some((layer) => layer.id === target.id)
      || (target.edge !== 'before' && target.edge !== 'after')) return rejected('invalid-input');
    const layers = moveLayers(this.project.layers, sourceId, target);
    return layers === this.project.layers ? unchanged() : this.commit(replaceLayers(this.project, layers));
  }

  resizeCanvas(inputWidth: number, inputHeight: number): EditResult {
    this.finishCurrentEdit();
    if (!Number.isFinite(inputWidth) || !Number.isFinite(inputHeight)) return rejected('invalid-input');
    const width = clampInteger(inputWidth, 8, 180);
    const height = clampInteger(inputHeight, 8, 180);
    if (width === this.project.width && height === this.project.height) return unchanged();
    const layers = this.project.layers.map((layer) => ({
      ...layer, cells: resizeCells(layer.cells, this.project.width, this.project.height, width, height),
    }));
    return this.commit({ ...this.project, width, height, layers, cells: composeVisibleCells(layers, width, height) });
  }

  applyGeneratedPattern(result: ConvertResult, layerId: string, expectedRevision: number): EditResult {
    if (this.revision !== expectedRevision) return rejected('stale-revision');
    const layer = this.project.layers.find((item) => item.id === layerId);
    if (!layer || !Number.isInteger(result.width) || !Number.isInteger(result.height)
      || result.width < 1 || result.height < 1 || result.width > 180 || result.height > 180
      || result.cells.length !== result.width * result.height
      || result.cells.some((cell) => cell !== null && !getColor(cell))) return rejected('invalid-input');
    if (layer.locked) return rejected('locked');
    this.finishCurrentEdit();
    const layers = this.project.layers.map((item) => ({
      ...item, cells: item.id === layerId ? result.cells.slice()
        : resizeCells(item.cells, this.project.width, this.project.height, result.width, result.height),
    }));
    if (result.width === this.project.width && result.height === this.project.height && sameCells(layer.cells, result.cells)) return unchanged();
    return this.commit({
      ...this.project, width: result.width, height: result.height, activeLayerId: layerId,
      layers, cells: composeVisibleCells(layers, result.width, result.height),
    });
  }

  replaceColor(sourceColorId: string, colorId: string): EditResult {
    this.finishCurrentEdit();
    if (!getColor(sourceColorId) || !getColor(colorId)) return rejected('invalid-input');
    if (sourceColorId === colorId) return unchanged();
    let affected = 0;
    const layers = this.project.layers.map((layer) => {
      const visible = this.project.settings.showActiveLayerOnly ? layer.id === this.project.activeLayerId : layer.visible;
      if (layer.locked || !visible || !layer.cells.includes(sourceColorId)) return layer;
      return { ...layer, cells: layer.cells.map((cell) => {
        if (cell !== sourceColorId) return cell;
        affected += 1;
        return colorId;
      }) };
    });
    if (!affected) return unchanged();
    this.commit(replaceLayers(this.project, layers));
    return { status: 'applied', affected };
  }

  private finishCurrentEdit(): void {
    if (this.session) this.finishEdit(this.session.handle);
  }

  private commit(project: BeadProject): EditResult {
    this.projectService.publish(project, this.project);
    return { status: 'applied' };
  }

  private applyCells(command: CellCommand): EditResult {
    const layer = this.activeLayer;
    if (layer.locked) return rejected('locked');
    if (!this.validCommand(command)) return rejected('invalid-input');
    const source = (command.type === 'adjust' || command.type === 'shift'
      ? this.session?.base.layers.find((item) => item.id === layer.id)?.cells : undefined) ?? layer.cells;
    if (source.length !== this.project.width * this.project.height) return rejected('invalid-input');
    let shiftPreview: ShiftPreview | undefined;
    if (command.type === 'shift' && this.session) {
      const { dx, dy } = clampShiftDelta(source, this.project.width, this.project.height, command.dx, command.dy, command.indices);
      const previous = this.session.shiftPreview;
      if (previous?.cells === layer.cells && previous.dx === dx && previous.dy === dy
        && previous.indices.length === command.indices.length
        && previous.indices.every((index, offset) => index === command.indices[offset])) return unchanged();
      if (command.indices.length
        && !canShiftSelection(source, this.project.width, this.project.height, dx, dy, command.indices)) return unchanged();
      shiftPreview = { dx, dy, indices: command.indices.slice(), cells: source };
    }
    const result = applyCellEdit(source, this.project.width, this.project.height, command);
    const fast = command.type === 'paint' || command.type === 'line' || command.type === 'brush'
      || command.type === 'indices' || command.type === 'shape' || shiftPreview !== undefined;
    if (result.cells === layer.cells || (!fast && sameCells(result.cells, layer.cells))) return unchanged();
    if (this.session) {
      this.session.shiftPreview = shiftPreview ? { ...shiftPreview, cells: result.cells } : undefined;
    }
    this.projectService.publish(replaceLayers(this.project, this.project.layers.map(
      (item) => item === layer ? { ...layer, cells: result.cells } : item,
    )));
    return { status: 'applied', affected: result.affected };
  }

  private validCommand(command: CellCommand): boolean {
    const point = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && y >= 0 && x < this.project.width && y < this.project.height;
    const color = (value: string | null) => value === null || Boolean(getColor(value));
    const indices = (values: number[]) => values.every((index) => Number.isInteger(index) && index >= 0
      && index < this.project.width * this.project.height);
    const coordinates = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y)
      && x >= -180 && x <= this.project.width + 180 && y >= -180 && y <= this.project.height + 180;
    switch (command.type) {
      case 'paint': return coordinates(command.input.x, command.input.y) && Number.isInteger(command.input.x)
        && Number.isInteger(command.input.y) && coordinates(command.input.gridX, command.input.gridY) && Number.isFinite(command.input.brushSize)
        && command.input.brushSize >= 0 && command.input.brushSize <= 180 && color(command.input.value);
      case 'line': return coordinates(command.input.from.x, command.input.from.y) && coordinates(command.input.to.x, command.input.to.y)
        && coordinates(command.input.from.gridX, command.input.from.gridY) && coordinates(command.input.to.gridX, command.input.to.gridY)
        && Number.isFinite(command.input.brushSize)
        && command.input.brushSize >= 0 && command.input.brushSize <= 180 && color(command.input.value);
      case 'brush': return coordinates(command.from.x, command.from.y) && coordinates(command.to.x, command.to.y) && Number.isFinite(command.size)
        && command.size >= 0 && command.size <= 180;
      case 'fill': return point(command.x, command.y) && Boolean(getColor(command.colorId));
      case 'remove': return point(command.x, command.y) && ['same-connected', 'all-same-color', 'connected'].includes(command.mode);
      case 'mirror': return indices(command.indices) && ['horizontal', 'vertical'].includes(command.direction);
      case 'shift': return indices(command.indices) && Number.isInteger(command.dx) && Number.isInteger(command.dy);
      case 'indices': return indices(command.indices) && Boolean(getColor(command.colorId));
      case 'shape': return point(command.shape.start.x, command.shape.start.y) && point(command.shape.end.x, command.shape.end.y)
        && ['line', 'rectangle', 'square', 'ellipse', 'circle', 'triangle', 'arrow'].includes(command.shape.kind)
        && ['outline', 'filled'].includes(command.shape.fillMode) && ['single', 'double', 'block'].includes(command.shape.arrowKind)
        && Boolean(getColor(command.colorId));
      case 'paste': return point(command.x, command.y) && Number.isInteger(command.pattern.width)
        && Number.isInteger(command.pattern.height) && command.pattern.width > 0 && command.pattern.width <= 180
        && command.pattern.height > 0 && command.pattern.height <= 180
        && command.pattern.cells.length === command.pattern.width * command.pattern.height && command.pattern.cells.every(color);
      case 'clear': return true;
      case 'adjust': return command.palette.length > 0
        && (['brightness', 'contrast', 'saturation', 'temperature', 'hue'] as const).every((key) =>
          Number.isFinite(command.settings[key]) && Math.abs(command.settings[key]) <= (key === 'hue' ? 180 : 50));
      case 'effect': return command.palette.length > 0 && ['invert', 'grayscale', 'blackWhite'].includes(command.effect);
      case 'cleanup': return command.palette.length > 0 && Number.isFinite(command.strength);
      case 'limit': return command.palette.length > 0 && Number.isFinite(command.limit);
    }
  }
}
