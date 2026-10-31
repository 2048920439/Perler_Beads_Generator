import type { BeadLayer, BeadProject } from '@/common/types';
import { composeVisibleCells, createLayer, withLayers } from '@/core/project';
import { distinctUntilChanged, map } from 'rxjs';
import { clampInteger } from '@/features/adjustments/colorOperations';
import { layerDisplayName } from '@/features/layers/layerLabels';
import { BaseService } from '@/service-core/base-service';
import { ProjectService } from './project-service';
import { LocalizationService } from './localization-service';

export type LayerMoveTarget = { id: string; edge: 'before' | 'after' };

export class LayerService extends BaseService {
  private soloVisibilitySnapshot: Record<string, boolean> | null = null;

  constructor(private readonly projectService: ProjectService, private readonly localization: LocalizationService) {
    super();
  }

  get project(): BeadProject {
    return this.projectService.snapshot.project;
  }

  get layers(): BeadLayer[] {
    return this.project.layers?.length ? this.project.layers : [];
  }

  addLayer(name = `${this.localization.text.layers} ${this.layers.length + 1}`): void {
    const project = this.project;
    const nextLayer = createLayer(project.width, project.height, name);
    this.commit();
    this.projectService.replace(withLayers(project, [...this.layers, nextLayer], nextLayer.id));
  }

  duplicateLayer(layerId: string): void {
    const project = this.project;
    const sourceIndex = this.layers.findIndex((layer) => layer.id === layerId);
    const source = this.layers[sourceIndex];
    if (!source) return;
    const nextLayer: BeadLayer = {
      ...source,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: this.uniqueDuplicateName(layerDisplayName(source, sourceIndex, this.localization.language)),
      customName: true,
      locked: false,
      cells: source.cells.slice(),
    };
    const nextLayers = this.layers.slice();
    nextLayers.splice(sourceIndex + 1, 0, nextLayer);
    this.commit();
    this.projectService.replace(withLayers(project, nextLayers, nextLayer.id));
  }

  updateLayer(layerId: string, changes: Partial<BeadLayer>): void {
    const current = this.layers.find((layer) => layer.id === layerId);
    if (!current || (Object.keys(changes) as Array<keyof BeadLayer>).every((key) => current[key] === changes[key])) return;
    const nextLayers = this.layers.map((layer) => (layer.id === layerId ? { ...layer, ...changes } : layer));
    if (nextLayers.every((layer, index) => layer === this.layers[index])) return;
    this.commit();
    this.projectService.replace(withLayers(this.project, nextLayers));
  }

  updateUsageSelection(includedLayerIds: Set<string>): void {
    const nextLayers = this.layers.map((layer) => ({
      ...layer,
      includeInUsage: includedLayerIds.has(layer.id),
    }));
    if (nextLayers.every((layer, index) => layer.includeInUsage === this.layers[index].includeInUsage)) return;
    this.commit();
    this.projectService.replace(withLayers(this.project, nextLayers));
  }

  toggleActiveLayerOnly(): void {
    const project = this.project;
    const shouldEnable = !project.settings.showActiveLayerOnly;
    if (shouldEnable) this.soloVisibilitySnapshot = Object.fromEntries(this.layers.map((layer) => [layer.id, layer.visible]));
    const layers = this.layers.map((layer) => ({
      ...layer,
      visible: shouldEnable ? layer.id === project.activeLayerId : this.soloVisibilitySnapshot?.[layer.id] ?? layer.visible,
    }));
    if (!shouldEnable) this.soloVisibilitySnapshot = null;
    this.projectService.replace({
      ...project,
      settings: { ...project.settings, showActiveLayerOnly: shouldEnable },
      layers,
      cells: composeVisibleCells(layers, project.width, project.height),
    });
  }

  deleteLayer(layerId: string): void {
    if (this.layers.length <= 1 || !this.layers.some((layer) => layer.id === layerId)) return;
    this.commit();
    this.projectService.replace(withLayers(this.project, this.layers.filter((layer) => layer.id !== layerId)));
  }

  moveLayer(sourceId: string, target: LayerMoveTarget): void {
    if (sourceId === target.id) return;
    const displayLayers = [...this.layers].reverse();
    const sourceIndex = displayLayers.findIndex((layer) => layer.id === sourceId);
    if (sourceIndex < 0) return;
    const [movedLayer] = displayLayers.splice(sourceIndex, 1);
    const targetIndex = displayLayers.findIndex((layer) => layer.id === target.id);
    if (!movedLayer || targetIndex < 0) return;
    displayLayers.splice(target.edge === 'after' ? targetIndex + 1 : targetIndex, 0, movedLayer);
    if (displayLayers.map((layer) => layer.id).join('|') === [...this.layers].reverse().map((layer) => layer.id).join('|')) return;
    this.commit();
    this.projectService.replace(withLayers(this.project, displayLayers.reverse()));
  }

  selectLayer(layerId: string): void {
    const project = this.project;
    if (!this.layers.some((layer) => layer.id === layerId)) return;
    if (!project.settings.showActiveLayerOnly) {
      this.projectService.replace({ ...project, activeLayerId: layerId });
      return;
    }
    const layers = this.layers.map((layer) => ({ ...layer, visible: layer.id === layerId }));
    this.projectService.replace({
      ...project,
      activeLayerId: layerId,
      layers,
      cells: composeVisibleCells(layers, project.width, project.height),
    });
  }

  setBeadsPerPack(value: number): void {
    this.projectService.replace({
      ...this.project,
      settings: { ...this.project.settings, beadsPerPack: clampInteger(value, 1, 10000) },
    });
  }

  renameLayer(layer: BeadLayer, index: number, name: string): void {
    const nextName = name.trim();
    if (!nextName) return;
    const systemName = nextName === `图层 ${index + 1}` || nextName === `Layer ${index + 1}`;
    if (systemName && !layer.customName) return;
    this.updateLayer(layer.id, { name: nextName, customName: !systemName });
  }

  resetSoloVisibilitySnapshot(): void {
    this.soloVisibilitySnapshot = null;
  }

  protected onActivate(): void {
    this.own(this.projectService.snapshot$.pipe(
      map(({ project }) => project.createdAt), distinctUntilChanged(),
    ).subscribe(() => this.resetSoloVisibilitySnapshot()));
  }

  private uniqueDuplicateName(baseName: string): string {
    const suffix = this.localization.language === 'zh' ? '复制' : 'copy';
    const names = new Set(this.layers.map((layer, index) => layerDisplayName(layer, index, this.localization.language)));
    for (let index = 1; index < 1000; index += 1) {
      const candidate = `${baseName}-${suffix}${index}`;
      if (!names.has(candidate)) return candidate;
    }
    return `${baseName}-${suffix}${Date.now()}`;
  }

  private commit(): void {
    this.projectService.commitHistory();
  }
}
