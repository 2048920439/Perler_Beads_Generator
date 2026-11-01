import { BehaviorSubject, fromEvent } from 'rxjs';
import type { BackgroundMode, BeadProject, ConvertOptions, ConvertResult, GenerationStyle } from '@/common/types';
import { defaultImportSettings } from '@/config/editor';
import { createAlignedReferenceBlob, imageFileToBeads } from '@/services/domain/image-processing/imageToBeads';
import { composeVisibleCells, normalizeProject, parseProjectJson, resizeCells } from '@/services/domain/project';
import { BaseService } from '@/service-core/base-service';
import { ProjectService } from './project-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';
import { ReferenceImageService } from './reference-image-service';
import { LayerService } from './layer-service';

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

export class ImageImportService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<ImportSnapshot>({
    ...defaultSettings(), pendingFile: null, pendingImageUrl: null, showGridEditor: false, isGenerating: false,
  });
  private generationRequestId = 0;
  private recordRequestId = 0;

  constructor(
    private readonly projectService: ProjectService,
    private readonly palette: PaletteService,
    private readonly reference: ReferenceImageService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
    private readonly layers: LayerService,
  ) { super(); }

  get snapshot(): ImportSnapshot { return this.snapshot$.getValue(); }
  updateSettings(changes: Partial<ImportSettings>): void { this.update(changes); }
  closeGridEditor(): void { this.update({ showGridEditor: false }); }

  isSupportedImage(file: File): boolean {
    return /^image\/(png|jpeg|jpg|webp)$/.test(file.type);
  }

  openImage(file: File): void {
    if (!this.isSupportedImage(file)) {
      this.notice.show(this.localization.text.unsupportedImage);
      return;
    }
    this.cancelPending();
    this.update({ pendingFile: file, pendingImageUrl: URL.createObjectURL(file), showGridEditor: true });
    this.notice.show(this.localization.text.generatingImage(file.name));
  }

  async generate(width: number, height: number, corners: NonNullable<ConvertOptions['gridCorners']>): Promise<void> {
    const { pendingFile, maxColors, generationStyle, backgroundMode, tolerance } = this.snapshot;
    if (!pendingFile) return;
    if (this.projectService.activeLayer.locked) {
      this.notice.show(this.localization.text.lockedCanvasHint);
      return;
    }
    const requestId = ++this.generationRequestId;
    this.update({ isGenerating: true, showGridEditor: false });
    this.notice.show(this.localization.text.updatingPattern);
    try {
      const result = await this.generateAndApply(pendingFile, {
        width, height, gridCorners: corners, maxColors, palette: this.palette.colors, generationStyle, backgroundMode,
        backgroundColor: [255, 255, 255], tolerance, speckleReduction: defaultImportSettings.speckleReduction,
      }, corners, this.projectService.activeLayer.id, requestId);
      if (requestId !== this.generationRequestId) return;
      if (!result) {
        this.notice.show(this.localization.text.generationCancelled);
        return;
      }
      this.reference.setImage(pendingFile, result.referenceBlob);
      this.notice.generated(result.colorsUsed, result.totalBeads);
    } catch (error) {
      if (requestId === this.generationRequestId) this.notice.show(error instanceof Error ? error.message : 'Could not generate this image.');
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
    const source = this.projectService.snapshot.project;
    const targetLayer = source.layers.find((layer) => layer.id === targetLayerId);
    if (!targetLayer || targetLayer.locked) return null;

    const result = await imageFileToBeads(file, options);
    if (requestId !== this.generationRequestId) return null;
    // A conversion must not overwrite a project edited or replaced while awaiting the image.
    if (this.projectService.snapshot.project !== source) return null;
    const referenceBlob = await createAlignedReferenceBlob(file, result.width, result.height, result.width, result.height, corners);
    if (requestId !== this.generationRequestId || this.projectService.snapshot.project !== source) return null;

    const layers = source.layers.map((layer) => ({
      ...layer,
      cells:
        layer.id === targetLayerId
          ? resizeCells(result.cells, result.width, result.height, result.width, result.height)
          : resizeCells(layer.cells, source.width, source.height, result.width, result.height),
    }));
    this.projectService.commitHistory();
    this.projectService.replace({
      ...source,
      width: result.width,
      height: result.height,
      activeLayerId: targetLayerId,
      layers,
      cells: composeVisibleCells(layers, result.width, result.height),
    });
    return { ...result, referenceBlob };
  }

  importProjectText(raw: string): BeadProject {
    return normalizeProject(parseProjectJson(raw));
  }

  async importRecord(file: File): Promise<void> {
    const requestId = ++this.recordRequestId;
    let raw: string;
    try { raw = await file.text(); } catch {
      if (requestId !== this.recordRequestId) return;
      throw new Error(this.localization.text.unreadableRecord);
    }
    if (requestId !== this.recordRequestId) return;
    let imported: BeadProject;
    try { imported = this.importProjectText(raw); } catch { throw new Error(this.localization.text.invalidRecord); }
    this.cancelPending();
    this.layers.resetSoloVisibilitySnapshot();
    this.projectService.replace(imported, { recordHistory: true });
    this.notice.show(this.localization.text.recordImported);
  }

  reset(): void { this.cancelPending(); this.update(defaultSettings()); }

  protected onActivate(): void {
    if (typeof window === 'undefined') return;
    this.own(fromEvent<ClipboardEvent>(window, 'paste').subscribe((event) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (file) this.openImage(file);
    }));
  }

  protected onDeactivate(): void { this.cancelPending(); }

  private cancelPending(): void {
    this.generationRequestId += 1;
    this.recordRequestId += 1;
    if (this.snapshot.pendingImageUrl) URL.revokeObjectURL(this.snapshot.pendingImageUrl);
    this.update({ pendingFile: null, pendingImageUrl: null, isGenerating: false, showGridEditor: false });
  }

  private update(changes: Partial<ImportSnapshot>): void {
    this.snapshot$.next({ ...this.snapshot, ...changes });
  }
}
