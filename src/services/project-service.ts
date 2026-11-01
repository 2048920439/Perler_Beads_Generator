import { BehaviorSubject, debounceTime, distinctUntilChanged, fromEvent, map } from 'rxjs';

import type { BeadProject, ProjectSettings } from '@/common/types';
import { composeVisibleCells, createProject, loadDraft, resizeCells, saveDraft, withCells, withLayers } from '@/services/domain/project';
import { clampInteger } from './adjustment-operations';
import { BaseService } from '@/service-core/base-service';

export type ProjectSnapshot = {
  project: BeadProject;
  past: BeadProject[];
  future: BeadProject[];
};

export type ProjectUpdateOptions = {
  recordHistory?: boolean;
};

function timestamp(project: BeadProject): BeadProject {
  return { ...project, updatedAt: new Date().toISOString() };
}

function initialProject(): BeadProject {
  if (typeof window === 'undefined') return createProject();
  return loadDraft() ?? createProject();
}

export class ProjectService extends BaseService {
  readonly snapshot$ = new BehaviorSubject<ProjectSnapshot>({
    project: initialProject(),
    past: [],
    future: [],
  });

  protected onActivate(): void {
    if (typeof window === 'undefined') return;
    this.own(
      this.snapshot$
        .pipe(
          map(({ project }) => project),
          distinctUntilChanged((previous, next) => previous === next),
          debounceTime(500),
        )
        .subscribe(this.saveCurrentDraft),
    );
    this.own(fromEvent(window, 'pagehide').subscribe(this.saveCurrentDraft));
    if (typeof document !== 'undefined') {
      this.own(fromEvent(document, 'visibilitychange').subscribe(() => {
        if (document.visibilityState === 'hidden') this.saveCurrentDraft();
      }));
    }
  }

  protected onDeactivate(): void {
    this.saveCurrentDraft();
  }

  get snapshot(): ProjectSnapshot {
    return this.snapshot$.getValue();
  }

  get activeLayer() {
    const { project } = this.snapshot;
    return project.layers.find((layer) => layer.id === project.activeLayerId) ?? project.layers[0];
  }

  updateSettings(changes: Partial<ProjectSettings>): void {
    const { project } = this.snapshot;
    this.replace({ ...project, settings: { ...project.settings, ...changes } });
  }

  updateCells(cells: Array<string | null>): void {
    this.replace(withCells(this.snapshot.project, cells));
  }

  clearCanvas(): boolean {
    if (this.activeLayer.locked || this.activeLayer.cells.every((cell) => cell === null)) return false;
    const { project } = this.snapshot;
    this.replace(withCells(project, Array.from({ length: project.width * project.height }, () => null)), { recordHistory: true });
    return true;
  }

  resizeCanvas(inputWidth: number, inputHeight: number): boolean {
    const { project } = this.snapshot;
    const width = clampInteger(inputWidth, 8, 180);
    const height = clampInteger(inputHeight, 8, 180);
    if (width === project.width && height === project.height) return false;
    const layers = project.layers.map((layer) => ({
      ...layer, cells: resizeCells(layer.cells, project.width, project.height, width, height),
    }));
    this.replace({ ...project, width, height, layers, cells: composeVisibleCells(layers, width, height) }, { recordHistory: true });
    return true;
  }

  replaceColor(sourceColorId: string, selectedColorId: string): number {
    if (!sourceColorId || sourceColorId === selectedColorId) return 0;
    const { project } = this.snapshot;
    let changed = 0;
    const layers = project.layers.map((layer) => {
      const visible = project.settings.showActiveLayerOnly ? layer.id === project.activeLayerId : layer.visible;
      if (layer.locked || !visible) return layer;
      const cells = layer.cells.map((cell) => {
        if (cell !== sourceColorId) return cell;
        changed += 1;
        return selectedColorId;
      });
      return { ...layer, cells };
    });
    if (changed) this.replace(withLayers(project, layers), { recordHistory: true });
    return changed;
  }

  commitHistory(): void {
    const { project, past } = this.snapshot;
    this.emit({
      project,
      past: [...past.slice(-39), project],
      future: [],
    });
  }

  replace(project: BeadProject, options: ProjectUpdateOptions = {}): void {
    const current = this.snapshot;
    const nextPast = options.recordHistory ? [...current.past.slice(-39), current.project] : current.past;
    this.emit({
      project: timestamp(project),
      past: nextPast,
      future: options.recordHistory ? [] : current.future,
    });
  }

  undo(): void {
    const { project, past, future } = this.snapshot;
    const previous = past[past.length - 1];
    if (!previous) return;
    this.emit({
      project: timestamp(previous),
      past: past.slice(0, -1),
      future: [...future, project],
    });
  }

  redo(): void {
    const { project, past, future } = this.snapshot;
    const next = future[future.length - 1];
    if (!next) return;
    this.emit({
      project: timestamp(next),
      past: [...past, project],
      future: future.slice(0, -1),
    });
  }

  private emit(snapshot: ProjectSnapshot): void {
    this.snapshot$.next(snapshot);
  }

  private saveCurrentDraft = (): void => {
    if (typeof window === 'undefined') return;
    try {
      saveDraft(this.snapshot.project);
    } catch {
      // Persistence is best effort; editing must remain available.
    }
  };
}
