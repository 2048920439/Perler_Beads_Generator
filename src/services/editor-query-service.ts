import { BehaviorSubject, combineLatest } from 'rxjs';
import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import type { BeadLayer, BeadProject, PaletteColor, UsageRow } from '@/common/types';
import { getColor } from '@/services/domain/palette';
import { createProject, getDisplayProject } from '@/services/domain/project';
import { findIsolatedBeads, summarizeUsage } from '@/services/domain/usage';
import { BaseService } from '@/service-core/base-service';
import { LocalizationService } from './localization-service';
import { PaletteService } from './palette-service';
import { ProjectService } from './project-service';
import { WorkspaceViewService } from './workspace-view-service';
import { layerDisplayName } from './layer-rules';

export type EditorSnapshot = {
  project: BeadProject;
  past: BeadProject[];
  future: BeadProject[];
  displayProject: BeadProject;
  layers: BeadLayer[];
  activeLayer: BeadLayer;
  activeLayerName: string;
  countedLayers: BeadLayer[];
  usage: UsageRow[];
  totalBeads: number;
  totalPacks: number;
  isolatedBeads: number;
  boardCount: number;
  highlightedCellIndices: number[];
  selectedColor: PaletteColor | undefined;
  recentColors: PaletteColor[];
  paletteGroups: Array<{ id: string; label: string }>;
};

@singleton()
export class EditorQueryService extends BaseService {
  private derivedProject: BeadProject | undefined;
  private derived: {
    displayProject: BeadProject;
    usage: UsageRow[];
    isolated: Array<{ layerId: string; index: number }>;
    isolatedIndices: number[];
  } | undefined;
  private readonly state = new BehaviorSubject<EditorSnapshot>(this.buildSnapshot());
  readonly snapshot$ = readonlyState(this.state);

  constructor(
    private readonly projectService: ProjectService,
    private readonly paletteService: PaletteService,
    private readonly localization: LocalizationService,
    private readonly view: WorkspaceViewService,
  ) {
    super();
  }

  get snapshot(): EditorSnapshot {
    return this.state.getValue();
  }

  get paletteColors(): PaletteColor[] {
    return this.paletteService.colors;
  }

  getColor(colorId: string | null): PaletteColor | undefined {
    return getColor(colorId);
  }

  getLayerDisplayName(layer: BeadLayer, index: number): string {
    return layerDisplayName(layer, index, this.localization.language);
  }

  getLayerBeadCount(layer: BeadLayer): number {
    return layer.cells.filter(Boolean).length;
  }

  getVisibleBeadCount(project: BeadProject): number {
    return project.layers
      .filter((layer) => layer.visible)
      .reduce((sum, layer) => sum + this.getLayerBeadCount(layer), 0);
  }

  getStatusUsage(project = this.projectService.snapshot.project): { usage: UsageRow[]; totalBeads: number } {
    const usage = summarizeUsage(project);
    return { usage, totalBeads: usage.reduce((sum, row) => sum + row.count, 0) };
  }

  protected onBind(): void {
    this.own(
      combineLatest([
        this.projectService.snapshot$,
        this.paletteService.snapshot$,
        this.localization.snapshot$,
        this.view.snapshot$,
      ]).subscribe(() => this.state.next(this.buildSnapshot())),
    );
  }

  private buildSnapshot(): EditorSnapshot {
    const project = this.projectService.snapshot.project;
    if (project !== this.derivedProject || !this.derived) {
      const previous = this.derivedProject;
      const sameCells = previous && previous.width === project.width && previous.height === project.height
        && previous.layers.length === project.layers.length
        && previous.layers.every((layer, index) => {
          const next = project.layers[index];
          return layer.id === next.id && layer.cells === next.cells && layer.includeInUsage === next.includeInUsage;
        });
      const isolated = sameCells && this.derived ? this.derived.isolated : findIsolatedBeads(project);
      const isolatedIndices = sameCells && this.derived
        ? this.derived.isolatedIndices : [...new Set(isolated.map((item) => item.index))];
      const usage = sameCells && this.derived && previous.settings.beadsPerPack === project.settings.beadsPerPack
        ? this.derived.usage : summarizeUsage(project);
      this.derivedProject = project;
      this.derived = {
        displayProject: getDisplayProject(project),
        usage,
        isolated,
        isolatedIndices,
      };
    }
    const { displayProject, usage, isolated, isolatedIndices } = this.derived;
    const layers = project.layers?.length ? project.layers : createProject(project.width, project.height).layers;
    const activeLayer = layers.find((layer) => layer.id === project.activeLayerId) ?? layers[0];
    const countedLayers = layers.filter((layer) => layer.includeInUsage);
    const paletteColors = this.paletteService.colors;
    const recentColors = this.paletteService.snapshot.recentColorIds.flatMap((id) => {
      const color = paletteColors.find((item) => item.id === id);
      return color ? [color] : [];
    });
    return {
      project,
      past: this.projectService.snapshot.past,
      future: this.projectService.snapshot.future,
      displayProject,
      layers,
      activeLayer,
      activeLayerName: layerDisplayName(activeLayer, layers.findIndex((layer) => layer.id === activeLayer.id), this.localization.language),
      countedLayers,
      usage,
      totalBeads: usage.reduce((sum, row) => sum + row.count, 0),
      totalPacks: usage.reduce((sum, row) => sum + row.packs, 0),
      isolatedBeads: isolated.length,
      boardCount: Math.ceil(project.width / project.boardSettings.boardWidth)
        * Math.ceil(project.height / project.boardSettings.boardHeight),
      highlightedCellIndices: this.view.snapshot.showIsolatedBeads
        ? isolatedIndices
        : [],
      selectedColor: getColor(this.paletteService.snapshot.selectedColorId),
      recentColors,
      paletteGroups: [
        { id: 'all', label: this.localization.text.allColors },
        ...[...new Set(paletteColors.map((color) => color.group))].map((group) => ({ id: group, label: group })),
      ],
    };
  }
}
