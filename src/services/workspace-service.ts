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
