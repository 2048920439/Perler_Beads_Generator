import { BehaviorSubject, debounceTime, distinctUntilChanged, fromEvent, map } from 'rxjs';

import { singleton } from '@/service-core/di';
import { readonlyState } from '@/service-core/readonly-state';
import type { BeadProject } from '@/common/types';
import { createProject, loadDraft, saveDraft } from '@/services/domain/project';
import { BaseService } from '@/service-core/base-service';

export type ProjectSnapshot = {
  project: BeadProject;
  past: BeadProject[];
  future: BeadProject[];
  revision: number;
};

function timestamp(project: BeadProject): BeadProject {
  return { ...project, updatedAt: new Date().toISOString() };
}

function initialProject(): BeadProject {
  if (typeof window === 'undefined') return createProject();
  return loadDraft() ?? createProject();
}

@singleton()
export class ProjectService extends BaseService {
  private readonly state = new BehaviorSubject<ProjectSnapshot>({
    project: initialProject(),
    past: [],
    future: [],
    revision: 0,
  });
  readonly snapshot$ = readonlyState(this.state);

  protected onBind(): void {
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

  protected onUnbind(): void {
    this.saveCurrentDraft();
  }

  get snapshot(): ProjectSnapshot {
    return this.state.getValue();
  }

  get activeLayer() {
    const { project } = this.snapshot;
    return project.layers.find((layer) => layer.id === project.activeLayerId) ?? project.layers[0];
  }

  /** Internal write boundary: only EditorService calls project mutation methods. */
  recordHistory(base: BeadProject): void {
    const current = this.snapshot;
    this.emit({
      ...current,
      past: [...current.past.slice(-39), base],
      future: [],
    });
  }

  publish(project: BeadProject, historyBase?: BeadProject, stamp = true): void {
    const current = this.snapshot;
    this.emit({
      project: stamp ? timestamp(project) : project,
      past: historyBase ? [...current.past.slice(-39), historyBase] : current.past,
      future: historyBase ? [] : current.future,
      revision: current.revision + 1,
    });
  }

  undo(): void {
    const { project, past, future } = this.snapshot;
    const previous = past[past.length - 1];
    if (!previous) return;
    this.emit({
      project: timestamp(this.restorePreferences(previous, project)),
      past: past.slice(0, -1),
      future: [...future, project],
      revision: this.snapshot.revision + 1,
    });
  }

  redo(): void {
    const { project, past, future } = this.snapshot;
    const next = future[future.length - 1];
    if (!next) return;
    this.emit({
      project: timestamp(this.restorePreferences(next, project)),
      past: [...past.slice(-39), project],
      future: future.slice(0, -1),
      revision: this.snapshot.revision + 1,
    });
  }

  private emit(snapshot: ProjectSnapshot): void {
    this.state.next(snapshot);
  }

  private restorePreferences(target: BeadProject, current: BeadProject): BeadProject {
    return {
      ...target,
      settings: current.settings,
      activeLayerId: target.layers.some((layer) => layer.id === current.activeLayerId)
        ? current.activeLayerId : target.activeLayerId,
    };
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
