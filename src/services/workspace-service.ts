import { fromEvent } from 'rxjs';
import { createProject } from '@/services/domain/project';
import { BaseService } from '@/service-core/base-service';
import { ImageImportService } from './image-import-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';
import { ProjectService } from './project-service';
import { ReferenceImageService, isEditableTarget } from './reference-image-service';
import { ToolService } from './tool-service';
import type { BeadProject } from '@/common/types';

// Commands that coordinate a document change across otherwise independent capabilities.
export class WorkspaceService extends BaseService {
  constructor(
    private readonly project: ProjectService,
    private readonly images: ImageImportService,
    private readonly reference: ReferenceImageService,
    private readonly palette: PaletteService,
    private readonly tools: ToolService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) { super(); }

  startBlank(width = 52, height = 52): void {
    this.images.reset();
    this.reference.clear();
    this.tools.resetClipboard();
    this.palette.resetSelection();
    this.project.replace(createProject(width, height), { recordHistory: true });
    this.notice.show(this.localization.text.blankCanvasCreated(width, height));
  }

  clearCanvas(): void {
    if (this.project.clearCanvas()) this.notice.show(this.localization.text.canvasCleared);
  }

  resizeCanvas(width: number, height: number): void {
    if (!this.project.resizeCanvas(width, height)) return;
    const next = this.project.snapshot.project;
    this.notice.show(this.localization.text.canvasResized(next.width, next.height));
  }

  paintCell(
    cells: Array<string | null>,
    project: BeadProject,
    x: number,
    y: number,
    value: string | null,
    brushSize: number,
    gridX = x + 0.5,
    gridY = y + 0.5,
    brush = value === null,
  ): Array<string | null> {
    const next = cells.slice();
    if (brush) this.applyBrush(next, gridX, gridY, brushSize, null, project.width, project.height);
    else if (x >= 0 && y >= 0 && x < project.width && y < project.height) next[y * project.width + x] = value;
    return next;
  }

  paintLine(
    cells: Array<string | null>,
    project: BeadProject,
    from: { x: number; y: number; gridX: number; gridY: number },
    to: { x: number; y: number; gridX: number; gridY: number },
    value: string | null,
    brushSize: number,
    brush = value === null,
  ): Array<string | null> {
    const next = cells.slice();
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
      if (brush) this.applyBrush(next, gridX, gridY, brushSize, null, project.width, project.height);
      else if (x >= 0 && y >= 0 && x < project.width && y < project.height) next[y * project.width + x] = value;
    }
    return next;
  }

  paintBrushLine(
    cells: Array<string | null>,
    project: BeadProject,
    from: { x: number; y: number },
    to: { x: number; y: number },
    brushSize: number,
  ): Array<string | null> {
    const next = cells.slice();
    const steps = Math.max(Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * 3), 1);
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      this.applyBrush(next, from.x + (to.x - from.x) * ratio, from.y + (to.y - from.y) * ratio, brushSize, null, project.width, project.height);
    }
    return next;
  }

  private applyBrush(
    cells: Array<string | null>,
    centerX: number,
    centerY: number,
    size: number,
    value: string | null,
    width: number,
    height: number,
  ): void {
    if (size <= 0.5) {
      const x = Math.floor(centerX);
      const y = Math.floor(centerY);
      if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = value;
      return;
    }
    const diameter = Math.max(1, Math.round(size));
    const radius = diameter / 2;
    const minX = Math.max(0, Math.floor(centerX - radius - 0.5));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius - 0.5));
    const minY = Math.max(0, Math.floor(centerY - radius - 0.5));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius - 0.5));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const closestX = Math.max(x + 0.3, Math.min(x + 0.7, centerX));
        const closestY = Math.max(y + 0.3, Math.min(y + 0.7, centerY));
        if ((closestX - centerX) ** 2 + (closestY - centerY) ** 2 <= radius ** 2) cells[y * width + x] = value;
      }
    }
  }

  protected onActivate(): void {
    if (typeof window === 'undefined') return;
    this.own(fromEvent<KeyboardEvent>(window, 'keydown').subscribe((event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.project.redo();
        else this.project.undo();
      } else if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        this.project.redo();
      }
    }));
  }
}
