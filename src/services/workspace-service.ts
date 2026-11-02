import { fromEvent } from 'rxjs';
import { singleton } from '@/service-core/di';
import { BaseService } from '@/service-core/base-service';
import { ImportService } from './import-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';
import { EditorService } from './editor-service';
import { ReferenceImageService, isEditableTarget } from './reference-image-service';
import { ToolService } from './tool-service';

// Commands that coordinate a document change across otherwise independent capabilities.
@singleton()
export class WorkspaceService extends BaseService {
  constructor(
    private readonly editor: EditorService,
    private readonly images: ImportService,
    private readonly reference: ReferenceImageService,
    private readonly palette: PaletteService,
    private readonly tools: ToolService,
    private readonly notice: NoticeService,
  ) { super(); }

  startBlank(width = 52, height = 52): void {
    if (this.editor.createDocument(width, height).status !== 'applied') return;
    this.images.reset();
    this.reference.clear();
    this.tools.resetClipboard();
    this.palette.resetSelection();
    this.notice.show((text) => text.blankCanvasCreated(width, height));
  }

  clearCanvas(): void {
    if (this.editor.execute({ type: 'clear' }).status === 'applied') this.notice.show((text) => text.canvasCleared);
  }

  resizeCanvas(width: number, height: number): void {
    if (this.editor.resizeCanvas(width, height).status !== 'applied') return;
    const next = this.editor.project;
    this.notice.show((text) => text.canvasResized(next.width, next.height));
  }

  async importRecord(file: File): Promise<void> {
    const project = await this.images.readProject(file);
    if (!project) return;
    this.images.reset();
    this.reference.clear();
    this.tools.resetClipboard();
    this.palette.resetSelection();
    this.editor.replaceDocument(project);
    this.notice.show((text) => text.recordImported);
  }

  undo(): void { this.editor.undo(); }
  redo(): void { this.editor.redo(); }

  protected onBind(): void {
    if (typeof window === 'undefined') return;
    this.own(fromEvent<KeyboardEvent>(window, 'keydown').subscribe((event) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
      } else if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        this.redo();
      }
    }));
  }
}
