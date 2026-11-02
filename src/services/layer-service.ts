import { singleton } from '@/service-core/di';
import type { BeadLayer, BeadProject } from '@/common/types';
import { BaseService } from '@/service-core/base-service';
import { clampInteger } from './domain/adjustment-operations';
import { EditorService } from './editor-service';
import { layerDisplayName } from './layer-rules';
import { LocalizationService } from './localization-service';
import type { LayerChanges, LayerMoveTarget } from './domain/editing';

export type { LayerMoveTarget } from './domain/editing';

@singleton()
export class LayerService extends BaseService {
  constructor(private readonly editor: EditorService, private readonly localization: LocalizationService) { super(); }

  get project(): BeadProject { return this.editor.project; }
  get layers(): BeadLayer[] { return this.project.layers; }

  addLayer(name = `${this.localization.text.layerPrefix} ${this.layers.length + 1}`): void { this.editor.addLayer(name); }
  duplicateLayer(layerId: string): void {
    const index = this.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return;
    this.editor.duplicateLayer(layerId, this.uniqueDuplicateName(layerDisplayName(this.layers[index], index, this.localization.language)));
  }
  updateLayer(layerId: string, changes: LayerChanges): void { this.editor.updateLayer(layerId, changes); }
  updateUsageSelection(includedLayerIds: Set<string>): void { this.editor.updateUsageSelection(includedLayerIds); }
  toggleUsageLayer(layerId: string): void {
    const ids = new Set(this.layers.filter((layer) => layer.includeInUsage).map((layer) => layer.id));
    if (ids.has(layerId)) ids.delete(layerId);
    else ids.add(layerId);
    this.updateUsageSelection(ids);
  }
  stepBeadsPerPack(direction: -1 | 1): void {
    const current = this.project.settings.beadsPerPack;
    const step = 500;
    const next = direction > 0
      ? current % step === 0 ? current + step : Math.ceil(current / step) * step
      : current % step === 0 ? current - step : Math.floor(current / step) * step;
    this.setBeadsPerPack(Math.max(step, next));
  }
  setBeadsPerPack(value: number): void {
    this.editor.updateSettings({ beadsPerPack: clampInteger(value, 1, 10000) });
  }
  toggleActiveLayerOnly(): void {
    this.editor.updateSettings({ showActiveLayerOnly: !this.project.settings.showActiveLayerOnly });
  }
  deleteLayer(layerId: string): void { this.editor.deleteLayer(layerId); }
  moveLayer(sourceId: string, target: LayerMoveTarget): void { this.editor.moveLayer(sourceId, target); }
  selectLayer(layerId: string): void { this.editor.selectLayer(layerId); }
  renameLayer(layer: BeadLayer, index: number, name: string): void {
    const nextName = name.trim();
    if (!nextName) return;
    const systemName = nextName === this.localization.text.layerFallbackPrefix(index)
      || nextName === `${this.localization.text.layerPrefix} ${index + 1}`;
    if (systemName && !layer.customName) return;
    this.updateLayer(layer.id, { name: nextName, customName: !systemName });
  }

  private uniqueDuplicateName(baseName: string): string {
    const suffix = this.localization.text.copySuffix;
    const names = new Set(this.layers.map((layer, index) => layerDisplayName(layer, index, this.localization.language)));
    for (let index = 1; index < 1000; index += 1) {
      const name = `${baseName}-${suffix}${index}`;
      if (!names.has(name)) return name;
    }
    return `${baseName}-${suffix}${Date.now()}`;
  }
}
