import { BehaviorSubject, distinctUntilChanged, fromEvent, map } from 'rxjs';

import type {
  ArrowKind,
  ClipboardPattern,
  CopyMode,
  MirrorDirection,
  MoveMode,
  RemoveMode,
  ShapeFillMode,
  ShapeKind,
  TextDirection,
  ToolId,
} from '@/common/types';
import { tools } from '@/config/editor';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { ProjectService } from './project-service';
import { isEditableTarget } from './reference-image-service';

export type ToolSnapshot = {
  tool: ToolId;
  eraserSize: number;
  removeMode: RemoveMode;
  moveMode: MoveMode;
  mirrorMode: MoveMode;
  mirrorDirection: MirrorDirection;
  shapeKind: ShapeKind;
  shapeFillMode: ShapeFillMode;
  arrowKind: ArrowKind;
  textToolValue: string;
  textToolDirection: TextDirection;
  textToolSize: number;
  textToolSpacing: number;
  showPencilOptions: boolean;
  showEraserOptions: boolean;
  showRemoveOptions: boolean;
  showMoveOptions: boolean;
  showMirrorOptions: boolean;
  showShapeOptions: boolean;
  showTextOptions: boolean;
  showClipboardOptions: boolean;
  showPanOptions: boolean;
  clipboardPattern: ClipboardPattern | null;
  copyMode: CopyMode;
  copySelectionIndices: number[];
};

const initialSnapshot: ToolSnapshot = {
  tool: 'pencil',
  eraserSize: 0,
  removeMode: 'same-connected',
  moveMode: 'layer',
  mirrorMode: 'layer',
  mirrorDirection: 'horizontal',
  shapeKind: 'line',
  shapeFillMode: 'outline',
  arrowKind: 'single',
  textToolValue: 'ABC',
  textToolDirection: 'horizontal',
  textToolSize: 17,
  textToolSpacing: 1,
  showPencilOptions: false,
  showEraserOptions: false,
  showRemoveOptions: false,
  showMoveOptions: false,
  showMirrorOptions: false,
  showShapeOptions: false,
  showTextOptions: false,
  showClipboardOptions: false,
  showPanOptions: false,
  clipboardPattern: null,
  copyMode: 'connected',
  copySelectionIndices: [],
};

export class ToolService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<ToolSnapshot>(initialSnapshot);

  constructor(
    private readonly projectService: ProjectService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) { super(); }

  get snapshot(): ToolSnapshot {
    return this.snapshot$.getValue();
  }

  getClipboardBeadCount(): number {
    return this.snapshot.clipboardPattern?.cells.filter(Boolean).length ?? 0;
  }

  normalizeTextSize(value: number): number {
    return Math.min(72, Math.max(5, Number(value) || 5));
  }

  normalizeTextSpacing(value: number): number {
    return Math.min(24, Math.max(0, Number(value) || 0));
  }

  activateTool(nextTool: ToolId): void {
    const current = this.snapshot;
    const closingTextOptions = nextTool === 'text' && current.tool === 'text' && current.showTextOptions;
    this.update({
      tool: nextTool,
      showPencilOptions: nextTool === 'pencil',
      showEraserOptions: nextTool === 'eraser',
      showRemoveOptions: nextTool === 'remove',
      showMoveOptions: nextTool === 'move',
      showMirrorOptions: nextTool === 'mirror',
      showShapeOptions: nextTool === 'shape',
      showTextOptions: nextTool === 'text' && !closingTextOptions,
      showClipboardOptions: nextTool === 'copy' || nextTool === 'paste',
      showPanOptions: nextTool === 'pan',
    });
  }

  setTool(tool: ToolId): void { this.update({ tool }); }
  setEraserSize(value: number): void { this.update({ eraserSize: value }); }
  setRemoveMode(value: RemoveMode): void { this.update({ removeMode: value }); }
  setMoveMode(value: MoveMode): void { this.update({ moveMode: value }); }
  setMirrorMode(value: MoveMode): void { this.update({ mirrorMode: value }); }
  setMirrorDirection(value: MirrorDirection): void { this.update({ mirrorDirection: value }); }
  setShapeFillMode(value: ShapeFillMode): void { this.update({ shapeFillMode: value }); }
  setShapeKind(value: ShapeKind): void { this.update({ shapeKind: value }); }
  setArrowKind(value: ArrowKind): void { this.update({ arrowKind: value }); }
  setTextToolValue(value: string): void { this.update({ textToolValue: value }); }
  setTextToolDirection(value: TextDirection): void { this.update({ textToolDirection: value }); }
  setTextToolSize(value: number): void { this.update({ textToolSize: value }); }
  setTextToolSpacing(value: number): void { this.update({ textToolSpacing: value }); }
  setCopyMode(value: CopyMode): void { this.update({ copyMode: value }); }
  setCopySelectionIndices(value: number[]): void { this.update({ copySelectionIndices: value }); }
  setClipboardPattern(value: ClipboardPattern | null): void { this.update({ clipboardPattern: value }); }

  setOptionVisible(
    option:
      | 'showPencilOptions'
      | 'showEraserOptions'
      | 'showRemoveOptions'
      | 'showMoveOptions'
      | 'showMirrorOptions'
      | 'showShapeOptions'
      | 'showTextOptions'
      | 'showClipboardOptions'
      | 'showPanOptions',
    value: boolean,
  ): void {
    this.update({ [option]: value });
  }

  resetClipboard(): void {
    this.update({ clipboardPattern: null, copySelectionIndices: [] });
    this.notice.show(this.localization.text.clipboardReset);
  }

  closeOptions(keepText = false): void {
    this.update({
      showPencilOptions: false, showEraserOptions: false, showRemoveOptions: false, showMoveOptions: false,
      showMirrorOptions: false, showShapeOptions: false, showTextOptions: keepText && this.snapshot.tool === 'text',
      showClipboardOptions: false, showPanOptions: false,
    });
  }

  copyPattern(pattern: ClipboardPattern, switchToPaste = true): void {
    this.update({ clipboardPattern: pattern, tool: switchToPaste ? 'paste' : this.snapshot.tool });
    this.closeOptions();
    this.notice.show(this.localization.text.copiedPattern(pattern.width, pattern.height, pattern.cells.filter(Boolean).length));
  }

  updateCopySelection(indices: number[], pattern: ClipboardPattern | null): void {
    this.update({ copySelectionIndices: indices, clipboardPattern: pattern });
    this.notice.show(pattern ? this.localization.text.copySelectionUpdated(pattern.cells.filter(Boolean).length) : this.localization.text.clipboardReset);
  }

  protected onActivate(): void {
    this.own(this.projectService.snapshot$.pipe(
      map(({ project }) => `${project.createdAt}:${project.activeLayerId}:${project.width}:${project.height}`),
      distinctUntilChanged(),
    ).subscribe(() => this.setCopySelectionIndices([])));
    if (typeof window === 'undefined') return;
    this.own(fromEvent<KeyboardEvent>(window, 'keydown').subscribe((event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.shiftKey || isEditableTarget(event.target)) return;
      const nextTool = tools.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
      if (!nextTool) return;
      event.preventDefault();
      if (nextTool.id !== this.snapshot.tool) this.activateTool(nextTool.id);
    }));
  }

  private update(changes: Partial<ToolSnapshot>): void {
    if ((Object.keys(changes) as Array<keyof ToolSnapshot>).every((key) => this.snapshot[key] === changes[key])) return;
    this.snapshot$.next({ ...this.snapshot, ...changes });
  }
}
