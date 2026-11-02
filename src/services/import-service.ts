import { BehaviorSubject, fromEvent } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import type { BackgroundMode, BeadProject, ConvertOptions, ConvertResult, GenerationStyle } from '@/common/types';
import { defaultImportSettings } from '@/config/editor';
import { createAlignedReferenceBlob, imageFileToBeads } from '@/services/domain/image-processing/imageToBeads';
import { parseProjectJson } from '@/services/domain/project';
import { BaseService } from '@/service-core/base-service';
import { EditorService } from './editor-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';
import { ReferenceImageService } from './reference-image-service';

export type ImageGenerationResult = ConvertResult & { referenceBlob: Blob };
type ImportSnapshot = {
  pendingFile: File | null; pendingImageUrl: string | null; showGridEditor: boolean; isGenerating: boolean;
  convertWidth: number; maxColors: number; tolerance: number; generationStyle: GenerationStyle; backgroundMode: BackgroundMode;
};
type ImportSettings = Pick<ImportSnapshot, 'convertWidth' | 'maxColors' | 'tolerance' | 'generationStyle' | 'backgroundMode'>;
function defaultSettings(): ImportSettings {
  return {
    convertWidth: defaultImportSettings.width, maxColors: defaultImportSettings.maxColors,
    tolerance: defaultImportSettings.tolerance, generationStyle: defaultImportSettings.generationStyle,
    backgroundMode: defaultImportSettings.backgroundMode,
  };
}

@singleton()
export class ImportService extends BaseService {
  private readonly state = new BehaviorSubject<ImportSnapshot>({
    ...defaultSettings(), pendingFile: null, pendingImageUrl: null, showGridEditor: false, isGenerating: false,
  });
  readonly snapshot$ = readonlyState(this.state);
  private generationRequestId = 0;
  private recordRequestId = 0;

  constructor(
    private readonly editor: EditorService,
    private readonly palette: PaletteService,
    private readonly reference: ReferenceImageService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) { super(); }

  get snapshot(): ImportSnapshot { return this.state.getValue(); }
  updateSettings(changes: Partial<ImportSettings>): void { this.update(changes); }
  closeGridEditor(): void { this.update({ showGridEditor: false }); }

  isSupportedImage(file: File): boolean {
    return /^image\/(png|jpeg|jpg|webp)$/.test(file.type);
  }

  openImage(file: File): void {
    if (!this.isSupportedImage(file)) {
      this.notice.show((text) => text.unsupportedImage);
      return;
    }
    this.cancelPending();
    this.update({ pendingFile: file, pendingImageUrl: URL.createObjectURL(file), showGridEditor: true });
    this.notice.show((text) => text.generatingImage(file.name));
  }

  async generate(width: number, height: number, corners: NonNullable<ConvertOptions['gridCorners']>): Promise<void> {
    const { pendingFile, maxColors, generationStyle, backgroundMode, tolerance } = this.snapshot;
    if (!pendingFile) return;
    if (this.editor.activeLayer.locked) {
      this.notice.show((text) => text.lockedCanvasHint);
      return;
    }
    const requestId = ++this.generationRequestId;
    this.update({ isGenerating: true, showGridEditor: false });
    this.notice.show((text) => text.updatingPattern);
    try {
      const result = await this.generateAndApply(pendingFile, {
        width, height, gridCorners: corners, maxColors, palette: this.palette.colors, generationStyle, backgroundMode,
        backgroundColor: [255, 255, 255], tolerance, speckleReduction: defaultImportSettings.speckleReduction,
      }, corners, this.editor.activeLayer.id, requestId);
      if (requestId !== this.generationRequestId) return;
      if (!result) {
        this.notice.show((text) => text.generationCancelled);
        return;
      }
      this.reference.setImage(pendingFile, result.referenceBlob);
      this.notice.generated(result.colorsUsed, result.totalBeads);
    } catch (error) {
      if (requestId === this.generationRequestId) this.notice.show(() => this.localizeGenerationError(error));
    } finally {
      if (requestId === this.generationRequestId) this.update({ isGenerating: false });
    }
  }

  private async generateAndApply(
    file: File,
    options: ConvertOptions,
    corners: NonNullable<ConvertOptions['gridCorners']>,
    targetLayerId: string,
    requestId: number,
  ): Promise<ImageGenerationResult | null> {
    const source = this.editor.project;
    const revision = this.editor.revision;
    const targetLayer = source.layers.find((layer) => layer.id === targetLayerId);
    if (!targetLayer || targetLayer.locked) return null;

    const result = await imageFileToBeads(file, options);
    if (requestId !== this.generationRequestId) return null;
    // A conversion must not overwrite a project edited or replaced while awaiting the image.
    if (this.editor.revision !== revision) return null;
    const referenceBlob = await createAlignedReferenceBlob(file, result.width, result.height, result.width, result.height, corners);
    if (requestId !== this.generationRequestId || this.editor.revision !== revision) return null;
    if (this.editor.applyGeneratedPattern(result, targetLayerId, revision).status === 'rejected') return null;
    return { ...result, referenceBlob };
  }

  importProjectText(raw: string): BeadProject {
    return parseProjectJson(raw);
  }

  async readProject(file: File): Promise<BeadProject | null> {
    const requestId = ++this.recordRequestId;
    let raw: string;
    try { raw = await file.text(); } catch {
      if (requestId !== this.recordRequestId) return null;
      throw new Error(this.localization.text.unreadableRecord);
    }
    if (requestId !== this.recordRequestId) return null;
    let imported: BeadProject;
    try { imported = this.importProjectText(raw); } catch { throw new Error(this.localization.text.invalidRecord); }
    return imported;
  }

  reset(): void { this.cancelPending(); this.update(defaultSettings()); }

  protected onBind(): void {
    if (typeof window === 'undefined') return;
    this.own(fromEvent<ClipboardEvent>(window, 'paste').subscribe((event) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (file) this.openImage(file);
    }));
  }

  protected onUnbind(): void { this.cancelPending(); }

  private cancelPending(): void {
    this.generationRequestId += 1;
    this.recordRequestId += 1;
    if (this.snapshot.pendingImageUrl) URL.revokeObjectURL(this.snapshot.pendingImageUrl);
    this.update({ pendingFile: null, pendingImageUrl: null, isGenerating: false, showGridEditor: false });
  }

  private update(changes: Partial<ImportSnapshot>): void {
    this.state.next({ ...this.snapshot, ...changes });
  }

  private localizeGenerationError(error: unknown): string {
    if (!(error instanceof Error)) return this.localization.text.generationFailed;
    if (error.message === 'CANVAS_UNAVAILABLE') return this.localization.text.canvasUnavailable;
    if (error.message === 'REFERENCE_IMAGE_CREATE_FAILED') return this.localization.text.referenceImageCreateFailed;
    if (error.message === 'IMAGE_LOAD_FAILED') return this.localization.text.imageLoadFailed;
    return this.localization.text.generationFailed;
  }
}
