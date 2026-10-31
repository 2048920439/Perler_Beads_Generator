import { BehaviorSubject } from 'rxjs';
import { defaultAdjustments } from '@/config/editor';
import {
  adjustLayerCells,
  applyEffectToLayer,
  limitLayerColors,
  mergeCloseLayerColors,
  type AdjustmentSettings,
  type LayerEffect,
} from '@/features/adjustments/colorOperations';
import { withLayers } from '@/core/project';
import { BaseService } from '@/service-core/base-service';
import { ProjectService } from './project-service';
import { LocalizationService } from './localization-service';
import { NoticeService } from './notice-service';
import { PaletteService } from './palette-service';

export class AdjustmentService extends BaseService {
  readonly snapshot$ = new BehaviorSubject({
    adjustments: { ...defaultAdjustments }, colorCleanupStrength: 2, layerColorLimit: 16,
  });
  private session: {
    layerId: string; baseCells: Array<string | null>; expectedCells: Array<string | null>;
    width: number; height: number; createdAt: string;
  } | null = null;

  constructor(
    private readonly projectService: ProjectService,
    private readonly palette: PaletteService,
    private readonly localization: LocalizationService,
    private readonly notice: NoticeService,
  ) { super(); }

  setAdjustment(key: keyof AdjustmentSettings, value: number): void {
    const layer = this.getEditableLayer();
    if (!layer) return;
    const settings = { ...this.snapshot$.getValue().adjustments, [key]: value };
    if (!this.session) {
      const project = this.projectService.snapshot.project;
      this.session = {
        layerId: layer.id, baseCells: layer.cells.slice(), expectedCells: layer.cells,
        width: project.width, height: project.height, createdAt: project.createdAt,
      };
      this.projectService.commitHistory();
    }
    const cells = adjustLayerCells(this.session.baseCells, settings, this.palette.colors);
    this.replaceLayer(layer.id, cells, false);
    this.snapshot$.next({ ...this.snapshot$.getValue(), adjustments: settings });
  }

  reset(): void {
    const layer = this.getEditableLayer();
    if (!layer) return;
    const baseCells = this.session?.baseCells;
    this.endSession();
    if (baseCells) this.replaceLayer(layer.id, baseCells.slice(), false);
  }

  applyEffect(effect: LayerEffect, label: string): void {
    const layer = this.getEditableLayer();
    if (!layer) return;
    this.endSession();
    const result = applyEffectToLayer(layer.cells, this.palette.colors, effect);
    if (result.changed > 0) this.replaceLayer(layer.id, result.cells, true);
    this.notice.show(this.localization.text.effectApplied(label, result.changed));
  }

  setColorCleanupStrength(value: number): void {
    this.snapshot$.next({ ...this.snapshot$.getValue(), colorCleanupStrength: value });
  }

  cleanup(): void {
    const layer = this.getEditableLayer();
    if (!layer) return;
    this.endSession();
    const result = mergeCloseLayerColors(layer.cells, this.palette.colors, this.snapshot$.getValue().colorCleanupStrength);
    if (result.changed > 0) this.replaceLayer(layer.id, result.cells, true);
    this.notice.show(this.localization.text.layerColorsCleaned(result.changed));
  }

  setLayerColorLimit(value: number): void {
    this.snapshot$.next({ ...this.snapshot$.getValue(), layerColorLimit: value });
  }

  limitColors(): void {
    const layer = this.getEditableLayer();
    if (!layer) return;
    this.endSession();
    const limit = this.snapshot$.getValue().layerColorLimit;
    const result = limitLayerColors(layer.cells, this.palette.colors, limit);
    if (result.changed > 0) this.replaceLayer(layer.id, result.cells, true);
    this.notice.show(this.localization.text.layerColorsLimited(result.changed, limit));
  }

  protected onActivate(): void {
    this.own(this.projectService.snapshot$.subscribe(({ project }) => {
      if (!this.session) return;
      const layer = this.projectService.activeLayer;
      if (layer.id !== this.session.layerId || layer.locked || layer.cells !== this.session.expectedCells
        || project.width !== this.session.width || project.height !== this.session.height || project.createdAt !== this.session.createdAt) {
        this.endSession();
      }
    }));
  }

  protected onDeactivate(): void { this.endSession(); }

  private getEditableLayer() {
    const layer = this.projectService.activeLayer;
    if (layer.locked) { this.notice.show(this.localization.text.adjustmentLocked); return null; }
    return layer;
  }

  private endSession(): void {
    this.session = null;
    this.snapshot$.next({ ...this.snapshot$.getValue(), adjustments: { ...defaultAdjustments } });
  }

  private replaceLayer(layerId: string, cells: Array<string | null>, recordHistory: boolean): void {
    const project = this.projectService.snapshot.project;
    const layers = project.layers.map((layer) => (layer.id === layerId ? { ...layer, cells } : layer));
    if (recordHistory) this.projectService.commitHistory();
    const next = withLayers(project, layers);
    if (this.session) this.session.expectedCells = next.layers.find((layer) => layer.id === layerId)?.cells ?? cells;
    this.projectService.replace(next);
  }
}
